import * as assert from "assert";
import {
  buildChoiceKey,
  buildColumnKey,
  buildGlobalChoiceKey,
  buildRelationshipKey,
  diffArrayProperty,
  diffPrimitiveProperty,
  diffRecordProperty,
  extractEntityMetadataSnapshots,
  findEntityMetadataSnapshot,
  normalizeCascadeConfiguration,
  normalizeLabel,
  normalizeLogicalName,
  normalizeTargets
} from "../../pro/comparison/metadata/index.js";
import type {
  ComparisonEvidenceSnapshot,
  EntityMetadataSnapshotPayload,
  SnapshotRelationshipMetadata
} from "../../product/comparison/comparisonSnapshotTypes.js";

suite("metadata diff helpers", () => {
  test("builds stable column and choice keys", () => {
    assert.strictEqual(buildColumnKey("Account", "Name"), "column|account|name");
    assert.strictEqual(buildChoiceKey("Account", "StatusCode", 1), "choice|account|statuscode|1");
    assert.strictEqual(buildChoiceKey("Account", "IsPrivate", true), "choice|account|isprivate|true");
    assert.strictEqual(buildGlobalChoiceKey("My Global Choice", 100000001), "globalChoice|my global choice|100000001");
  });

  test("builds stable relationship keys from relationship identity", () => {
    const relationship: SnapshotRelationshipMetadata = {
      schemaName: "account_primary_contact",
      relationshipType: "ManyToOne",
      referencingEntity: "account",
      referencedEntity: "contact",
      referencingAttribute: "primarycontactid",
      navigationPropertyName: "primarycontactid"
    };

    assert.strictEqual(
      buildRelationshipKey(relationship),
      "relationship|manytoone|account_primary_contact|primarycontactid|account|contact|primarycontactid||"
    );
  });

  test("normalizes labels, logical names, targets, and cascade configuration", () => {
    assert.strictEqual(normalizeLabel("  Preferred   Customer  "), "preferred customer");
    assert.strictEqual(normalizeLogicalName(" Account "), "account");
    assert.deepStrictEqual(normalizeTargets(["contact", "Account", "contact", "  lead  "]), ["Account", "contact", "lead"]);
    assert.deepStrictEqual(normalizeCascadeConfiguration({ Assign: "Cascade", Delete: undefined, Share: " NoCascade " }), {
      Assign: "Cascade",
      Share: "NoCascade"
    });
  });

  test("detects primitive, array, and record property changes", () => {
    const source = {
      requiredLevel: "None",
      targets: ["contact", "account"],
      cascadeConfiguration: { Assign: "Cascade", Delete: "RemoveLink" }
    };
    const sameTarget = {
      requiredLevel: "None",
      targets: ["account", "contact"],
      cascadeConfiguration: { Delete: "RemoveLink", Assign: "Cascade" }
    };
    const changedTarget = {
      requiredLevel: "SystemRequired",
      targets: ["lead"],
      cascadeConfiguration: { Assign: "NoCascade", Delete: "RemoveLink" }
    };

    assert.strictEqual(diffPrimitiveProperty(source, sameTarget, "requiredLevel"), undefined);
    assert.strictEqual(diffArrayProperty(source, sameTarget, "targets"), undefined);
    assert.strictEqual(diffRecordProperty(source, sameTarget, "cascadeConfiguration"), undefined);

    assert.deepStrictEqual(diffPrimitiveProperty(source, changedTarget, "requiredLevel"), {
      property: "requiredLevel",
      sourceValue: "None",
      targetValue: "SystemRequired"
    });
    assert.deepStrictEqual(diffArrayProperty(source, changedTarget, "targets"), {
      property: "targets",
      sourceValue: ["contact", "account"],
      targetValue: ["lead"]
    });
    assert.deepStrictEqual(diffRecordProperty(source, changedTarget, "cascadeConfiguration"), {
      property: "cascadeConfiguration",
      sourceValue: { Assign: "Cascade", Delete: "RemoveLink" },
      targetValue: { Assign: "NoCascade", Delete: "RemoveLink" }
    });
  });

  test("extracts entity metadata payloads from comparison evidence snapshots", () => {
    const payload: EntityMetadataSnapshotPayload = {
      metadataVersion: "entity-metadata-payload-v1",
      entities: [
        {
          metadataVersion: "entity-metadata-v1",
          logicalName: "account",
          displayName: "Account",
          capturedAtIso: "2026-06-16T00:00:00.000Z",
          attributes: [],
          relationships: []
        }
      ]
    };
    const snapshots: ComparisonEvidenceSnapshot[] = [
      {
        environment: { label: "DEV" },
        evidenceType: "EntityMetadata",
        metadata: {
          snapshotVersion: "comparison-snapshot-v1",
          capturedAtIso: "2026-06-16T00:00:00.000Z",
          sourceFeature: "Operational Profile / Metadata"
        },
        evidence: payload
      }
    ];

    assert.strictEqual(extractEntityMetadataSnapshots(snapshots).length, 1);
    assert.strictEqual(findEntityMetadataSnapshot(snapshots, "ACCOUNT")?.displayName, "Account");
  });
});
