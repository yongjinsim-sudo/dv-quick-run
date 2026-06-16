import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import type { EntityMetadataSnapshotPayload, SnapshotRelationshipMetadata } from "../../product/comparison/comparisonSnapshotTypes.js";
import { RelationshipMetadataDiffProvider } from "../../pro/comparison/index.js";

suite("RelationshipMetadataDiffProvider", () => {
  test("returns no drift for identical relationship metadata", async () => {
    const provider = new RelationshipMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [relationship({ schemaName: "account_primary_contact", relationshipType: "ManyToOne" })]),
      buildEntityMetadataEvidenceSnapshot("SIT", [relationship({ schemaName: "account_primary_contact", relationshipType: "ManyToOne" })])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.providerId, "relationship-metadata-diff");
    assert.strictEqual(result.groups.length, 0);
  });

  test("surfaces added and removed relationships", async () => {
    const provider = new RelationshipMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        relationship({ schemaName: "account_primary_contact", relationshipType: "ManyToOne", referencedEntity: "contact" }),
        relationship({ schemaName: "account_legacy_contact", relationshipType: "OneToMany", referencedEntity: "contact" })
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        relationship({ schemaName: "account_primary_contact", relationshipType: "ManyToOne", referencedEntity: "contact" }),
        relationship({ schemaName: "account_new_order", relationshipType: "OneToMany", referencedEntity: "salesorder" })
      ])
    ];

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots
    });

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Relationship Metadata Drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("Relationship removed: account_legacy_contact (Account → Contact, OneToMany)")));
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("Relationship added: account_new_order (Account → Salesorder, OneToMany)")));
  });

  test("surfaces relationship property changes", async () => {
    const provider = new RelationshipMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [
        relationship({
          schemaName: "account_primary_contact",
          relationshipType: "ManyToOne",
          referencingEntity: "account",
          referencedEntity: "contact",
          referencingAttribute: "primarycontactid",
          cascadeConfiguration: { Assign: "Cascade", Delete: "RemoveLink" }
        })
      ]),
      buildEntityMetadataEvidenceSnapshot("SIT", [
        relationship({
          schemaName: "account_primary_contact",
          relationshipType: "ManyToOne",
          referencingEntity: "account",
          referencedEntity: "contact",
          referencingAttribute: "new_primarycontactid",
          cascadeConfiguration: { Delete: "RemoveLink", Assign: "NoCascade" }
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
    const referencingAttribute = differences.find((difference) => difference.title.includes("Referencing Attribute changed"));
    const cascade = differences.find((difference) => difference.title.includes("Cascade Configuration changed"));

    assert.ok(referencingAttribute);
    assert.strictEqual(referencingAttribute.significance, "High");
    assert.ok(cascade);
    assert.strictEqual(cascade.significance, "Medium");
  });

  test("ignores one-sided relationship hydration detail for version compatibility", async () => {
    const provider = new RelationshipMetadataDiffProvider();
    const snapshots = [
      buildEntityMetadataEvidenceSnapshot("DEV", [relationship({ schemaName: "account_primary_contact", relationshipType: "ManyToOne" })]),
      buildEntityMetadataEvidenceSnapshot("SIT", [relationship({ schemaName: "account_primary_contact", relationshipType: "ManyToOne", cascadeConfiguration: { Assign: "Cascade" } })])
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
    const provider = new RelationshipMetadataDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: []
    });

    assert.strictEqual(result.groups.length, 0);
  });
});

function buildEntityMetadataEvidenceSnapshot(environmentLabel: string, relationships: readonly SnapshotRelationshipMetadata[]) {
  const payload: EntityMetadataSnapshotPayload = {
    metadataVersion: "entity-metadata-payload-v1",
    entities: [
      {
        metadataVersion: "entity-metadata-v1",
        logicalName: "account",
        displayName: "Account",
        capturedAtIso: "2026-06-16T00:00:00.000Z",
        attributes: [],
        relationships
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

function relationship(overrides: Partial<SnapshotRelationshipMetadata>): SnapshotRelationshipMetadata {
  return {
    schemaName: "account_primary_contact",
    relationshipType: "ManyToOne",
    referencingEntity: "account",
    referencedEntity: "contact",
    referencingAttribute: "primarycontactid",
    referencedAttribute: "contactid",
    navigationPropertyName: "primarycontactid",
    ...overrides
  };
}
