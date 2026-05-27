import { createHash } from "crypto";
import type { OperationalComparisonSnapshotDocument } from "./comparisonSnapshotTypes.js";

export const COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM = "sha256" as const;
export const COMPARISON_SNAPSHOT_CANONICALIZATION = "dvqr-snapshot-core-v1" as const;

export function calculateOperationalComparisonSnapshotHash(
  document: OperationalComparisonSnapshotDocument
): string {
  const canonicalDocument = removeSnapshotIntegrity(document);
  const payload = canonicalStringify(canonicalDocument);
  return `${COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM}:${createHash(COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM).update(payload, "utf8").digest("hex")}`;
}

export function verifyOperationalComparisonSnapshotIntegrity(
  document: OperationalComparisonSnapshotDocument
): boolean {
  if (!document.integrity?.contentHash) {
    return false;
  }

  if (document.integrity.algorithm !== COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM
    || document.integrity.canonicalization !== COMPARISON_SNAPSHOT_CANONICALIZATION) {
    return false;
  }

  return document.integrity.contentHash === calculateOperationalComparisonSnapshotHash(document);
}

function removeSnapshotIntegrity(document: OperationalComparisonSnapshotDocument): Omit<OperationalComparisonSnapshotDocument, "integrity"> {
  const { integrity: _integrity, ...canonicalDocument } = document;
  return canonicalDocument;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(toCanonicalJson(value));
}

function toCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalJson(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = toCanonicalJson(record[key]);
        return result;
      }, {});
  }

  return value;
}
