import * as assert from "node:assert";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  canonicalBusinessPathKey,
  parseBusinessPathArtifact,
  serializeBusinessPathArtifact,
  validateBusinessPathArtifact,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";

const patientHop: BusinessPathHop = {
  ordinal: 1,
  fromTable: "contact",
  toTable: "msemr_careplan",
  relationshipSchemaName: "msemr_contact_msemr_careplan_PatientIdentifier",
  relationshipType: "OneToMany",
  direction: "forward",
  navigationProperty: "msemr_contact_msemr_careplan_PatientIdentifier",
  lookupAttribute: "msemr_patientidentifier"
};

const authorHop: BusinessPathHop = {
  ...patientHop,
  relationshipSchemaName: "msemr_authorcareplan_contact",
  navigationProperty: "msemr_authorcareplan_contact",
  lookupAttribute: "msemr_author"
};

const activityHop: BusinessPathHop = {
  ordinal: 2,
  fromTable: "msemr_careplan",
  toTable: "msemr_careplanactivity",
  relationshipSchemaName: "msemr_msemr_careplan_msemr_careplanactivity_CarePlan",
  relationshipType: "OneToMany",
  direction: "forward",
  navigationProperty: "msemr_msemr_careplan_msemr_careplanactivity_CarePlan",
  lookupAttribute: "msemr_careplan"
};

const taskHop: BusinessPathHop = {
  ordinal: 3,
  fromTable: "msemr_careplanactivity",
  toTable: "bu_task",
  relationshipSchemaName: "bu_task_msemr_careplanactivity",
  relationshipType: "ManyToOne",
  direction: "forward",
  navigationProperty: "bu_Task",
  lookupAttribute: "bu_task"
};

function artifact(hops: readonly BusinessPathHop[] = [patientHop, activityHop, taskHop]): BusinessPathArtifact {
  const sourceTable = "contact";
  const targetTable = "bu_task";
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId(sourceTable, targetTable, hops),
    name: "Contact to Task via Care Plan",
    description: "Reviewed business traversal.",
    sourceTable,
    targetTable,
    state: "preferred",
    priority: 1,
    hops,
    provenance: {
      promotedFrom: "runtime-validation",
      sourceEvidenceId: "evidence-1",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "verified",
      environment: {
        identity: "example.crm.dynamics.com",
        organisationId: "org-1"
      },
      verifiedAt: "2026-08-18T00:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 3,
      bounded: true,
      evidenceRef: "evidence-1"
    },
    applicability: {
      scope: "workspace",
      verifiedEnvironmentIds: ["example.crm.dynamics.com"]
    },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

suite("Managed Business Path contracts", () => {
  test("builds deterministic identity from exact relationship route", () => {
    const first = businessPathId("contact", "bu_task", [patientHop, activityHop, taskHop]);
    const second = businessPathId("CONTACT", "BU_TASK", [patientHop, activityHop, taskHop]);
    assert.strictEqual(first, second);
    assert.match(first, /^bp_[0-9a-f]{8}$/);
  });

  test("keeps same table sequence but different relationship identity distinct", () => {
    const patient = businessPathId("contact", "bu_task", [patientHop, activityHop, taskHop]);
    const author = businessPathId("contact", "bu_task", [authorHop, activityHop, taskHop]);
    assert.notStrictEqual(patient, author);
    assert.notStrictEqual(
      canonicalBusinessPathKey("contact", "bu_task", [patientHop, activityHop, taskHop]),
      canonicalBusinessPathKey("contact", "bu_task", [authorHop, activityHop, taskHop])
    );
  });

  test("validates a complete preferred artifact", () => {
    const result = validateBusinessPathArtifact(artifact());
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.issues, []);
  });

  test("rejects broken path continuity", () => {
    const broken = artifact([
      patientHop,
      { ...activityHop, fromTable: "account" },
      taskHop
    ]);
    const result = validateBusinessPathArtifact(broken);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some((item) => item.code === "path-discontinuity"));
  });

  test("rejects a deterministic id that does not match the exact route", () => {
    const value = { ...artifact(), id: "bp_deadbeef" };
    const result = validateBusinessPathArtifact(value);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some((item) => item.code === "id-mismatch"));
  });

  test("does not allow metadata-only preference to masquerade as runtime verification", () => {
    const value = artifact();
    const invalid: BusinessPathArtifact = {
      ...value,
      verification: {
        status: "verified",
        bounded: true
      }
    };
    const result = validateBusinessPathArtifact(invalid);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some((item) => item.code === "invalid-verification"));

    const reviewed: BusinessPathArtifact = {
      ...value,
      verification: {
        status: "not-runtime-verified",
        bounded: true
      }
    };
    assert.strictEqual(validateBusinessPathArtifact(reviewed).valid, true);
  });

  test("preserves unknown target row count without converting it to zero", () => {
    const value: BusinessPathArtifact = {
      ...artifact(),
      verification: {
        status: "verified",
        verifiedAt: "2026-08-18T00:00:00.000Z",
        testedSourceCount: 1,
        reachedTargetCount: 1,
        observedTargetRows: null,
        bounded: true
      }
    };
    const parsed = parseBusinessPathArtifact(serializeBusinessPathArtifact(value));
    assert.strictEqual(parsed.verification?.observedTargetRows, null);
  });

  test("serialization is deterministic and orders hops by ordinal", () => {
    const value = artifact([taskHop, patientHop, activityHop]);
    const first = serializeBusinessPathArtifact(value);
    const second = serializeBusinessPathArtifact(parseBusinessPathArtifact(first));
    assert.strictEqual(first, second);
    const parsed = JSON.parse(first) as BusinessPathArtifact;
    assert.deepStrictEqual(parsed.hops.map((hop) => hop.ordinal), [1, 2, 3]);
  });

  test("rejects secret-like persisted content", () => {
    const value: BusinessPathArtifact = {
      ...artifact(),
      description: "authorization: Bearer abc.def.ghi"
    };
    const result = validateBusinessPathArtifact(value);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some((item) => item.code === "secret-like-content"));
  });

  test("disabled remains a managed path state rather than erasing provenance", () => {
    const value: BusinessPathArtifact = { ...artifact(), state: "disabled" };
    const result = validateBusinessPathArtifact(value);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(value.provenance.promotedBy, "user");
  });
});
