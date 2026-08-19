import type { BusinessPathArtifact, BusinessPathHop } from "./businessPathContracts.js";

const normalize = (value: string): string => value.trim().toLowerCase();

export function canonicalBusinessPathKey(
  sourceTable: string,
  targetTable: string,
  hops: readonly BusinessPathHop[]
): string {
  const hopKey = hops
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((hop) => [
      normalize(hop.fromTable),
      normalize(hop.relationshipSchemaName),
      hop.direction,
      normalize(hop.toTable)
    ].join(":"))
    .join("|");

  return `${normalize(sourceTable)}|${hopKey}|${normalize(targetTable)}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function businessPathId(
  sourceTable: string,
  targetTable: string,
  hops: readonly BusinessPathHop[]
): string {
  return `bp_${fnv1a32(canonicalBusinessPathKey(sourceTable, targetTable, hops))}`;
}

export function businessPathIdentityMatches(artifact: BusinessPathArtifact): boolean {
  return artifact.id === businessPathId(artifact.sourceTable, artifact.targetTable, artifact.hops);
}
