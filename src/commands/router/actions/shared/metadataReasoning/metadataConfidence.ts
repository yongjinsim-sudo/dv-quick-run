import type {
  MetadataPathCandidate,
  MetadataReasoningClassification,
  MetadataReasoningConfidence
} from "./metadataReasoningTypes.js";

export function deriveMetadataReasoningConfidence(
  classification: MetadataReasoningClassification,
  assistCandidates: MetadataPathCandidate[]
): MetadataReasoningConfidence {
  switch (classification) {
    case "Local":
      return "High";
    case "Direct":
      return assistCandidates.length === 1 ? "High" : "Medium";
    case "TwoHop":
      return assistCandidates.length === 1 ? "Medium" : "Low";
    case "TooDeep":
      return "Low";
    case "Ambiguous":
      return "Low";
    case "NotFound":
    default:
      return "Low";
  }
}
