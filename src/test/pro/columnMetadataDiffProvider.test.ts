import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import type { EntityMetadataSnapshotPayload, SnapshotAttributeMetadata } from "../../product/comparison/comparisonSnapshotTypes.js";
import { ColumnMetadataDiffProvider } from "../../pro/comparison/index.js";

suite("ColumnMetadataDiffProvider", () => {
  test("returns no drift for identical column metadata", async () => {
    const provider = new ColumnMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [buildAttribute({ logicalName: "name", displayName: "Name", attributeType: "String" })]),
      buildEntityMetadataEvidenceSnapshot("SIT", [buildAttribute({ logicalName: "name", displayName: "Name", attributeType: "String" })])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.providerId, "column-metadata-diff");
    assert.strictEqual(result.groups.length, 0);
  });

  test("surfaces added and removed columns", async () => {
    const provider = new ColumnMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        buildAttribute({ logicalName: "name", displayName: "Name", attributeType: "String" }),
        buildAttribute({ logicalName: "legacycode", displayName: "Legacy Code", attributeType: "String" })
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildAttribute({ logicalName: "name", displayName: "Name", attributeType: "String" }),
        buildAttribute({ logicalName: "newcode", displayName: "New Code", attributeType: "String" })
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Column Metadata Drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.title === "Column missing in target: Legacy Code (legacycode)"));
    assert.ok(result.groups[0].differences.some((difference) => difference.title === "Column missing in source: New Code (newcode)"));
  });

  test("surfaces high-signal column property changes", async () => {
    const provider = new ColumnMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        buildAttribute({
          logicalName: "primarycontactid",
          displayName: "Primary Contact",
          attributeType: "Lookup",
          targets: ["contact"],
          isValidForUpdate: true
        })
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildAttribute({
          logicalName: "primarycontactid",
          displayName: "Primary Contact",
          attributeType: "Lookup",
          targets: ["account", "contact"],
          isValidForUpdate: false
        })
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    const differences = result.groups[0].differences;
    const targets = differences.find((difference) => difference.title.includes("Targets changed"));
    const update = differences.find((difference) => difference.title.includes("Is Valid For Update changed"));

    assert.ok(targets);
    assert.strictEqual(targets.significance, "High");
    assert.strictEqual(targets.sourceValue, "contact");
    assert.strictEqual(targets.targetValue, "account, contact");
    assert.ok(update);
    assert.strictEqual(update.significance, "High");
  });

  test("returns no drift for legacy snapshots without entity metadata", async () => {
    const provider = new ColumnMetadataDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: []
    });

    assert.strictEqual(result.groups.length, 0);
  });
});

function buildEntityMetadataEvidenceSnapshot(environmentLabel: string, attributes: readonly SnapshotAttributeMetadata[]) {
  const payload: EntityMetadataSnapshotPayload = {
    metadataVersion: "entity-metadata-payload-v1",
    entities: [
      {
        metadataVersion: "entity-metadata-v1",
        logicalName: "account",
        displayName: "Account",
        capturedAtIso: "2026-06-16T00:00:00.000Z",
        attributes,
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

function buildAttribute(attribute: SnapshotAttributeMetadata): SnapshotAttributeMetadata {
  return attribute;
}
