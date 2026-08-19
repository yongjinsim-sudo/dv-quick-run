import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BusinessPathPromotionService } from "../../runtime/businessPaths/businessPathPromotionService.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { buildBusinessPathPromotionFromMcpCandidate } from "../../mcp/mcpBusinessPathPromotionAdapter.js";
import type { McpBusinessPathCandidate } from "../../mcp/mcpBusinessPathDiscovery.js";
import type { McpValidatedBusinessPath } from "../../mcp/mcpBusinessPathRuntimeValidation.js";

function candidate(): McpBusinessPathCandidate {
  return {
    pathId: "contact:contact_careplans:msemr_careplan|msemr_careplan:careplan_activities:msemr_careplanactivity|msemr_careplanactivity:bu_Task:bu_task",
    tables: ["contact", "msemr_careplan", "msemr_careplanactivity", "bu_task"],
    bridgeTables: ["msemr_careplan", "msemr_careplanactivity"],
    hops: [
      {
        fromTable: "contact",
        toTable: "msemr_careplan",
        navigationProperty: "contact_careplans",
        relationshipSchemaName: "msemr_contact_msemr_careplan_PatientIdentifier",
        referencingAttribute: "msemr_patientidentifier",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        collectionValued: true,
        polymorphicTargetQualified: true
      },
      {
        fromTable: "msemr_careplan",
        toTable: "msemr_careplanactivity",
        navigationProperty: "careplan_activities",
        relationshipSchemaName: "msemr_msemr_careplan_msemr_careplanactivity_CarePlan",
        referencingAttribute: "msemr_careplan",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        collectionValued: true,
        polymorphicTargetQualified: true
      },
      {
        fromTable: "msemr_careplanactivity",
        toTable: "bu_task",
        navigationProperty: "bu_Task",
        relationshipSchemaName: "bu_task_msemr_careplanactivity",
        referencingAttribute: "bu_task",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        collectionValued: false,
        polymorphicTargetQualified: true
      }
    ],
    metadataTraversalScore: 88,
    businessPathScore: 94,
    assessment: "StrongCandidate",
    evidenceState: {
      metadataValid: true,
      runtimeViable: "Unknown",
      businessPreferred: "CandidateOnly"
    },
    signals: [],
    limitations: []
  };
}

function viableValidation(): McpValidatedBusinessPath {
  const c = candidate();
  return {
    pathId: c.pathId,
    tables: c.tables,
    metadataBusinessScore: c.businessPathScore,
    metadataAssessment: c.assessment,
    runtimeStatus: "RuntimeViable",
    reachedTarget: true,
    completedHops: 3,
    totalHops: 3,
    finalTargetRecordCount: 3,
    observedTargetRecordCount: 3,
    targetObservationBound: 5,
    targetCountBoundary: "BelowLimit",
    runtimeEvidenceScore: 100,
    combinedScore: 194,
    businessPreferred: "RuntimePreferred",
    routeSemantics: "MultiHopBusinessTraversalCandidate",
    businessAuthority: "RuntimeAlternative",
    steps: []
  };
}

