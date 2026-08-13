import type { McpBusinessPathCandidate } from "./mcpBusinessPathDiscovery.js";
import type { McpRelationshipProbeResult } from "./mcpRelationshipProbeService.js";
import type { StructuredExecutionError } from "./mcpStructuredErrors.js";

export type McpBusinessPathRuntimeStatus =
  | "RuntimeViable"
  | "NoContinuationObserved"
  | "AccessLimited"
  | "ExecutionFailed"
  | "NotTested";

export interface McpValidatedBusinessPath {
  readonly pathId: string;
  readonly tables: readonly string[];
  readonly metadataBusinessScore: number;
  readonly metadataAssessment: McpBusinessPathCandidate["assessment"];
  readonly runtimeStatus: McpBusinessPathRuntimeStatus;
  readonly reachedTarget: boolean;
  readonly completedHops: number;
  readonly totalHops: number;
  readonly finalTargetRecordCount: number;
  /** Bounded count actually observed by the validator. Kept separate from any claim of an exact total. */
  readonly observedTargetRecordCount: number;
  readonly targetObservationBound: number;
  readonly targetCountBoundary: "BelowLimit" | "AtLimit" | "NotObserved";
  readonly breakHop?: number;
  readonly breakFromTable?: string;
  readonly breakToTable?: string;
  readonly breakRelationship?: string;
  readonly lastSuccessfulTable?: string;
  readonly lastSuccessfulRowCount?: number;
  readonly runtimeEvidenceScore: number;
  readonly combinedScore: number;
  readonly businessPreferred: "RuntimePreferred" | "RuntimeViableCandidate" | "NotRuntimeViable" | "Indeterminate" | "NotTested";
  readonly routeSemantics: "DirectRuntimeReachability" | "MultiHopBusinessTraversalCandidate";
  readonly businessAuthority: "RuntimeShortcut" | "RuntimeAlternative" | "AssertedBusinessTraversal" | "Unasserted";
  readonly steps: readonly unknown[];
  readonly executionError?: StructuredExecutionError;
}

export function validateBusinessPathResult(
  candidate: McpBusinessPathCandidate,
  probe: McpRelationshipProbeResult,
  observationBound: number,
  assertedBusinessTraversal = false
): McpValidatedBusinessPath {
  const observation = probe.observation;
  const rawSteps = probe.steps as ReadonlyArray<Record<string, unknown>>;
  const emptyIndex = rawSteps.findIndex((step) => Number(step.continuationRecordCount ?? 0) === 0 && step.status !== "ProbeBudgetExhausted");
  const budgetIndex = rawSteps.findIndex((step) => step.status === "ProbeBudgetExhausted");
  const breakIndex = emptyIndex >= 0 ? emptyIndex : budgetIndex;
  const breakStep = breakIndex >= 0 ? candidate.hops[breakIndex] : undefined;
  const runtimeStatus: McpBusinessPathRuntimeStatus = probe.reachedTarget
    ? "RuntimeViable"
    : budgetIndex >= 0
      ? "NotTested"
      : "NoContinuationObserved";
  const combinedScore = candidate.businessPathScore + observation.runtimeEvidenceScore;
  const observedTargetRecordCount = observation.finalTargetRecordCount;
  const targetCountBoundary: McpValidatedBusinessPath["targetCountBoundary"] = !probe.reachedTarget
    ? "NotObserved"
    : observedTargetRecordCount >= observationBound
      ? "AtLimit"
      : "BelowLimit";
  const priorStep = breakIndex > 0 ? rawSteps[breakIndex - 1] : undefined;

  return {
    pathId: candidate.pathId,
    tables: candidate.tables,
    metadataBusinessScore: candidate.businessPathScore,
    metadataAssessment: candidate.assessment,
    runtimeStatus,
    reachedTarget: probe.reachedTarget,
    completedHops: observation.completedHops,
    totalHops: observation.totalHops,
    finalTargetRecordCount: observation.finalTargetRecordCount,
    observedTargetRecordCount,
    targetObservationBound: observationBound,
    targetCountBoundary,
    breakHop: breakStep ? breakIndex + 1 : undefined,
    breakFromTable: breakStep?.fromTable,
    breakToTable: breakStep?.toTable,
    breakRelationship: breakStep?.relationshipSchemaName ?? breakStep?.navigationProperty,
    lastSuccessfulTable: breakIndex > 0 ? candidate.tables[breakIndex] : candidate.tables[0],
    lastSuccessfulRowCount: breakIndex > 0 ? Number(priorStep?.continuationRecordCount ?? 0) : 1,
    runtimeEvidenceScore: observation.runtimeEvidenceScore,
    combinedScore,
    businessPreferred: probe.reachedTarget
      ? "RuntimeViableCandidate"
      : runtimeStatus === "NotTested"
        ? "NotTested"
        : "NotRuntimeViable",
    routeSemantics: candidate.hops.length === 1 ? "DirectRuntimeReachability" : "MultiHopBusinessTraversalCandidate",
    businessAuthority: assertedBusinessTraversal
      ? "AssertedBusinessTraversal"
      : candidate.hops.length === 1 ? "RuntimeShortcut" : "RuntimeAlternative",
    steps: probe.steps
  };
}

