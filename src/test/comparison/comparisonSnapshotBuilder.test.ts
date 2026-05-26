import * as assert from "assert";
import {
  createComparisonEvidenceSnapshot,
  createOperationalComparisonSnapshotDocument,
  normalizeComparisonEnvironmentIdentity,
  validateComparisonSnapshotDocument
} from "../../product/comparison/index.js";

suite("comparisonSnapshotBuilder", () => {
  test("normalizes environment identity without implying live authority", () => {
    assert.deepStrictEqual(normalizeComparisonEnvironmentIdentity({ label: "  DEV  ", environmentUrl: "  https://dev.crm.dynamics.com  " }), {
      label: "DEV",
      environmentUrl: "https://dev.crm.dynamics.com",
      environmentId: undefined
    });
  });

  test("creates deterministic comparison-safe evidence snapshots", () => {
    const snapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT", environmentId: "env-sit" },
      evidenceType: "IdentityParticipation",
      evidence: { users: 3, teams: 2 },
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      sourceFeature: "Access Context"
    });

    assert.strictEqual(snapshot.metadata.snapshotVersion, "comparison-snapshot-v1");
    assert.strictEqual(snapshot.metadata.capturedAtIso, "2026-05-24T00:00:00.000Z");
    assert.strictEqual(snapshot.metadata.sourceFeature, "Access Context");
    assert.strictEqual(snapshot.evidenceType, "IdentityParticipation");
    assert.deepStrictEqual(snapshot.evidence, { users: 3, teams: 2 });
  });
  test("wraps evidence snapshots in a comparison document and validates them", () => {
    const evidence = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "OperationalProfile",
      evidence: { entityLogicalName: "account" },
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      sourceFeature: "Operational Profile"
    });

    const document = createOperationalComparisonSnapshotDocument({
      environment: { label: "DEV" },
      evidenceSnapshots: [evidence],
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      sourceFeature: "Operational Profile"
    });

    const validation = validateComparisonSnapshotDocument(document);

    assert.strictEqual(document.kind, "dvqr-operational-comparison-snapshot");
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.snapshots.length, 1);
    assert.strictEqual(validation.snapshots[0].evidenceType, "OperationalProfile");
  });

});
