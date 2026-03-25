import type { DiagnosticRule } from "../diagnosticRule.js";
import { buildAddSelectSuggestedFix, buildAddTopSuggestedFix } from "../diagnosticSuggestionBuilder.js";

function hasDuplicateValues(values: string[]): boolean {
  const normalized = values.map((value) => value.trim().toLowerCase()).filter(Boolean);
  return new Set(normalized).size !== normalized.length;
}

export const basicQueryShapeRules: DiagnosticRule[] = [
  (context) => {
    const findings = [];

    if (context.parsed.isCollection && !context.parsed.select.length) {
      findings.push({
        message: "Query does not specify $select.",
        severity: "warning" as const,
        suggestion: "Add $select to reduce payload size and improve result clarity.",
        suggestedFix: buildAddSelectSuggestedFix(context.parsed.entitySetName ?? "records"),
        confidence: 0.95
      });
    }

    return findings;
  },
  (context) => {
    const findings = [];

    if (context.parsed.isCollection && context.parsed.top === undefined) {
      findings.push({
        message: "Collection query does not specify $top.",
        severity: "info" as const,
        suggestion: "Consider adding $top during investigation to keep result sets focused.",
        suggestedFix: buildAddTopSuggestedFix(context.parsed.entitySetName ?? "records"),
        confidence: 0.8
      });
    }

    return findings;
  },
  (context) => {
    if (!context.parsed.unknownParams.length) {
      return [];
    }

    const params = context.parsed.unknownParams.map((param) => `\`${param.key}\``).join(", ");

    return [{
      message: `Query includes unrecognised option${context.parsed.unknownParams.length > 1 ? "s" : ""}: ${params}.`,
      severity: "warning" as const,
      suggestion: "Check for typos or unsupported query options before relying on the result.",
      confidence: 0.9
    }];
  },
  (context) => {
    if (!hasDuplicateValues(context.parsed.select)) {
      return [];
    }

    return [{
      message: "Query contains duplicate $select fields.",
      severity: "info" as const,
      suggestion: "Remove repeated fields from $select to keep the query easier to read.",
      confidence: 0.88
    }];
  }
];
