import { normalizeReasoningName } from "./metadataReasoningCommon.js";
import type { MetadataPathCandidate } from "./metadataReasoningTypes.js";

function uniqueTerminalEntityCount(candidates: MetadataPathCandidate[]): number {
  return new Set(candidates.map((candidate) => normalizeReasoningName(candidate.terminalEntity))).size;
}

function compareCandidates(left: MetadataPathCandidate, right: MetadataPathCandidate): number {
  if (left.hopCount !== right.hopCount) {
    return left.hopCount - right.hopCount;
  }

  if (left.pathSegments.length !== right.pathSegments.length) {
    return left.pathSegments.length - right.pathSegments.length;
  }

  return left.terminalEntity.localeCompare(right.terminalEntity, undefined, {
    sensitivity: "base"
  });
}

export function rankMetadataPathCandidates(candidates: MetadataPathCandidate[]): MetadataPathCandidate[] {
  return [...candidates].sort(compareCandidates);
}

export function selectBestMetadataPathCandidate(
  candidates: MetadataPathCandidate[]
): MetadataPathCandidate | undefined {
  return rankMetadataPathCandidates(candidates)[0];
}

export function hasAmbiguousTopCandidate(candidates: MetadataPathCandidate[]): boolean {
  if (candidates.length <= 1) {
    return false;
  }

  const ranked = rankMetadataPathCandidates(candidates);
  const best = ranked[0];
  const second = ranked[1];

  if (!best || !second) {
    return false;
  }

  if (best.hopCount !== second.hopCount) {
    return false;
  }

  return uniqueTerminalEntityCount([best, second]) > 1;
}
