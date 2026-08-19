import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  businessPathDisplayChain,
  updateManagedBusinessPath,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { BusinessPathManagementService } from "../../runtime/businessPaths/businessPathManagementService.js";
import {
  buildBusinessPathDetail,
  buildBusinessPathLibraryItem
} from "../../commands/router/actions/businessPaths/businessPathManagementPresentation.js";

const hops: readonly BusinessPathHop[] = [
  {
    ordinal: 1,
    fromTable: "contact",
    toTable: "careplan",
    relationshipSchemaName: "contact_careplan_patient",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "contact_careplans",
    lookupAttribute: "patientid"
  },
  {
    ordinal: 2,
    fromTable: "careplan",
    toTable: "task",
    relationshipSchemaName: "careplan_tasks",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "careplan_tasks",
    lookupAttribute: "regardingid"
  }
];

function artifact(): BusinessPathArtifact {
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId("contact", "task", hops),
    name: "Contact to Task via Care Plan",
    description: "Reviewed route",
    sourceTable: "contact",
    targetTable: "task",
    state: "preferred",
    priority: 3,
    hops,
    provenance: {
      promotedFrom: "runtime-validation",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "verified",
      environment: { identity: "example.crm.dynamics.com" },
      verifiedAt: "2026-08-18T00:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 2,
      bounded: true
    },
    applicability: {
      scope: "workspace",
      verifiedEnvironmentIds: ["example.crm.dynamics.com"]
    },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

suite("Managed Business Path management", () => {
  test("updates human-managed fields without changing exact route identity or verification", () => {
    const original = artifact();
    const updated = updateManagedBusinessPath(
      original,
      {
        name: "Patient care route",
        description: "Team reviewed",
        priority: 1,
        state: "disabled"
      },
      "2026-08-18T01:00:00.000Z"
    );

    assert.strictEqual(updated.id, original.id);
    assert.deepStrictEqual(updated.hops, original.hops);
    assert.deepStrictEqual(updated.verification, original.verification);
    assert.strictEqual(updated.name, "Patient care route");
    assert.strictEqual(updated.description, "Team reviewed");
    assert.strictEqual(updated.priority, 1);
    assert.strictEqual(updated.state, "disabled");
    assert.strictEqual(updated.updatedAt, "2026-08-18T01:00:00.000Z");
  });

  test("clears description and priority explicitly", () => {
    const updated = updateManagedBusinessPath(
      artifact(),
      { description: null, priority: null },
      "2026-08-18T01:00:00.000Z"
    );
    assert.strictEqual(updated.description, undefined);
    assert.strictEqual(updated.priority, undefined);
  });

  test("rejects empty names and invalid priorities", () => {
    assert.throws(
      () => updateManagedBusinessPath(artifact(), { name: "   " }, "2026-08-18T01:00:00.000Z"),
      /name cannot be empty/i
    );
    assert.throws(
      () => updateManagedBusinessPath(artifact(), { priority: -1 }, "2026-08-18T01:00:00.000Z"),
      /non-negative integer/i
    );
  });

  test("management service persists enable disable rename priority and delete", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-path-management-"));
    try {
      const repository = new WorkspaceBusinessPathRepository(workspace);
      repository.save(artifact());

      const times = [
        "2026-08-18T01:00:00.000Z",
        "2026-08-18T02:00:00.000Z",
        "2026-08-18T03:00:00.000Z"
      ];
      const manager = new BusinessPathManagementService(repository, {
        nowIso: () => times.shift() ?? "2026-08-18T04:00:00.000Z"
      });

      const disabled = manager.setEnabled(artifact().id, false);
      assert.strictEqual(disabled.state, "disabled");

      const renamed = manager.update(artifact().id, {
        name: "Reviewed path",
        priority: 0
      });
      assert.strictEqual(renamed.name, "Reviewed path");
      assert.strictEqual(renamed.priority, 0);
      assert.deepStrictEqual(renamed.hops, artifact().hops);

      const enabled = manager.setEnabled(artifact().id, true);
      assert.strictEqual(enabled.state, "preferred");
      assert.strictEqual(repository.list().length, 1);

      assert.strictEqual(manager.delete(artifact().id), true);
      assert.deepStrictEqual(repository.list(), []);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("builds calm library and detail presentation without claiming current runtime truth", () => {
    const value = artifact();
    const item = buildBusinessPathLibraryItem(value);
    assert.strictEqual(item.label, "★ Contact to Task via Care Plan");
    assert.match(item.description, /Preferred/);
    assert.match(item.description, /Previously verified/);
    assert.strictEqual(item.detail, "contact → careplan → task");

    const detail = buildBusinessPathDetail(value, {
      pathId: value.id,
      state: "valid",
      activeEnvironmentId: "example.crm.dynamics.com",
      historicallyVerifiedInActiveEnvironment: true,
      checkedTables: ["contact", "careplan", "task"],
      checkedHops: 2,
      issues: []
    });

    assert.ok(detail.lines.includes("Current metadata: valid"));
    assert.ok(detail.lines.some((line) => line.includes("contact_careplan_patient")));
    assert.ok(detail.lines.some((line) => line.includes("Previously verified")));
    assert.ok(!detail.lines.some((line) => /currently runtime verified/i.test(line)));
  });

  test("display chain derives from ordered exact hops", () => {
    const value = { ...artifact(), hops: [hops[1], hops[0]] };
    assert.strictEqual(businessPathDisplayChain(value), "contact → careplan → task");
  });
});
