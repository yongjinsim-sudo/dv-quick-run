import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { BusinessPathVerificationService } from "../../runtime/businessPaths/businessPathVerificationService.js";

const hops: readonly BusinessPathHop[] = [{
  ordinal: 1,
  fromTable: "contact",
  toTable: "task",
  relationshipSchemaName: "contact_tasks",
  relationshipType: "OneToMany",
  direction: "forward",
  navigationProperty: "contact_tasks",
  lookupAttribute: "regardingid"
}];

function artifact(verification: BusinessPathArtifact["verification"] = {
  status: "not-runtime-verified",
  bounded: true
}): BusinessPathArtifact {
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId("contact", "task", hops),
    name: "Contact to Task",
    sourceTable: "contact",
    targetTable: "task",
    state: "preferred",
    hops,
    provenance: {
      promotedFrom: "manual-reviewed",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification,
    applicability: { scope: "workspace" },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

suite("BusinessPathVerificationService", () => {
  let workspace: string;

  setup(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-path-verification-"));
  });

  teardown(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test("upgrades a Preferred path after canonical runtime success", () => {
    const repository = new WorkspaceBusinessPathRepository(workspace);
    const value = artifact();
    repository.save(value);

    const service = new BusinessPathVerificationService(repository, {
      nowIso: () => "2026-08-18T04:00:00.000Z"
    });
    const updated = service.recordSuccessfulRuntimeVerification(value.id, {
      environment: { identity: "orgdev.crm6.dynamics.com" },
      observedTargetRows: 7
    });

    assert.strictEqual(updated.verification?.status, "verified");
    assert.strictEqual(updated.verification?.verifiedAt, "2026-08-18T04:00:00.000Z");
    assert.strictEqual(updated.verification?.testedSourceCount, 1);
    assert.strictEqual(updated.verification?.reachedTargetCount, 1);
    assert.strictEqual(updated.verification?.observedTargetRows, 7);
    assert.strictEqual(updated.verification?.bounded, true);
    assert.strictEqual(updated.verification?.environment?.identity, "orgdev.crm6.dynamics.com");
    assert.deepStrictEqual(updated.applicability?.verifiedEnvironmentIds, ["orgdev.crm6.dynamics.com"]);
    assert.deepStrictEqual(updated.hops, value.hops);
    assert.strictEqual(updated.provenance.promotedAt, value.provenance.promotedAt);
  });

  test("refreshes successful verification without changing route identity", () => {
    const repository = new WorkspaceBusinessPathRepository(workspace);
    const value = artifact({
      status: "verified",
      environment: { identity: "old.crm.dynamics.com" },
      verifiedAt: "2026-08-17T00:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 2,
      bounded: true
    });
    repository.save({
      ...value,
      applicability: {
        scope: "workspace",
        verifiedEnvironmentIds: ["old.crm.dynamics.com"]
      }
    });

    const service = new BusinessPathVerificationService(repository);
    const updated = service.recordSuccessfulRuntimeVerification(value.id, {
      environment: { identity: "orgdev.crm6.dynamics.com" },
      observedTargetRows: 5,
      verifiedAt: "2026-08-18T05:00:00.000Z"
    });

    assert.strictEqual(updated.id, value.id);
    assert.deepStrictEqual(updated.hops, value.hops);
    assert.strictEqual(updated.verification?.observedTargetRows, 5);
    assert.deepStrictEqual(
      updated.applicability?.verifiedEnvironmentIds,
      ["old.crm.dynamics.com", "orgdev.crm6.dynamics.com"]
    );
  });

  test("refuses disabled paths", () => {
    const repository = new WorkspaceBusinessPathRepository(workspace);
    const value = { ...artifact(), state: "disabled" as const };
    repository.save(value);

    assert.throws(
      () => new BusinessPathVerificationService(repository)
        .recordSuccessfulRuntimeVerification(value.id, {
          environment: { identity: "orgdev.crm6.dynamics.com" },
          observedTargetRows: 1
        }),
      /enabled Preferred/i
    );
  });
});
