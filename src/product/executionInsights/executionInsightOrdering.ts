import type { BinderSuggestion } from "../binder/binderTypes.js";

function getInvestigationPriority(suggestion: BinderSuggestion): number {
  const value = suggestion.payload?.investigationPriority;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const severity = suggestion.payload?.severity;
  if (severity === "high") {
    return 3;
  }

  if (severity === "medium") {
    return 2;
  }

  if (severity === "low") {
    return 1;
  }

  return 0;
}

function isPrimarySignal(suggestion: BinderSuggestion): boolean {
  return suggestion.payload?.isPrimarySignal === true;
}

/**
 * Shared deterministic ordering for Execution Insight cards.
 *
 * Ordering is intentionally source-agnostic:
 * 1. model-provided primary investigation signals first
 * 2. higher investigation priority
 * 3. higher confidence
 * 4. stable original order / text fallback
 *
 * This helper must not infer root cause or perform hidden source-specific ranking.
 */
export function orderExecutionInsightSuggestions(suggestions: BinderSuggestion[]): BinderSuggestion[] {
  return suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .sort((a, b) => {
      const aPrimary = isPrimarySignal(a.suggestion) ? 1 : 0;
      const bPrimary = isPrimarySignal(b.suggestion) ? 1 : 0;

      if (aPrimary !== bPrimary) {
        return bPrimary - aPrimary;
      }

      const aPriority = getInvestigationPriority(a.suggestion);
      const bPriority = getInvestigationPriority(b.suggestion);

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      if (a.suggestion.confidence !== b.suggestion.confidence) {
        return b.suggestion.confidence - a.suggestion.confidence;
      }

      const textCompare = a.suggestion.text.localeCompare(b.suggestion.text);
      if (textCompare !== 0) {
        return textCompare;
      }

      return a.index - b.index;
    })
    .map((item) => item.suggestion);
}
