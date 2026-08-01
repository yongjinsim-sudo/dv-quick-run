import { describeRelationshipPurpose, explainRelationshipPath } from "./mcpRelationshipExplainability.js";

export function presentRelationshipExplainability(explanation: ReturnType<typeof explainRelationshipPath>) {
  return {
    metadataConfidence: explanation.confidenceDisplay,
    confidence: explanation.confidenceDisplay,
    confidenceKind: explanation.confidenceKind,
    businessConfidence: explanation.businessConfidence,
    ratingStars: explanation.ratingStars,
    confidenceLabel: explanation.confidenceLabel,
    purpose: {
      ...explanation.purpose,
      categoryCode: explanation.purpose.category,
      category: explanation.purpose.categoryLabel
    },
    whySelected: explanation.whySelected,
    whyNotFirst: explanation.whyNotFirst,
    diagnostics: {
      score: explanation.confidence,
      scoring: explanation.scoring
    }
  };
}

export function presentRelationshipPurpose(purpose: ReturnType<typeof describeRelationshipPurpose>) {
  return {
    ...purpose,
    categoryCode: purpose.category,
    category: purpose.categoryLabel
  };
}