export function failedBusinessPathResult(
  candidate: McpBusinessPathCandidate,
  error: StructuredExecutionError,
  assertedBusinessTraversal = false
): McpValidatedBusinessPath {
  const accessLimited = error.http?.status === 403 || error.dataverse?.category === "AccessDenied";
  return {
    pathId: candidate.pathId,
    tables: candidate.tables,
    metadataBusinessScore: candidate.businessPathScore,
    metadataAssessment: candidate.assessment,
    runtimeStatus: accessLimited ? "AccessLimited" : "ExecutionFailed",
    reachedTarget: false,
    completedHops: 0,
    totalHops: candidate.hops.length,
    finalTargetRecordCount: 0,
    observedTargetRecordCount: 0,
    targetObservationBound: 0,
    targetCountBoundary: "NotObserved",
    breakHop: 1,
    breakFromTable: candidate.hops[0]?.fromTable,
    breakToTable: candidate.hops[0]?.toTable,
    breakRelationship: candidate.hops[0]?.relationshipSchemaName ?? candidate.hops[0]?.navigationProperty,
    lastSuccessfulTable: candidate.tables[0],
    lastSuccessfulRowCount: 1,
    runtimeEvidenceScore: 0,
    combinedScore: candidate.businessPathScore,
    businessPreferred: accessLimited ? "Indeterminate" : "Indeterminate",
    routeSemantics: candidate.hops.length === 1 ? "DirectRuntimeReachability" : "MultiHopBusinessTraversalCandidate",
    businessAuthority: assertedBusinessTraversal ? "AssertedBusinessTraversal" : candidate.hops.length === 1 ? "RuntimeShortcut" : "Unasserted",
    steps: [],
    executionError: error
  };
}

export function notTestedBusinessPathResult(candidate: McpBusinessPathCandidate, assertedBusinessTraversal = false): McpValidatedBusinessPath {
  return {
    pathId: candidate.pathId,
    tables: candidate.tables,
    metadataBusinessScore: candidate.businessPathScore,
    metadataAssessment: candidate.assessment,
    runtimeStatus: "NotTested",
    reachedTarget: false,
    completedHops: 0,
    totalHops: candidate.hops.length,
    finalTargetRecordCount: 0,
    observedTargetRecordCount: 0,
    targetObservationBound: 0,
    targetCountBoundary: "NotObserved",
    runtimeEvidenceScore: 0,
    combinedScore: candidate.businessPathScore,
    businessPreferred: "NotTested",
    routeSemantics: candidate.hops.length === 1 ? "DirectRuntimeReachability" : "MultiHopBusinessTraversalCandidate",
    businessAuthority: assertedBusinessTraversal ? "AssertedBusinessTraversal" : candidate.hops.length === 1 ? "RuntimeShortcut" : "Unasserted",
    steps: []
  };
}

export function rankValidatedBusinessPaths(
  validated: readonly McpValidatedBusinessPath[]
): readonly McpValidatedBusinessPath[] {
  const statusPriority = (value: McpBusinessPathRuntimeStatus): number => {
    switch (value) {
      case "RuntimeViable": return 5;
      case "AccessLimited": return 4;
      case "NoContinuationObserved": return 3;
      case "ExecutionFailed": return 2;
      case "NotTested": return 1;
    }
  };
  const ranked = [...validated].sort((left, right) =>
    statusPriority(right.runtimeStatus) - statusPriority(left.runtimeStatus)
    || right.combinedScore - left.combinedScore
    || right.finalTargetRecordCount - left.finalTargetRecordCount
    || right.metadataBusinessScore - left.metadataBusinessScore
    || left.pathId.localeCompare(right.pathId)
  );
  const winnerIndex = ranked.findIndex((item) => item.reachedTarget);
  return ranked.map((item, index) => ({
    ...item,
    businessPreferred: index === winnerIndex && item.reachedTarget ? "RuntimePreferred" : item.businessPreferred
  }));
}
