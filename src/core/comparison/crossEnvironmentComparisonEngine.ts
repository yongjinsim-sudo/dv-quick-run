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
        subjectLabel: context.subjectLabel ?? context.entityLogicalName
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

function toNearbyOperationalDrift(
  sourceGroup: ComparisonDriftGroup,
  relatedGroup: ComparisonDriftGroup,
  shared: readonly string[],
  index: number
): ComparisonNearbyOperationalDrift {
  const title = `${relatedGroup.title} additional drift also observed`;
  const evidence = [
    {
      label: "Additional drift surface",
      value: `${relatedGroup.title} contains ${relatedGroup.differences.length} drift signal${relatedGroup.differences.length === 1 ? "" : "s"}.`,
      source: "both" as const
    },
    ...(shared.length > 0 ? [{
      label: "Shared observed terms",
      value: shared.slice(0, 6).join(", "),
      source: "both" as const
    }] : []),
    {
      label: "Operational boundary",
      value: "Additional observed drift means present in the same bounded comparison scope. It does not imply chronology, causality, remediation, or root-cause certainty.",
      source: "both" as const
    }
  ];

  return {
    id: `${sourceGroup.id}-nearby-${relatedGroup.id}-${index}`,
    relatedGroupId: relatedGroup.id,
    relatedGroupTitle: relatedGroup.title,
    title,
    summary: `${relatedGroup.title} is also observed in this bounded comparison. Treat this as additional operational context for investigation orientation only.`,
    significance: relatedGroup.significance,
    differenceCount: relatedGroup.differences.length,
    evidence
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
