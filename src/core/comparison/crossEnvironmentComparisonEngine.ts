import { sortComparisonGroups } from "./comparisonOrdering.js";
import { calibrateComparisonDifference, maxComparisonSignificance } from "./comparisonSignificance.js";
import type {
  ComparisonDriftGroup,
  ComparisonNearbyOperationalDrift,
  ComparisonOperationalSignificance,
  ComparisonProvider,
  ComparisonProviderContext,
  ComparisonProviderResult,
  ComparisonViewModel
} from "./comparisonTypes.js";

export class CrossEnvironmentComparisonEngine {
  public constructor(private readonly providers: readonly ComparisonProvider[]) {}

  public async compare(context: ComparisonProviderContext): Promise<ComparisonViewModel> {
    const rawProviderResults = await Promise.all(this.providers.map((provider) => provider.compare(context)));
    const providerResults = rawProviderResults.map((result) => ({
      ...result,
      groups: result.groups.map((group) => {
        const differences = group.differences.map(calibrateComparisonDifference);
        const significance = differences.reduce(
          (current, difference) => maxComparisonSignificance(current, difference.significance),
          group.significance
        );

        return {
          ...group,
          significance,
          differences
        };
      })
    }));
    const orderedGroups = sortComparisonGroups(providerResults.flatMap((result) => result.groups));
    const groups = addNearbyOperationalDrift(orderedGroups);
    const differences = groups.flatMap((group) => group.differences);

    const subjectTitlePart = context.subjectLabel ? `${context.subjectLabel} · ` : "";

    return {
      title: `Cross-Environment Diff: ${subjectTitlePart}${context.source.label} → ${context.target.label}`,
      summary: {
        sourceLabel: context.source.label,
        targetLabel: context.target.label,
        sourceCapturedAtIso: context.source.capturedAtIso,
        targetCapturedAtIso: context.target.capturedAtIso,
        highCount: differences.filter((difference) => difference.significance === "High").length,
        mediumCount: differences.filter((difference) => difference.significance === "Medium").length,
        lowCount: differences.filter((difference) => difference.significance === "Low").length,
        providerCount: providerResults.length,
        differenceCount: differences.length,
        subjectLabel: context.subjectLabel ?? context.entityLogicalName,
        entityLogicalName: context.entityLogicalName
      },
      groups,
      providerResults
    };
  }
}

export function createCrossEnvironmentComparisonEngine(
  providers: readonly ComparisonProvider[]
): CrossEnvironmentComparisonEngine {
  return new CrossEnvironmentComparisonEngine(providers);
}

export function createEmptyComparisonProviderResult(providerId: string, title: string): ComparisonProviderResult {
  return {
    providerId,
    title,
    groups: []
  };
}


function addNearbyOperationalDrift(groups: readonly ComparisonDriftGroup[]): readonly ComparisonDriftGroup[] {
  if (groups.length <= 1) {
    return groups;
  }

  return groups.map((group) => {
    const nearby = buildNearbyOperationalDrift(group, groups);
    return nearby.length > 0 ? { ...group, nearbyOperationalDrift: nearby } : group;
  });
}

