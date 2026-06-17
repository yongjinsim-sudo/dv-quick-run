import * as assert from "assert";
import {
  createComparisonEvidenceSnapshot,
  createOperationalComparisonSnapshotDocument,
  verifyOperationalComparisonSnapshotIntegrity,
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
    assert.strictEqual(document.lineage?.lineageVersion, "comparison-lineage-v1");
    assert.strictEqual(document.lineage?.origin, "captured");
    assert.strictEqual(document.lineage?.createdAtIso, "2026-05-24T00:00:00.000Z");
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.trustState, "Verified");
    assert.strictEqual(verifyOperationalComparisonSnapshotIntegrity(document), true);
    assert.strictEqual(validation.snapshots.length, 1);
    assert.strictEqual(validation.snapshots[0].evidenceType, "OperationalProfile");
  });

  test("creates metadata-owned snapshot identity for timeline-ready storage", () => {
    const evidence = createComparisonEvidenceSnapshot({
      environment: { label: "DEV", environmentUrl: "https://dev.crm.dynamics.com" },
      evidenceType: "OperationalProfile",
      evidence: { entityLogicalName: "account", entityDisplayName: "Account" },
      capturedAt: new Date("2026-06-17T11:45:00.000Z"),
      sourceFeature: "Operational Profile"
    });

    const document = createOperationalComparisonSnapshotDocument({
      environment: { label: "DEV", environmentUrl: "https://dev.crm.dynamics.com" },
      evidenceSnapshots: [evidence],
      capturedAt: new Date("2026-06-17T11:45:00.000Z"),
      sourceFeature: "Operational Profile",
      snapshotId: "snapshot-account-dev-before",
      snapshotLineageId: "lineage-account-dev",
      label: "before-release",
      entityLogicalName: "account",
      entityDisplayName: "Account"
    });

    assert.strictEqual(document.snapshotIdentity?.identityVersion, "comparison-snapshot-identity-v1");
    assert.strictEqual(document.snapshotIdentity?.snapshotId, "snapshot-account-dev-before");
    assert.strictEqual(document.snapshotIdentity?.snapshotLineageId, "lineage-account-dev");
    assert.strictEqual(document.snapshotIdentity?.label, "before-release");
    assert.strictEqual(document.snapshotIdentity?.entityLogicalName, "account");
    assert.strictEqual(document.snapshotIdentity?.entityDisplayName, "Account");
    assert.strictEqual(document.snapshotIdentity?.environmentLabel, "DEV");
    assert.strictEqual(document.lineage?.snapshotLineageId, "lineage-account-dev");
    assert.strictEqual(verifyOperationalComparisonSnapshotIntegrity(document), true);
  });


  test("marks tampered comparison documents as modified instead of silently trusting them", () => {
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

    const tampered = {
      ...document,
      evidenceSnapshots: document.evidenceSnapshots.map((snapshot) => ({
        ...snapshot,
        evidence: { entityLogicalName: "contact" }
      }))
    };

    const validation = validateComparisonSnapshotDocument(tampered);

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.trustState, "Modified");
    assert.strictEqual(verifyOperationalComparisonSnapshotIntegrity(tampered), false);
  });

  test("keeps legacy comparison snapshots readable as unverified evidence", () => {
    const legacyDocument = {
      kind: "dvqr-operational-comparison-snapshot",
      schemaVersion: "1.0",
      snapshotVersion: "comparison-snapshot-v1",
      environment: { label: "DEV" },
      capturedAtIso: "2026-05-24T00:00:00.000Z",
      sourceFeature: "Operational Profile",
      evidenceSnapshots: [
        {
          environment: { label: "DEV" },
          evidenceType: "OperationalProfile",
          metadata: {
            snapshotVersion: "comparison-snapshot-v1",
            capturedAtIso: "2026-05-24T00:00:00.000Z",
            sourceFeature: "Operational Profile"
          },
          evidence: { entityLogicalName: "account" }
        }
      ]
    };

    const validation = validateComparisonSnapshotDocument(legacyDocument);

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.trustState, "Legacy / Unverified");
    assert.strictEqual(validation.snapshots.length, 1);
  });

  test("includes snapshot lineage in integrity verification", () => {
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
      sourceFeature: "Operational Profile",
      lineage: {
        origin: "imported",
        createdAtIso: "2026-05-25T00:00:00.000Z",
        parentSnapshotIds: [" parent-one ", ""],
        note: " Imported for replay validation "
      }
    });

    assert.strictEqual(document.lineage?.origin, "imported");
    assert.deepStrictEqual(document.lineage?.parentSnapshotIds, ["parent-one"]);
    assert.strictEqual(document.lineage?.note, "Imported for replay validation");
    assert.strictEqual(verifyOperationalComparisonSnapshotIntegrity(document), true);

    const tampered = {
      ...document,
      lineage: {
        ...document.lineage,
        note: "Changed replay lineage"
      }
    };

    assert.strictEqual(validateComparisonSnapshotDocument(tampered).trustState, "Modified");
  });


});
