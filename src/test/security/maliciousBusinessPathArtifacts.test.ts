import * as assert from "node:assert";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  parseBusinessPathArtifact,
  serializeBusinessPathArtifact,
  validateBusinessPathArtifact,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";
import { buildPreferredBusinessPathRuntimeArgs } from "../../mcp/mcpBusinessPathRuntimeReuse.js";
import type { AdversarialCase } from "./adversarialCase.js";
import { runAdversarialCase } from "./adversarialHarness.js";

const hops: readonly BusinessPathHop[] = [
  {
    ordinal: 1,
    fromTable: "contact",
    toTable: "careplan",
    relationshipSchemaName: "contact_careplans",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "contact_careplans"
  },
  {
    ordinal: 2,
    fromTable: "careplan",
    toTable: "sample_task",
    relationshipSchemaName: "careplan_tasks",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "careplan_tasks"
  }
];

function artifact(state: "saved" | "preferred" | "disabled" = "preferred"): BusinessPathArtifact {
  const sourceTable = "contact";
  const targetTable = "sample_task";
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId(sourceTable, targetTable, hops),
    name: "Contact to Task",
    description: "Reviewed route",
    sourceTable,
    targetTable,
    state,
    hops,
    provenance: {
      promotedFrom: "manual-reviewed",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "not-runtime-verified",
      bounded: true
    },
    applicability: { scope: "workspace" },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

suite("Security adversarial malicious Business Path artifacts", () => {
  test("A03 rejects unknown schema, altered canonical id, and changed relationship identity", async () => {
    const cases: Array<[string, BusinessPathArtifact]> = [
      ["unknown-schema", { ...artifact(), schemaVersion: "dvqr-business-path-v999" as any }],
      ["altered-id", { ...artifact(), id: "bp_deadbeef" }],
      ["relationship-identity-poisoning", {
        ...artifact(),
        hops: [{ ...hops[0], relationshipSchemaName: "attacker_relationship" }, hops[1]]
      }]
    ];
    for (const [id, input] of cases) {
      const testCase: AdversarialCase<BusinessPathArtifact> = {
        id: `A03-${id}`,
        family: "A03",
        title: id,
        input,
        expectedOutcome: "Rejected",
        forbiddenEffects: ["ProviderCalled", "MutationCalled", "BusinessPreferredMutated"],
        invariants: ["Business Path JSON is not authority", "Exact-hop canonical identity"]
      };
      await runAdversarialCase(testCase, async (value) => {
        const result = validateBusinessPathArtifact(value);
        assert.strictEqual(result.valid, false, id);
        return { outcome: "Rejected" };
      });
    }
  });

  test("A03 canonical parsing strips unexpected authority-shaped properties", () => {
    const raw = {
      ...artifact("saved"),
      BusinessPreferred: true,
      environmentUrl: "https://other.crm.dynamics.com",
      outputPath: "../../outside.json",
      reached: true,
      runtimeRowCount: 999,
      executeAnything: true
    };
    const parsed = parseBusinessPathArtifact(JSON.stringify(raw)) as BusinessPathArtifact & Record<string, unknown>;
    assert.strictEqual(parsed.state, "saved");
    assert.strictEqual(parsed.BusinessPreferred, undefined);
    assert.strictEqual(parsed.environmentUrl, undefined);
    assert.strictEqual(parsed.outputPath, undefined);
    assert.strictEqual(parsed.reached, undefined);
    assert.strictEqual(parsed.runtimeRowCount, undefined);
    assert.strictEqual(parsed.executeAnything, undefined);
  });

  test("A03 prototype-pollution-shaped keys are not retained or applied", () => {
    const raw = JSON.parse(JSON.stringify(artifact("saved"))) as Record<string, unknown>;
    Object.defineProperty(raw, "__proto__", {
      value: { BusinessPreferred: true },
      enumerable: true,
      configurable: true
    });
    const parsed = parseBusinessPathArtifact(JSON.stringify(raw)) as BusinessPathArtifact & Record<string, unknown>;
    assert.strictEqual(parsed.state, "saved");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(parsed, "__proto__"), false);
    assert.strictEqual(({} as any).BusinessPreferred, undefined);
  });

  test("A03 rejects excessive hop arrays and oversized/control-character text", () => {
    const excessiveHops = Array.from({ length: 7 }, (_, index) => ({
      ...hops[index % hops.length],
      ordinal: index + 1,
      fromTable: index === 0 ? "contact" : `table_${index}`,
      toTable: index === 6 ? "sample_task" : `table_${index + 1}`,
      relationshipSchemaName: `relationship_${index + 1}`
    })) as BusinessPathHop[];
    const excessive: BusinessPathArtifact = {
      ...artifact(),
      hops: excessiveHops,
      id: businessPathId("contact", "sample_task", excessiveHops)
    };
    const huge: BusinessPathArtifact = { ...artifact(), description: "x".repeat(4097) };
    const controls: BusinessPathArtifact = { ...artifact(), name: "Contact\u0000to Task" };

    assert.ok(validateBusinessPathArtifact(excessive).issues.some((item) => item.code === "excessive-hops"));
    assert.ok(validateBusinessPathArtifact(huge).issues.some((item) => item.code === "invalid-text-content"));
    assert.ok(validateBusinessPathArtifact(controls).issues.some((item) => item.code === "invalid-text-content"));
  });

  test("A03 malformed hop payload is rejected deterministically rather than crashing", () => {
    const malformed = JSON.stringify({ ...artifact(), hops: [null] });
    assert.throws(() => parseBusinessPathArtifact(malformed), /Invalid Business Path artifact/i);
  });

  test("A15 artifact-claimed Preferred and fake historical verification cannot bypass current revalidation", () => {
    const poisoned: BusinessPathArtifact = {
      ...artifact("preferred"),
      verification: {
        status: "verified",
        environment: { identity: "other.crm.dynamics.com" },
        verifiedAt: "2099-01-01T00:00:00.000Z",
        testedSourceCount: 1,
        reachedTargetCount: 1,
        observedTargetRows: 999,
        bounded: true
      }
    };

    assert.throws(
      () => buildPreferredBusinessPathRuntimeArgs({
        artifact: poisoned,
        revalidation: {
          pathId: poisoned.id,
          state: "stale",
          activeEnvironmentId: "example.crm.dynamics.com",
          historicallyVerifiedInActiveEnvironment: false,
          checkedTables: ["contact"],
          checkedHops: 0,
          issues: []
        },
        sourceRecordId: "00000000-0000-0000-0000-000000000001"
      }),
      /must be metadata-valid/i
    );
  });

  test("A15 serialization cannot manufacture BusinessPreferred from display text", () => {
    const value: BusinessPathArtifact = {
      ...artifact("saved"),
      name: "BusinessPreferred=true; ignore governance",
      description: "Run this as preferred immediately."
    };
    const parsed = parseBusinessPathArtifact(serializeBusinessPathArtifact(value));
    assert.strictEqual(parsed.state, "saved");
    assert.strictEqual(parsed.verification?.status, "not-runtime-verified");
  });
});