suite("Business Path explicit promotion", () => {
  let workspaceRoot: string;

  setup(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-business-path-promotion-"));
  });

  teardown(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  test("building a promotion draft has no persistence side effect", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const draft = buildBusinessPathPromotionFromMcpCandidate({
      name: "Contact to Task via Care Plan",
      candidate: candidate(),
      promotedAt: "2026-08-18T01:00:00.000Z"
    });

    assert.strictEqual(draft.verification?.status, "not-runtime-verified");
    assert.deepStrictEqual(repository.list(), []);
  });

  test("explicit promote persists an exact discovered route without claiming runtime verification", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const service = new BusinessPathPromotionService(repository, {
      nowIso: () => "2026-08-18T02:00:00.000Z"
    });
    const draft = buildBusinessPathPromotionFromMcpCandidate({
      name: "Contact to Task via Care Plan",
      candidate: candidate(),
      promotedAt: "2026-08-18T01:00:00.000Z",
      priority: 1
    });

    const result = service.promote(draft);

    assert.strictEqual(result.created, true);
    assert.strictEqual(result.updatedExisting, false);
    assert.strictEqual(result.artifact.state, "preferred");
    assert.strictEqual(result.artifact.verification?.status, "not-runtime-verified");
    assert.strictEqual(result.artifact.provenance.promotedAt, "2026-08-18T02:00:00.000Z");
    assert.deepStrictEqual(result.artifact.hops.map((hop) => hop.relationshipSchemaName), [
      "msemr_contact_msemr_careplan_PatientIdentifier",
      "msemr_msemr_careplan_msemr_careplanactivity_CarePlan",
      "bu_task_msemr_careplanactivity"
    ]);
    assert.strictEqual(repository.list().length, 1);
  });

  test("runtime-viable evidence creates a bounded verified snapshot", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const service = new BusinessPathPromotionService(repository, {
      nowIso: () => "2026-08-18T02:00:00.000Z"
    });

    const result = service.promote(buildBusinessPathPromotionFromMcpCandidate({
      name: "Contact to Task via Care Plan",
      candidate: candidate(),
      validatedPath: viableValidation(),
      promotedAt: "2026-08-18T01:30:00.000Z",
      environmentIdentity: "example.crm.dynamics.com",
      organisationId: "org-1",
      evidenceRef: "runtime-evidence-1"
    }));

    assert.strictEqual(result.artifact.verification?.status, "verified");
    assert.strictEqual(result.artifact.verification?.testedSourceCount, 1);
    assert.strictEqual(result.artifact.verification?.reachedTargetCount, 1);
    assert.strictEqual(result.artifact.verification?.observedTargetRows, 3);
    assert.strictEqual(result.artifact.verification?.bounded, true);
    assert.strictEqual(result.artifact.verification?.environment?.identity, "example.crm.dynamics.com");
    assert.deepStrictEqual(result.artifact.applicability?.verifiedEnvironmentIds, ["example.crm.dynamics.com"]);
  });

  test("failed or empty runtime evidence never becomes verified", () => {
    const notViable: McpValidatedBusinessPath = {
      ...viableValidation(),
      runtimeStatus: "NoContinuationObserved",
      reachedTarget: false,
      observedTargetRecordCount: 0,
      finalTargetRecordCount: 0,
      targetCountBoundary: "NotObserved",
      businessPreferred: "NotRuntimeViable"
    };

    const draft = buildBusinessPathPromotionFromMcpCandidate({
      name: "Reviewed metadata path",
      candidate: candidate(),
      validatedPath: notViable,
      promotedAt: "2026-08-18T01:30:00.000Z",
      environmentIdentity: "example.crm.dynamics.com"
    });

    assert.strictEqual(draft.verification?.status, "not-runtime-verified");
    assert.deepStrictEqual(draft.applicability?.verifiedEnvironmentIds, undefined);
  });

  test("rejects runtime evidence for a different exact path", () => {
    const validation = { ...viableValidation(), pathId: "different-path" };
    assert.throws(
      () => buildBusinessPathPromotionFromMcpCandidate({
        name: "Mismatch",
        candidate: candidate(),
        validatedPath: validation,
        promotedAt: "2026-08-18T01:30:00.000Z"
      }),
      /does not belong/i
    );
  });

  test("rejects promotion when exact relationship schema identity is unavailable", () => {
    const value = candidate();
    const missingIdentity: McpBusinessPathCandidate = {
      ...value,
      hops: [
        { ...value.hops[0], relationshipSchemaName: undefined },
        ...value.hops.slice(1)
      ]
    };

    assert.throws(
      () => buildBusinessPathPromotionFromMcpCandidate({
        name: "Incomplete",
        candidate: missingIdentity,
        promotedAt: "2026-08-18T01:30:00.000Z"
      }),
      /exact relationship schema name/i
    );
  });

  test("re-promoting the same canonical route updates rather than duplicates", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const times = ["2026-08-18T02:00:00.000Z", "2026-08-18T03:00:00.000Z"];
    const service = new BusinessPathPromotionService(repository, {
      nowIso: () => times.shift() ?? "2026-08-18T04:00:00.000Z"
    });

    const first = service.promote(buildBusinessPathPromotionFromMcpCandidate({
      name: "Original",
      candidate: candidate(),
      promotedAt: "2026-08-18T01:00:00.000Z"
    }));
    const second = service.promote(buildBusinessPathPromotionFromMcpCandidate({
      name: "Reviewed",
      candidate: candidate(),
      validatedPath: viableValidation(),
      promotedAt: "2026-08-18T02:30:00.000Z",
      environmentIdentity: "example.crm.dynamics.com"
    }));

    assert.strictEqual(first.created, true);
    assert.strictEqual(second.created, false);
    assert.strictEqual(second.updatedExisting, true);
    assert.strictEqual(second.artifact.id, first.artifact.id);
    assert.strictEqual(second.artifact.createdAt, "2026-08-18T02:00:00.000Z");
    assert.strictEqual(second.artifact.updatedAt, "2026-08-18T03:00:00.000Z");
    assert.strictEqual(second.artifact.name, "Reviewed");
    assert.strictEqual(second.artifact.verification?.status, "verified");
    assert.strictEqual(repository.list().length, 1);
  });

  test("metadata-only re-promotion does not erase earlier runtime verification", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const times = ["2026-08-18T02:00:00.000Z", "2026-08-18T03:00:00.000Z"];
    const service = new BusinessPathPromotionService(repository, {
      nowIso: () => times.shift() ?? "2026-08-18T04:00:00.000Z"
    });

    service.promote(buildBusinessPathPromotionFromMcpCandidate({
      name: "Verified",
      candidate: candidate(),
      validatedPath: viableValidation(),
      promotedAt: "2026-08-18T01:30:00.000Z",
      environmentIdentity: "example.crm.dynamics.com"
    }));

    const updated = service.promote(buildBusinessPathPromotionFromMcpCandidate({
      name: "Renamed only",
      candidate: candidate(),
      promotedAt: "2026-08-18T02:30:00.000Z"
    }));

    assert.strictEqual(updated.artifact.verification?.status, "verified");
    assert.strictEqual(updated.artifact.verification?.observedTargetRows, 3);
    assert.deepStrictEqual(updated.artifact.applicability?.verifiedEnvironmentIds, ["example.crm.dynamics.com"]);
  });
});
