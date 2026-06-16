import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import type {
  EntityMetadataSnapshotPayload,
  SnapshotAttributeMetadata,
  SnapshotOptionMetadata,
  SnapshotOptionSetMetadata
} from "../../product/comparison/comparisonSnapshotTypes.js";
import { ChoiceMetadataDiffProvider } from "../../pro/comparison/index.js";

suite("ChoiceMetadataDiffProvider", () => {
  test("returns no drift for identical choice metadata", async () => {
    const provider = new ChoiceMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [buildChoiceAttribute("statuscode", "Status", buildOptionSet([option(1, "Active")]))]),
      buildEntityMetadataEvidenceSnapshot("SIT", [buildChoiceAttribute("statuscode", "Status", buildOptionSet([option(1, "Active")]))])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.providerId, "choice-metadata-diff");
    assert.strictEqual(result.groups.length, 0);
  });

  test("surfaces added and removed choice options", async () => {
    const provider = new ChoiceMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        buildChoiceAttribute("statuscode", "Status", buildOptionSet([option(1, "Active"), option(2, "Inactive")]))
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildChoiceAttribute("statuscode", "Status", buildOptionSet([option(1, "Active"), option(3, "Pending")]))
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Choice Metadata Drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.title === "Status option removed: Inactive (2)"));
    assert.ok(result.groups[0].differences.some((difference) => difference.title === "Status option added: Pending (3)"));
  });

  test("surfaces option label changes without treating value identity as changed", async () => {
    const provider = new ChoiceMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        buildChoiceAttribute("accountcategorycode", "Category", buildOptionSet([option(1, "Preferred Customer")], { isGlobal: true }))
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildChoiceAttribute("accountcategorycode", "Category", buildOptionSet([option(1, "Priority Customer")], { isGlobal: true }))
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    const differences = result.groups[0].differences;
    const label = differences.find((difference) => difference.title.includes("Category option label changed"));

    assert.ok(label);
    assert.strictEqual(label.kind, "Configuration Drift");
    assert.strictEqual(label.sourceValue, "Preferred Customer");
    assert.strictEqual(label.targetValue, "Priority Customer");
  });

  test("surfaces higher-signal option set property changes", async () => {
    const provider = new ChoiceMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        buildChoiceAttribute("tags", "Tags", buildOptionSet([option(1, "A")], { isMultiSelect: false, defaultValue: 1 }))
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildChoiceAttribute("tags", "Tags", buildOptionSet([option(1, "A")], { isMultiSelect: true, defaultValue: 2 }))
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    const multiSelect = result.groups[0].differences.find((difference) => difference.title.includes("Is Multi Select changed"));
    const defaultValue = result.groups[0].differences.find((difference) => difference.title.includes("Default Value changed"));

    assert.ok(multiSelect);
    assert.strictEqual(multiSelect.significance, "Medium");
    assert.ok(defaultValue);
    assert.strictEqual(defaultValue.significance, "Medium");
  });

  test("does not treat global/local capture semantics as choice set remove/add", async () => {
    const provider = new ChoiceMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        buildChoiceAttribute("creditonhold", "Credit Hold", buildOptionSet([option(0, "No"), option(1, "Yes")], { name: "account_creditonhold", isGlobal: true }))
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildChoiceAttribute("creditonhold", "Credit Hold", buildOptionSet([option(0, "No"), option(1, "Yes")], { name: "account_creditonhold", isGlobal: false }))
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.groups.length, 0);
  });

  test("ignores option set capture hydration when the column exists on both sides", async () => {
    const provider = new ChoiceMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        { logicalName: "creditonhold", schemaName: "CreditOnHold", displayName: "Credit Hold", attributeType: "Boolean" }
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        buildChoiceAttribute("creditonhold", "Credit Hold", buildOptionSet([option(0, "No"), option(1, "Yes")], { name: "account_creditonhold" }))
      ])
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
    const provider = new ChoiceMetadataDiffProvider();
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

function buildChoiceAttribute(logicalName: string, displayName: string, optionSet: SnapshotOptionSetMetadata): SnapshotAttributeMetadata {
  return {
    logicalName,
    schemaName: logicalName,
    displayName,
    attributeType: optionSet.isMultiSelect ? "MultiSelectPicklist" : "Picklist",
    optionSet
  };
}

function buildOptionSet(
  options: readonly SnapshotOptionMetadata[],
  overrides: Partial<SnapshotOptionSetMetadata> = {}
): SnapshotOptionSetMetadata {
  return {
    name: "account_statuscode",
    isGlobal: false,
    isMultiSelect: false,
    options,
    ...overrides
  };
}

function option(value: number, label: string): SnapshotOptionMetadata {
  return {
    value,
    label,
    normalizedLabel: label.trim().toLowerCase()
  };
}
