import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import type {
  EntityMetadataSnapshotPayload,
  SnapshotEntityConfigurationMetadata
} from "../../product/comparison/comparisonSnapshotTypes.js";
import { EntityConfigurationDiffProvider } from "../../pro/comparison/index.js";

suite("EntityConfigurationDiffProvider", () => {
  test("returns no drift for identical entity configuration", async () => {
    const provider = new EntityConfigurationDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", { ownershipType: "UserOwned", isAuditEnabled: true }),
      buildEntityMetadataEvidenceSnapshot("SIT", { ownershipType: "UserOwned", isAuditEnabled: true })
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.providerId, "entity-configuration-diff");
    assert.strictEqual(result.groups.length, 0);
  });

  test("surfaces high-signal ownership and change tracking drift", async () => {
    const provider = new EntityConfigurationDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", {
        entitySetName: "accounts",
        ownershipType: "UserOwned",
        changeTrackingEnabled: false
      }),
      buildEntityMetadataEvidenceSnapshot("SIT", {
        entitySetName: "accounts",
        ownershipType: "OrganizationOwned",
        changeTrackingEnabled: true
      })
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Entity Configuration Drift");
    assert.strictEqual(result.groups[0].significance, "High");

    const ownership = result.groups[0].differences.find((difference) => difference.title.includes("Ownership Type changed"));
    const changeTracking = result.groups[0].differences.find((difference) => difference.title.includes("Change Tracking Enabled changed"));

    assert.ok(ownership);
    assert.strictEqual(ownership.significance, "High");
    assert.strictEqual(ownership.sourceValue, "UserOwned");
    assert.strictEqual(ownership.targetValue, "OrganizationOwned");
    assert.ok(changeTracking);
    assert.strictEqual(changeTracking.significance, "High");
  });

  test("surfaces medium-signal audit drift", async () => {
    const provider = new EntityConfigurationDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", { isAuditEnabled: false }),
      buildEntityMetadataEvidenceSnapshot("SIT", { isAuditEnabled: true })
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    const audit = result.groups[0].differences.find((difference) => difference.title.includes("Audit Enabled changed"));
    assert.ok(audit);
    assert.strictEqual(audit.significance, "Medium");
  });

  test("ignores one-sided configuration hydration for legacy compatibility", async () => {
    const provider = new EntityConfigurationDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", { ownershipType: "UserOwned" }),
      buildEntityMetadataEvidenceSnapshot("SIT", { ownershipType: "UserOwned", isAuditEnabled: true })
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.groups.length, 0);
  });

  test("returns no drift for legacy snapshots without entity metadata", async () => {
    const provider = new EntityConfigurationDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: []
    });

    assert.strictEqual(result.groups.length, 0);
  });
});

function buildEntityMetadataEvidenceSnapshot(
  environmentLabel: string,
  configuration: SnapshotEntityConfigurationMetadata
) {
  const payload: EntityMetadataSnapshotPayload = {
    metadataVersion: "entity-metadata-payload-v1",
    entities: [
      {
        metadataVersion: "entity-metadata-v1",
        logicalName: "account",
        displayName: "Account",
        capturedAtIso: "2026-06-16T00:00:00.000Z",
        configuration,
        attributes: [],
        relationships: []
      }
    ]
  };

  return createComparisonEvidenceSnapshot({
    environment: { label: environmentLabel },
    evidenceType: "EntityMetadata",
    sourceFeature: "Operational Profile / Metadata",
    capturedAt: new Date("2026-06-16T00:00:00.000Z"),
    evidence: payload
  });
}
