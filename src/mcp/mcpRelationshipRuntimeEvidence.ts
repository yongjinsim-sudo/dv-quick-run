import { describeRelationshipPurpose } from "./mcpRelationshipExplainability.js";
import type { McpRankedRelationshipPath } from "./mcpRelationshipIntelligence.js";

export type RuntimeEvidenceStatus = "TargetObserved" | "NoContinuationObserved" | "ProbeBudgetExhausted";

export interface McpRelationshipRuntimeObservation {
  readonly pathId: string;
  readonly tables: readonly string[];
  readonly targetTable: string;
  readonly family: string;
  readonly metadataScore: number;
  readonly status: RuntimeEvidenceStatus;
  readonly reachedTarget: boolean;
  readonly completedHops: number;
  readonly totalHops: number;
  readonly intermediateRowsObserved: number;
  readonly finalTargetRecordCount: number;
  readonly runtimeEvidenceScore: number;
  readonly investigationScore: number;
  readonly reasons: readonly string[];
}

const normalize = (value?: string) => (value ?? "").trim().toLowerCase();

export function relationshipPathFamily(path: McpRankedRelationshipPath): string {
  const first = path.hops[0];
  if (!first) {
    return "empty-path";
  }
  const token = `${normalize(first.referencingAttribute)} ${normalize(first.navigationProperty)} ${normalize(first.relationshipSchemaName)}`;
  if (path.hops.length === 1 && (token.includes("regardingobjectid") || token.includes("contact_tasks"))) {
    return "direct-activity-regarding";
  }
  if (path.hops.length === 1 && /(performer|requester|owner|patient|practitioner|relatedperson)/.test(token)) {
    return "direct-role-specific";
  }
  if (path.hops.length === 1) {
    return `direct-${describeRelationshipPurpose(first).category.toLowerCase()}`;
  }
  const bridges = path.bridgeTables.map(normalize).join("-");
  if (/careplan|care_plan|care plan/.test(bridges)) {
    return "bridged-care-plan-workflow";
  }
  return `bridged-${bridges || path.hops.length}`;
}

export function selectDiverseRelationshipPaths(
  ranked: readonly McpRankedRelationshipPath[],
  options: { readonly maxFamilies?: number; readonly maxCandidates?: number } = {}
): readonly McpRankedRelationshipPath[] {
  const maxFamilies = Math.max(1, Math.min(8, options.maxFamilies ?? 4));
  const maxCandidates = Math.max(1, Math.min(12, options.maxCandidates ?? 6));
  const selected: McpRankedRelationshipPath[] = [];
  const seenFamilies = new Set<string>();

  for (const path of ranked) {
    const family = relationshipPathFamily(path);
    if (seenFamilies.has(family)) {
      continue;
    }
    selected.push(path);
    seenFamilies.add(family);
    if (seenFamilies.size >= maxFamilies || selected.length >= maxCandidates) {
      break;
    }
  }

  if (selected.length < maxCandidates) {
    for (const path of ranked) {
      if (selected.some((candidate) => candidate.pathId === path.pathId)) {
        continue;
      }
      selected.push(path);
      if (selected.length >= maxCandidates) {
        break;
      }
    }
  }

  return selected;
}

export function buildRuntimeObservation(input: {
  readonly path: McpRankedRelationshipPath;
  readonly reachedTarget: boolean;
  readonly completedHops: number;
  readonly intermediateRowsObserved: number;
  readonly finalTargetRecordCount: number;
  readonly probeBudgetExhausted?: boolean;
}): McpRelationshipRuntimeObservation {
  const reasons: string[] = [];
  let runtimeEvidenceScore = 0;
  if (input.reachedTarget && input.finalTargetRecordCount > 0) {
    runtimeEvidenceScore += 30;
    reasons.push(`${input.finalTargetRecordCount} target record${input.finalTargetRecordCount === 1 ? " was" : "s were"} observed.`);
    if (input.finalTargetRecordCount > 1) {
      runtimeEvidenceScore += Math.min(10, input.finalTargetRecordCount * 2);
      reasons.push("Multiple target records strengthen the investigation-scoped runtime signal.");
    }
  } else if (input.probeBudgetExhausted) {
    runtimeEvidenceScore -= 2;
    reasons.push("The bounded probe budget ended before this path could be fully evaluated.");
  } else {
    runtimeEvidenceScore -= 10;
    reasons.push("No matching continuation data was observed for the sampled source record.");
  }
  if (input.intermediateRowsObserved > 0) {
    runtimeEvidenceScore += Math.min(15, 5 + input.intermediateRowsObserved);
    reasons.push(`${input.intermediateRowsObserved} intermediate continuation record${input.intermediateRowsObserved === 1 ? " was" : "s were"} observed.`);
  }

  return {
    pathId: input.path.pathId,
    tables: input.path.tables,
    targetTable: input.path.tables[input.path.tables.length - 1] ?? "",
    family: relationshipPathFamily(input.path),
    metadataScore: input.path.score,
    status: input.reachedTarget
      ? "TargetObserved"
      : input.probeBudgetExhausted
        ? "ProbeBudgetExhausted"
        : "NoContinuationObserved",
    reachedTarget: input.reachedTarget,
    completedHops: input.completedHops,
    totalHops: input.path.hops.length,
    intermediateRowsObserved: input.intermediateRowsObserved,
    finalTargetRecordCount: input.finalTargetRecordCount,
    runtimeEvidenceScore,
    investigationScore: input.path.score + runtimeEvidenceScore,
    reasons
  };
}

export function rankRuntimeObservations(
  observations: readonly McpRelationshipRuntimeObservation[]
): readonly McpRelationshipRuntimeObservation[] {
  return [...observations].sort((left, right) =>
    Number(right.reachedTarget) - Number(left.reachedTarget)
    || right.investigationScore - left.investigationScore
    || right.finalTargetRecordCount - left.finalTargetRecordCount
    || left.pathId.localeCompare(right.pathId)
  );
}
