import * as assert from "assert";
import { getComparisonEntityLogicalName } from "../../commands/comparison/comparisonSnapshotSelection.js";
import type { ComparisonSnapshotFile } from "../../commands/comparison/comparisonSnapshotSelection.js";

function snapshot(evidenceType: string, evidence: unknown): ComparisonSnapshotFile {
  return {
    environment: { label: "DEV" },
    evidenceType,
    metadata: { capturedAtIso: "2026-06-16T00:00:00.000Z" },
    evidence
  };
}

suite("comparison snapshot selection", () => {
  test("uses Operational Profile entity logical name before nested metadata attributes", () => {
    const logicalName = getComparisonEntityLogicalName([
      snapshot("OperationalProfile", {
        kind: "entityOperationalProfile",
        entityLogicalName: "account",
        entityDisplayName: "Account",
        nested: { logicalName: "address1_addressid" }
      }),
      snapshot("EntityMetadata", {
        metadataVersion: "entity-metadata-payload-v1",
        entities: [
          {
            metadataVersion: "entity-metadata-v1",
            logicalName: "account",
            attributes: [{ logicalName: "address1_addressid" }],
            relationships: []
          }
        ]
      })
    ]);

    assert.strictEqual(logicalName, "account");
  });

  test("returns undefined when selected snapshots contain different root subjects", () => {
    const logicalName = getComparisonEntityLogicalName([
      snapshot("OperationalProfile", { entityLogicalName: "account" }),
      snapshot("OperationalProfile", { entityLogicalName: "contact" })
    ]);

    assert.strictEqual(logicalName, undefined);
  });
});
