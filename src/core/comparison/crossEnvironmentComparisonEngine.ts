import { sortComparisonGroups } from "./comparisonOrdering.js";
import { calibrateComparisonDifference, maxComparisonSignificance } from "./comparisonSignificance.js";
import type {
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
    const groups = sortComparisonGroups(providerResults.flatMap((result) => result.groups));
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
