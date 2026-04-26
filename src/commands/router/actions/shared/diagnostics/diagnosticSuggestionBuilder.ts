import type { DiagnosticFinding, DiagnosticSuggestedFix } from "./diagnosticTypes.js";

export function createSuggestedFix(
  label: string,
  detail: string,
  options?: {
    example?: string;
    confidence?: number;
    isSpeculative?: boolean;
  }
): DiagnosticSuggestedFix {
  return {
    label,
    detail,
    example: options?.example,
    confidence: options?.confidence,
    isSpeculative: options?.isSpeculative
  };
}

export function buildExpandNotFullySupportedDiagnostic(): DiagnosticFinding {
  return {
    severity: 'info',
    message: 'Expand support is currently partial.',
    suggestion: 'Diagnostics inside $expand clauses may be incomplete.',
    confidence: 0.3
  };
}

export function buildAddSelectSuggestedFix(entitySetName: string): DiagnosticSuggestedFix {
  return createSuggestedFix(
    "Add a focused $select clause",
    "Limit the response to the fields you actually need so the query is easier to inspect and cheaper to run.",
    {
      confidence: 0.95
    }
  );
}

export function buildAddTopSuggestedFix(entitySetName: string): DiagnosticSuggestedFix {
  return createSuggestedFix(
    "Add a bounded $top clause",
    "Keep the result set small while you validate the filter and output shape.",
    {
      confidence: 0.85
    }
  );
}

export function buildUseUnquotedNullSuggestion(fieldLogicalName: string, options?: { isSpeculative?: boolean; }): DiagnosticSuggestedFix {
  return createSuggestedFix(
    "Use null without quotes",
    "Quoted 'null' is treated like text. Use bare null when you intend a null comparison.",
    {
      example: `${fieldLogicalName} eq null`,
      confidence: options?.isSpeculative ? 0.63 : 0.9,
      isSpeculative: options?.isSpeculative
    }
  );
}

export function buildUseBooleanLiteralSuggestion(fieldLogicalName: string, rawValue?: string, options?: { isSpeculative?: boolean; }): DiagnosticSuggestedFix {
  const normalized = rawValue?.trim().toLowerCase();
  const exampleValue = normalized === "'false'" || normalized === "false" ? "false" : "true";

  return createSuggestedFix(
    "Use true or false without quotes",
    "Boolean fields should be compared using the literal true or false, not a quoted string.",
    {
      example: `${fieldLogicalName} eq ${exampleValue}`,
      confidence: options?.isSpeculative ? 0.6 : 0.9,
      isSpeculative: options?.isSpeculative
    }
  );
}

export function buildUseNumericLiteralSuggestion(fieldLogicalName: string, rawValue?: string, options?: { isSpeculative?: boolean; }): DiagnosticSuggestedFix {
  const normalized = rawValue?.trim() ?? "";
  const unquoted = normalized.replace(/^'/, "").replace(/'$/, "");
  const exampleValue = /^-?\d+(?:\.\d+)?$/.test(unquoted) ? unquoted : "0";

  return createSuggestedFix(
    "Use a numeric literal instead of a quoted string",
    "Numeric, state, status, and choice-like fields are usually filtered with numeric values rather than quoted text.",
    {
      example: `${fieldLogicalName} eq ${exampleValue}`,
      confidence: options?.isSpeculative ? 0.62 : 0.9,
      isSpeculative: options?.isSpeculative
    }
  );
}

export function buildUseEqualityInsteadOfPatternSuggestion(fieldLogicalName: string, rawValue?: string, options?: { isSpeculative?: boolean; }): DiagnosticSuggestedFix {
  const normalized = rawValue?.trim() ?? "0";
  const unquoted = normalized.replace(/^'/, "").replace(/'$/, "").replace(/^%|%$/g, "") || "0";
  const exampleValue = /^-?\d+(?:\.\d+)?$/.test(unquoted) ? unquoted : "0";

  return createSuggestedFix(
    "Prefer equality-style filtering",
    "Choice-like, status, and boolean fields are normally compared with eq/ne rather than text-pattern operators.",
    {
      example: `${fieldLogicalName} eq ${exampleValue}`,
      confidence: options?.isSpeculative ? 0.64 : 0.88,
      isSpeculative: options?.isSpeculative
    }
  );
}

export function buildUseGuidLiteralSuggestion(fieldLogicalName: string, options?: { isSpeculative?: boolean; }): DiagnosticSuggestedFix {
  return createSuggestedFix(
    "Use a valid GUID literal",
    "GUID and lookup fields should be compared using a valid GUID-shaped value, or the filter should switch to the correct navigation pattern.",
    {
      example: `${fieldLogicalName} eq 00000000-0000-0000-0000-000000000000`,
      confidence: options?.isSpeculative ? 0.64 : 0.9,
      isSpeculative: options?.isSpeculative
    }
  );
}

export function buildUseIsoDateLiteralSuggestion(fieldLogicalName: string, options?: { isSpeculative?: boolean; includeTime?: boolean; }): DiagnosticSuggestedFix {
  const exampleValue = options?.includeTime === false
    ? "2026-03-25"
    : "2026-03-25T00:00:00Z";

  return createSuggestedFix(
    "Use an ISO-style date or datetime literal",
    "Date and datetime fields are safest when filtered with an ISO-style literal that matches the Dataverse field type.",
    {
      example: `${fieldLogicalName} eq ${exampleValue}`,
      confidence: options?.isSpeculative ? 0.64 : 0.88,
      isSpeculative: options?.isSpeculative
    }
  );
}


export function buildReviewRelatedPathSuggestion(fieldLogicalName: string): DiagnosticSuggestedFix {
  return createSuggestedFix(
    "Review the related-field path",
    "This filter path looks like it targets a related attribute instead of a scalar field on the base entity. Check whether the comparison should use a base-field value, a lookup GUID, or a supported navigation pattern.",
    {
      example: `${fieldLogicalName.split("/")[0]} eq <lookup-guid>`,
      confidence: 0.72,
      isSpeculative: true
    }
  );
}
