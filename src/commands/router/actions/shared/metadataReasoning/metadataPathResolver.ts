import { normalizeReasoningName } from "./metadataReasoningCommon.js";
import { deriveMetadataReasoningConfidence } from "./metadataConfidence.js";
import { rankMetadataPathCandidates, selectBestMetadataPathCandidate, hasAmbiguousTopCandidate } from "./metadataPathRanker.js";
import { searchMetadataPaths } from "./metadataPathSearch.js";
import type {
  MetadataReasoningClassification,
  MetadataReasoningGraph,
  MetadataReasoningResolveOptions,
  MetadataReasoningResolutionResult
} from "./metadataReasoningTypes.js";

const DEFAULT_QUERY_ASSIST_MAX_DEPTH = 2;
const DEFAULT_ADVISORY_MAX_DEPTH = 5;

export function resolveMetadataReasoning(
  graph: MetadataReasoningGraph,
  startEntity: string,
  targetField: string,
  options?: MetadataReasoningResolveOptions
): MetadataReasoningResolutionResult {
  const normalizedStartEntity = normalizeReasoningName(startEntity);
  const normalizedTargetField = normalizeReasoningName(targetField);
  const queryAssistMaxDepth = Math.max(0, options?.queryAssistMaxDepth ?? DEFAULT_QUERY_ASSIST_MAX_DEPTH);
  const advisoryMaxDepth = Math.max(queryAssistMaxDepth, options?.advisoryMaxDepth ?? DEFAULT_ADVISORY_MAX_DEPTH);

  const assistCandidates = rankMetadataPathCandidates(
    searchMetadataPaths(graph, normalizedStartEntity, normalizedTargetField, queryAssistMaxDepth)
  );
  const advisoryCandidates = rankMetadataPathCandidates(
    searchMetadataPaths(graph, normalizedStartEntity, normalizedTargetField, advisoryMaxDepth)
  );

  const classification = classifyCandidates(assistCandidates, advisoryCandidates);
  const confidence = deriveMetadataReasoningConfidence(classification, assistCandidates);
  const bestCandidate = selectBestMetadataPathCandidate(
    classification === "TooDeep" ? advisoryCandidates : assistCandidates
  );

  return {
    startEntity: normalizedStartEntity,
    targetField: normalizedTargetField,
    classification,
    confidence,
    matchedEntity: bestCandidate?.terminalEntity,
    matchedField: bestCandidate?.matchedField,
    hopCount: bestCandidate?.hopCount,
    bestCandidate,
    assistCandidates,
    advisoryCandidates,
    reasons: buildResolutionReasons(classification, normalizedStartEntity, normalizedTargetField, bestCandidate)
  };
}

function classifyCandidates(
  assistCandidates: MetadataReasoningResolutionResult["assistCandidates"],
  advisoryCandidates: MetadataReasoningResolutionResult["advisoryCandidates"]
): MetadataReasoningClassification {
  if (assistCandidates.length > 0) {
    if (hasAmbiguousTopCandidate(assistCandidates)) {
      return "Ambiguous";
    }

    const bestCandidate = assistCandidates[0];
    if (!bestCandidate) {
      return "NotFound";
    }

    if (bestCandidate.hopCount === 0) {
      return "Local";
    }

    if (bestCandidate.hopCount === 1) {
      return "Direct";
    }

    return "TwoHop";
  }

  if (advisoryCandidates.length > 0) {
    return "TooDeep";
  }

  return "NotFound";
}

function buildResolutionReasons(
  classification: MetadataReasoningClassification,
  startEntity: string,
  targetField: string,
  bestCandidate: MetadataReasoningResolutionResult["bestCandidate"]
): string[] {
  switch (classification) {
    case "Local":
      return [`Field '${targetField}' belongs to ${startEntity}.`];
    case "Direct":
      return [
        `Field '${targetField}' is not local to ${startEntity}, but is reachable on a directly related entity.`,
        ...(bestCandidate?.reasons ?? [])
      ];
    case "TwoHop":
      return [
        `Field '${targetField}' is reachable from ${startEntity} within the query-assist depth.`,
        ...(bestCandidate?.reasons ?? [])
      ];
    case "TooDeep":
      return [
        `Field '${targetField}' appears reachable from ${startEntity}, but only beyond the recommended query-assist depth.`,
        ...(bestCandidate?.reasons ?? [])
      ];
    case "Ambiguous":
      return [`Field '${targetField}' exists on multiple reachable entities with the same top-ranked hop depth.`];
    case "NotFound":
    default:
      return [`No plausible field match for '${targetField}' was found from ${startEntity}.`];
  }
}