function buildNearbyOperationalDrift(
  group: ComparisonDriftGroup,
  groups: readonly ComparisonDriftGroup[]
): readonly ComparisonNearbyOperationalDrift[] {
  const groupTerms = collectGroupTerms(group);

  return groups
    .filter((candidate) => candidate.id !== group.id && candidate.differences.length > 0)
    .map((candidate) => ({
      group: candidate,
      sharedTerms: sharedTerms(groupTerms, collectGroupTerms(candidate)),
      score: scoreNearbyCandidate(group, candidate, groupTerms)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      const score = right.score - left.score;
      if (score !== 0) {
        return score;
      }

      return left.group.title.localeCompare(right.group.title);
    })
    .slice(0, 3)
    .map((candidate, index) => toNearbyOperationalDrift(group, candidate.group, candidate.sharedTerms, index));
}

function scoreNearbyCandidate(
  sourceGroup: ComparisonDriftGroup,
  candidateGroup: ComparisonDriftGroup,
  sourceTerms: ReadonlySet<string>
): number {
  const domainScore = scoreDomainAdjacency(sourceGroup.id, candidateGroup.id);
  const termScore = sharedTerms(sourceTerms, collectGroupTerms(candidateGroup)).length * 2;
  const significanceScore = significanceRank(candidateGroup.significance);
  const densityScore = Math.min(candidateGroup.differences.length, 5);

  return domainScore + termScore + significanceScore + densityScore;
}

function scoreDomainAdjacency(sourceGroupId: string, candidateGroupId: string): number {
  const source = classifyGroupDomain(sourceGroupId);
  const target = classifyGroupDomain(candidateGroupId);

  if (source === target) {
    return 0;
  }

  if (source === "identity" && (target === "workflow" || target === "plugin" || target === "solution" || target === "profile")) {
    return 6;
  }

  if ((source === "workflow" || source === "plugin") && (target === "identity" || target === "solution" || target === "profile")) {
    return 6;
  }

  if (source === "solution" && (target === "workflow" || target === "plugin" || target === "identity")) {
    return 5;
  }

  if (source === "profile" && target !== "profile") {
    return 4;
  }

  return 2;
}

function classifyGroupDomain(groupId: string): "identity" | "workflow" | "plugin" | "solution" | "profile" | "other" {
  const normalized = groupId.toLowerCase();
  if (normalized.includes("identity")) {
    return "identity";
  }

  if (normalized.includes("workflow") || normalized.includes("automation")) {
    return "workflow";
  }

  if (normalized.includes("plugin")) {
    return "plugin";
  }

  if (normalized.includes("solution")) {
    return "solution";
  }

  if (normalized.includes("profile")) {
    return "profile";
  }

  return "other";
}

function getOperationalSignificanceWeight(significance: string): number {
  if (significance === "High") {
    return 3;
  }

  if (significance === "Medium") {
    return 2;
  }

  return 1;
}

function buildRepresentativeSignals(group: ComparisonDriftGroup) {
  return [...group.differences]
    .sort((left, right) => {
      const significanceDelta = getOperationalSignificanceWeight(right.significance) - getOperationalSignificanceWeight(left.significance);
      if (significanceDelta !== 0) {
        return significanceDelta;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 3)
    .map((difference) => ({
      title: difference.title,
      kind: difference.kind,
      significance: difference.significance
    }));
}

function toNearbyOperationalDrift(
  sourceGroup: ComparisonDriftGroup,
  relatedGroup: ComparisonDriftGroup,
  _shared: readonly string[],
  index: number
): ComparisonNearbyOperationalDrift {
  const orientation = buildNearbyOrientationCue(sourceGroup.id, relatedGroup.id);
  const title = `${orientation.label}: ${relatedGroup.title}`;
  const evidence = [
    {
      label: "Related provider",
      value: `${relatedGroup.title} contains ${relatedGroup.differences.length} drift signal${relatedGroup.differences.length === 1 ? "" : "s"}.`,
      source: "both" as const
    },
    {
      label: "Operational boundary",
      value: "Nearby drift is adjacency context in the same bounded comparison. It does not imply chronology, causality, remediation, or root-cause certainty.",
      source: "both" as const
    }
  ];

  return {
    id: `${sourceGroup.id}-nearby-${relatedGroup.id}-${index}`,
    relatedGroupId: relatedGroup.id,
    relatedGroupTitle: relatedGroup.title,
    orientationCue: orientation.label,
    orientationSummary: orientation.summary,
    title,
    summary: orientation.summary,
    significance: relatedGroup.significance,
    differenceCount: relatedGroup.differences.length,
    evidence,
    representativeSignals: buildRepresentativeSignals(relatedGroup)
  };
}

function buildNearbyOrientationCue(
  sourceGroupId: string,
  relatedGroupId: string
): { readonly label: string; readonly summary: string } {
  const source = classifyGroupDomain(sourceGroupId);
  const related = classifyGroupDomain(relatedGroupId);

  if (related === "workflow") {
    return {
      label: "Adjacent orchestration drift",
      summary: "Review activation, owner, real-time/background, and orchestration participation differences outside the plugin pipeline."
    };
  }

  if (related === "plugin") {
    return {
      label: "Adjacent runtime drift",
      summary: "Review enablement, execution stage, mode, order, and filtering-attribute drift that can change runtime behaviour."
    };
  }

  if (related === "identity") {
    return {
      label: source === "workflow" || source === "plugin" ? "Adjacent identity participation" : "Identity participation context",
      summary: "Review user, team, role, or app-user participation differences that may affect operational participation."
    };
  }

  if (related === "solution") {
    return {
      label: "Package participation context",
      summary: "Review managed state, version, and package presence differences that may explain component-layering changes."
    };
  }

  if (related === "profile") {
    return {
      label: "Operational density context",
      summary: "Review density changes to understand which operational dimensions became more or less complex."
    };
  }

  return {
    label: "Additional bounded context",
    summary: "Review this provider when its signals answer a distinct operational verification question."
  };
}

function collectGroupTerms(group: ComparisonDriftGroup): ReadonlySet<string> {
  const values = group.differences.flatMap((difference) => [
    difference.title,
    difference.summary,
    difference.sourceValue,
    difference.targetValue,
    ...difference.evidence.flatMap((evidence) => [evidence.label, evidence.value])
  ]);

  return new Set(values.flatMap((value) => tokenize(value)));
}

function sharedTerms(left: ReadonlySet<string>, right: ReadonlySet<string>): readonly string[] {
  return [...left].filter((term) => right.has(term)).sort((a, b) => a.localeCompare(b));
}

function tokenize(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }

  const stopWords = new Set([
    "added",
    "authority",
    "between",
    "changed",
    "context",
    "dev",
    "difference",
    "differs",
    "drift",
    "environment",
    "evidence",
    "observed",
    "only",
    "operational",
    "participation",
    "removed",
    "review",
    "signal",
    "signals",
    "source",
    "target",
    "treat",
    "visible"
  ]);

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function significanceRank(value: ComparisonOperationalSignificance): number {
  return value === "High" ? 3 : value === "Medium" ? 2 : 1;
}
