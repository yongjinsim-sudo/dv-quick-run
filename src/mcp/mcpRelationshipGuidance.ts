import type { McpRankedRelationshipPath } from "./mcpRelationshipIntelligence.js";
import { describeRelationshipPurpose, type RelationshipCategory } from "./mcpRelationshipExplainability.js";

export type RelationshipRecommendationBasis = "ExplicitRelationshipIntent" | "DeterministicMetadataRanking";
export type BusinessInterpretationStatus = "ExplicitlyRequested" | "MetadataOnlyUnknown";

export interface McpRelationshipPathGuidance {
  readonly recommendationBasis: RelationshipRecommendationBasis;
  readonly pathShape: "Direct" | "Bridged";
  readonly relationshipCategories: readonly RelationshipCategory[];
  readonly metadataPathSummary: string;
  readonly businessInterpretation: {
    readonly status: BusinessInterpretationStatus;
    readonly statement: string;
  };
  readonly instruction: string;
  readonly evidenceBoundary: string;
}

export function buildRelationshipPathGuidance(
  path: McpRankedRelationshipPath,
  options: { readonly relationshipHintHonoured?: boolean } = {}
): McpRelationshipPathGuidance {
  const categories = [...new Set(path.hops.map((hop) => describeRelationshipPurpose(hop).category))];
  const direct = path.hops.length === 1;
  const recommendationBasis: RelationshipRecommendationBasis = options.relationshipHintHonoured
    ? "ExplicitRelationshipIntent"
    : "DeterministicMetadataRanking";
  const route = path.tables.join(" → ");
  return {
    recommendationBasis,
    pathShape: direct ? "Direct" : "Bridged",
    relationshipCategories: categories,
    metadataPathSummary: direct
      ? `Direct metadata path: ${route}.`
      : `Metadata-verified traversal through ${path.bridgeTables.join(" → ")}: ${route}.`,
    businessInterpretation: options.relationshipHintHonoured
      ? {
          status: "ExplicitlyRequested",
          statement: "The caller explicitly selected this relationship, so it is safe to preserve that stated intent."
        }
      : {
          status: "MetadataOnlyUnknown",
          statement: "Metadata can rank traversal quality, but it cannot determine whether this path represents the organisation's intended business workflow."
        },
    instruction: options.relationshipHintHonoured
      ? "Use this path because it honours the explicitly requested relationship. Do not substitute a different relationship unless the caller changes the intent."
      : "Present this as the top metadata-ranked traversal, not as the definitive business path. Explain materially different alternatives and ask for business context when the distinction matters.",
    evidenceBoundary: "Metadata confidence covers relationship existence, direction and navigation resolution. It does not establish business preference or guarantee matching row data."
  };
}

export function classifyProbeOutcome(input: {
  readonly reachedTarget: boolean;
  readonly completedHops: number;
  readonly totalHops: number;
  readonly finalRecordCount: number;
}): {
  readonly status: "TargetObserved" | "NoContinuationObserved";
  readonly meaning: string;
  readonly nextAction: string;
} {
  if (input.reachedTarget) {
    return {
      status: "TargetObserved",
      meaning: `Matching target records were observed through all ${input.totalHops} verified hop${input.totalHops === 1 ? "" : "s"}.`,
      nextAction: "Use the generated query plan for this source record, while retaining the probe's bounded-evidence limitation."
    };
  }
  return {
    status: "NoContinuationObserved",
    meaning: `The probe completed ${input.completedHops} of ${input.totalHops} hop${input.totalHops === 1 ? "" : "s"} and observed ${input.finalRecordCount} continuing record${input.finalRecordCount === 1 ? "" : "s"} at the stopping point. This does not invalidate the metadata path.`,
    nextAction: "Try another representative source record or inspect the stopping hop's filters and relationship purpose before rejecting the path."
  };
}
