import type { DiagnosticRule } from "../diagnosticRule.js";
import {
  buildReviewRelatedPathSuggestion,
  buildUseBooleanLiteralSuggestion,
  buildUseEqualityInsteadOfPatternSuggestion,
  buildUseGuidLiteralSuggestion,
  buildUseIsoDateLiteralSuggestion,
  buildUseNumericLiteralSuggestion,
  buildUseUnquotedNullSuggestion,
} from "../diagnosticSuggestionBuilder.js";
import { resolveFilterField } from "../fieldResolution/filterFieldResolution.js";

// NOTE:
// Literal mismatch warnings may be suppressed if:
// - upstream validation already reported the issue
// - null semantic diagnostics are present
// This rule acts as a refinement layer, not the primary validator.

const ODATA_GUID_LITERAL_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

type SimpleFilterComparison = {
  fieldLogicalName: string;
  operator: string;
  rawValue: string;
};

function parseSimpleFilterComparisons(filter: string | undefined): SimpleFilterComparison[] {
  if (!filter) {
    return [];
  }

  const regex = new RegExp(
    `\\b([A-Za-z_][A-Za-z0-9_./]*)\\s+(eq|ne|gt|ge|lt|le|contains|like)\\s+((?:true|false|null|${ODATA_GUID_LITERAL_PATTERN}|-?\\d+(?:\\.\\d+)?|'(?:[^']|'')*'))(?=$|\\s|\\))`,
    "gi"
  );
  const comparisons: SimpleFilterComparison[] = [];

  for (const match of filter.matchAll(regex)) {
    const fieldLogicalName = match[1]?.trim();
    const operator = match[2]?.trim().toLowerCase();
    const rawValue = match[3]?.trim();

    if (fieldLogicalName && operator && rawValue) {
      comparisons.push({ fieldLogicalName, operator, rawValue });
    }
  }

  return comparisons;
}

function shouldPromoteValidationIssue(message: string): boolean {
  const normalized = message.toLowerCase();

  if (normalized.includes("was not found on")) {
    return false;
  }

  if (normalized.includes("expects true/false")) {
    return false;
  }

  if (normalized.includes("expects numeric values")) {
    return false;
  }

  return true;
}

function normalizeAttributeType(attributeType?: string): string {
  return (attributeType ?? "").trim().toLowerCase();
}

function isQuotedStringLiteral(rawValue: string): boolean {
  const trimmed = rawValue.trim();
  return trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'");
}

function unquoteSingleQuotedLiteral(rawValue: string): string {
  const trimmed = rawValue.trim();
  return isQuotedStringLiteral(trimmed)
    ? trimmed.slice(1, -1).replace(/''/g, "'")
    : trimmed;
}

function isBooleanLiteral(rawValue: string): boolean {
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "true" || normalized === "false";
}

function isNumericLiteral(rawValue: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(rawValue.trim());
}

function isGuidLiteral(rawValue: string): boolean {
  const unquoted = unquoteSingleQuotedLiteral(rawValue);
  return new RegExp(`^${ODATA_GUID_LITERAL_PATTERN}$`, "i").test(unquoted);
}

function isDateLikeLiteral(rawValue: string): boolean {
  const unquoted = unquoteSingleQuotedLiteral(rawValue);
  return /^\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(unquoted);
}

function isNumericAttributeType(attributeType?: string): boolean {
  const normalized = normalizeAttributeType(attributeType);
  return normalized === "integer"
    || normalized === "bigint"
    || normalized === "decimal"
    || normalized === "double"
    || normalized === "money";
}

function isBooleanAttributeType(attributeType?: string): boolean {
  return normalizeAttributeType(attributeType) === "boolean";
}

function isGuidLikeAttributeType(attributeType?: string): boolean {
  const normalized = normalizeAttributeType(attributeType);
  return normalized === "uniqueidentifier"
    || normalized === "lookup"
    || normalized === "customer"
    || normalized === "owner";
}

function isDateLikeAttributeType(attributeType?: string): boolean {
  const normalized = normalizeAttributeType(attributeType);
  return normalized === "datetime"
    || normalized === "date"
    || normalized === "datetimeoffset";
}

function isChoiceLikeAttributeType(attributeType?: string): boolean {
  const normalized = normalizeAttributeType(attributeType);
  return normalized === "picklist"
    || normalized === "state"
    || normalized === "status"
    || normalized === "multipicklist"
    || normalized === "multiselectpicklist";
}

function isStringPatternOperator(operator: string): boolean {
  const normalized = operator.trim().toLowerCase();
  return normalized === "contains" || normalized === "like";
}

function isTextLikeAttributeType(attributeType?: string): boolean {
  const normalized = normalizeAttributeType(attributeType);
  return normalized === "string"
    || normalized === "memo";
}

function isRangeComparisonOperator(operator: string): boolean {
  return operator === "gt" || operator === "ge" || operator === "lt" || operator === "le";
}

function isNullLiteral(rawValue: string): boolean {
  return rawValue.trim().toLowerCase() === "null";
}

function isQuotedNullLiteral(rawValue: string): boolean {
  return unquoteSingleQuotedLiteral(rawValue).trim().toLowerCase() === "null" && isQuotedStringLiteral(rawValue);
}

function isStateOrStatusField(fieldLogicalName: string): boolean {
  const normalized = fieldLogicalName.trim().toLowerCase();
  return normalized === "statecode" || normalized === "statuscode";
}

function buildPatternBackedSuggestion(comparison: SimpleFilterComparison) {
  const normalizedField = comparison.fieldLogicalName.trim().toLowerCase();
  const normalizedOperator = comparison.operator.trim().toLowerCase();

  if (isQuotedNullLiteral(comparison.rawValue)) {
    return buildUseUnquotedNullSuggestion(comparison.fieldLogicalName, { isSpeculative: true });
  }

  if (isQuotedStringLiteral(comparison.rawValue)) {
    const unquoted = unquoteSingleQuotedLiteral(comparison.rawValue).trim().toLowerCase();

    if (unquoted === "true" || unquoted === "false" || normalizedField.startsWith("is") || normalizedField.startsWith("has") || normalizedField.startsWith("can") || normalizedField.endsWith("active")) {
      return buildUseBooleanLiteralSuggestion(comparison.fieldLogicalName, comparison.rawValue, { isSpeculative: true });
    }

    if (/^-?\d+(?:\.\d+)?$/.test(unquoted) || isStateOrStatusField(normalizedField) || normalizedField.endsWith("code")) {
      return buildUseNumericLiteralSuggestion(comparison.fieldLogicalName, comparison.rawValue, { isSpeculative: true });
    }
  }

  if (isStringPatternOperator(normalizedOperator) && (isStateOrStatusField(normalizedField) || normalizedField.endsWith("code"))) {
    return buildUseEqualityInsteadOfPatternSuggestion(comparison.fieldLogicalName, comparison.rawValue, { isSpeculative: true });
  }

  return undefined;
}

function buildOperatorMismatchDiagnostic(
  attributeType: string | undefined,
  operator: string,
  fieldLogicalName: string,
  entityLogicalName: string | undefined
) {
  const normalizedType = normalizeAttributeType(attributeType);
  const normalizedOperator = operator.trim().toLowerCase();
  const entityName = entityLogicalName ?? "entity";

  if (!isRangeComparisonOperator(normalizedOperator)) {
    return undefined;
  }

  if (isBooleanAttributeType(normalizedType)) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a boolean field on \`${entityName}\`, but operator \`${normalizedOperator}\` is not a good fit for boolean comparisons.`,
      severity: "warning" as const,
      suggestion: "Use eq or ne when filtering boolean fields.",
      suggestedFix: buildUseEqualityInsteadOfPatternSuggestion(fieldLogicalName, "true"),
      confidence: 0.91
    };
  }

  if (isGuidLikeAttributeType(normalizedType)) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a GUID or lookup field on \`${entityName}\`, but operator \`${normalizedOperator}\` is not a good fit for GUID or lookup comparisons.`,
      severity: "warning" as const,
      suggestion: "Use eq or ne for GUID/lookup fields, or switch to the correct navigation filtering syntax.",
      confidence: 0.9
    };
  }

  return undefined;
}

function buildSemanticOperatorDiagnostic(
  attributeType: string | undefined,
  operator: string,
  fieldLogicalName: string,
  entityLogicalName: string | undefined,
  rawValue: string
) {
  const normalizedType = normalizeAttributeType(attributeType);
  const normalizedOperator = operator.trim().toLowerCase();
  const entityName = entityLogicalName ?? "entity";

  const isRangeOperator = isRangeComparisonOperator(normalizedOperator);
  const isPatternOperator = isStringPatternOperator(normalizedOperator);

  if (!isRangeOperator && !isPatternOperator) {
    return undefined;
  }

  if (isTextLikeAttributeType(normalizedType) && isRangeOperator) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a text field on \`${entityName}\`, but operator \`${normalizedOperator}\` is usually not a good fit for text comparison.`,
      severity: "warning" as const,
      suggestion: "Use eq/ne for exact text matches, or switch to a supported text function if you intend pattern matching.",
      confidence: 0.87
    };
  }

  if (isChoiceLikeAttributeType(normalizedType) && isRangeOperator) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a choice-like field on \`${entityName}\`, but operator \`${normalizedOperator}\` may not reflect intended business semantics.`,
      severity: "warning" as const,
      suggestion: "Prefer eq/ne with explicit option values unless you intentionally rely on the underlying numeric ordering.",
      suggestedFix: buildUseEqualityInsteadOfPatternSuggestion(fieldLogicalName, rawValue),
      confidence: 0.84
    };
  }

  if ((isChoiceLikeAttributeType(normalizedType) || isBooleanAttributeType(normalizedType)) && isPatternOperator) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a choice-like or boolean field on \`${entityName}\`, but operator \`${normalizedOperator}\` is usually only meaningful for text comparison.`,
      severity: "warning" as const,
      suggestion: "Prefer eq/ne with explicit option values for choice-like or boolean fields.",
      suggestedFix: buildUseEqualityInsteadOfPatternSuggestion(fieldLogicalName, rawValue),
      confidence: 0.88
    };
  }

  return undefined;
}

function buildNullSemanticDiagnostic(
  attributeType: string | undefined,
  operator: string,
  fieldLogicalName: string,
  entityLogicalName: string | undefined,
  rawValue: string
) {
  const normalizedType = normalizeAttributeType(attributeType);
  const normalizedOperator = operator.trim().toLowerCase();
  const entityName = entityLogicalName ?? "entity";

  if (isRangeComparisonOperator(normalizedOperator) && isNullLiteral(rawValue)) {
    return {
      message: `Field \`${fieldLogicalName}\` on \`${entityName}\` is being compared to null with operator \`${normalizedOperator}\`, which is usually not meaningful for null checks.`,
      severity: "warning" as const,
      suggestion: "Use eq null or ne null when you intend to test for null values.",
      suggestedFix: buildUseUnquotedNullSuggestion(fieldLogicalName),
      confidence: 0.9
    };
  }

  if (isQuotedNullLiteral(rawValue)) {
    return {
      message: `Field \`${fieldLogicalName}\` on \`${entityName}\` is using the quoted literal \`${rawValue.trim()}\`, which may mean the string "null" rather than a null comparison.`,
      severity: "warning" as const,
      suggestion: "Use unquoted null for null checks, or keep the quoted value only if you literally intend the text \"null\".",
      suggestedFix: buildUseUnquotedNullSuggestion(fieldLogicalName, { isSpeculative: isTextLikeAttributeType(normalizedType) }),
      confidence: isTextLikeAttributeType(normalizedType) ? 0.72 : 0.86
    };
  }

  return undefined;
}

function buildTypeMismatchDiagnostic(attributeType: string | undefined, fieldLogicalName: string, entityLogicalName: string | undefined, rawValue: string) {
  const normalizedType = normalizeAttributeType(attributeType);
  const entityName = entityLogicalName ?? "entity";
  const literalPreview = rawValue.trim();

  if (isBooleanAttributeType(normalizedType) && !isBooleanLiteral(rawValue)) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a boolean field on \`${entityName}\`, but the literal \`${literalPreview}\` is not a boolean value.`,
      severity: "warning" as const,
      suggestion: "Use true or false when filtering boolean fields.",
      suggestedFix: buildUseBooleanLiteralSuggestion(fieldLogicalName, rawValue),
      confidence: 0.9
    };
  }

  if (isNumericAttributeType(normalizedType) && !isNumericLiteral(unquoteSingleQuotedLiteral(rawValue))) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a numeric field on \`${entityName}\`, but the literal \`${literalPreview}\` is not numeric.`,
      severity: "warning" as const,
      suggestion: "Use a numeric literal such as 10 or 10.5 depending on the field type.",
      suggestedFix: buildUseNumericLiteralSuggestion(fieldLogicalName, rawValue),
      confidence: 0.9
    };
  }

  if (isGuidLikeAttributeType(normalizedType) && !isGuidLiteral(rawValue)) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a GUID or lookup field on \`${entityName}\`, but the literal \`${literalPreview}\` is not a GUID.`,
      severity: "warning" as const,
      suggestion: "Use a GUID value, or apply the correct lookup/navigation filtering syntax.",
      suggestedFix: buildUseGuidLiteralSuggestion(fieldLogicalName),
      confidence: 0.9
    };
  }

  if (isDateLikeAttributeType(normalizedType) && !isDateLikeLiteral(rawValue)) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a date/time field on \`${entityName}\`, but the literal \`${literalPreview}\` does not look like a date or datetime value.`,
      severity: "warning" as const,
      suggestion: "Use an ISO-style date or datetime literal that matches the Dataverse field type.",
      suggestedFix: buildUseIsoDateLiteralSuggestion(fieldLogicalName),
      confidence: 0.88
    };
  }

  if (isChoiceLikeAttributeType(normalizedType) && !isNumericLiteral(unquoteSingleQuotedLiteral(rawValue))) {
    return {
      message: `Field \`${fieldLogicalName}\` appears to be a choice-like field on \`${entityName}\`, but the literal \`${literalPreview}\` is not numeric.`,
      severity: "warning" as const,
      suggestion: "Use the numeric option value when filtering picklist, state, status, or multi-select fields.",
      suggestedFix: buildUseNumericLiteralSuggestion(fieldLogicalName, rawValue),
      confidence: 0.86
    };
  }

  return undefined;
}

function hasValidationMessageForField(
  validationIssues: any[] | undefined,
  fieldName: string
): boolean {
  if (!validationIssues || validationIssues.length === 0) {
    return false;
  }

  const normalizedField = fieldName.toLowerCase();

  return validationIssues.some((issue) => {
    const message = issue.message?.toLowerCase() ?? "";
    const suggestion = issue.suggestion?.toLowerCase() ?? "";

    return (
      message.includes(normalizedField)
      || suggestion.includes(normalizedField)
      || message.includes(normalizedField.replace("code", ""))
      || suggestion.includes(normalizedField.replace("code", ""))
      || (normalizedField === "statecode" && message.includes("state"))
      || (normalizedField === "statuscode" && message.includes("status"))
    );
  });
}

export const metadataValidationRules: DiagnosticRule[] = [
  async (context) => {
    if (!context.entityLogicalName || !context.loadFieldsForEntity || !context.parsed.filter) {
      return [];
    }

    const comparisons = parseSimpleFilterComparisons(context.parsed.filter);
    if (!comparisons.length) {
      return [];
    }

    const fields = await context.loadFieldsForEntity(context.entityLogicalName);

    return comparisons.flatMap((comparison) => {
      const resolution = resolveFilterField(comparison.fieldLogicalName, fields);

      if (resolution.kind === "unknown") {
        return [{
          message: `Field \`${resolution.fieldName}\` is not recognised as a standard attribute on \`${context.entityLogicalName}\`.`,
          severity: "warning" as const,
          suggestion: "Verify the schema name, or use the closest known field suggested by Validation.",
          suggestedFix: buildPatternBackedSuggestion(comparison),
          confidence: 0.9
        }];
      }

      if (resolution.kind === "nonAttributeLike" || resolution.kind === "pathLike") {
        return [{
          message: `Field \`${resolution.fieldName}\` does not appear to be a standard scalar attribute on \`${context.entityLogicalName}\`.`,
          severity: "warning" as const,
          suggestion: "Use the related entity, supported navigation filtering syntax, or a standard scalar attribute for simple equality filters.",
          suggestedFix: resolution.kind === "pathLike"
            ? buildReviewRelatedPathSuggestion(resolution.fieldName)
            : buildPatternBackedSuggestion(comparison),
          confidence: 0.85
        }];
      }

      const field = resolution.resolvedAttribute;
      if (!field) {
        return [];
      }

      const findings = [];

      const normalizedType = normalizeAttributeType(field.attributeType);

      const operatorMismatchDiagnostic = buildOperatorMismatchDiagnostic(
        field.attributeType,
        comparison.operator,
        field.logicalName,
        context.entityLogicalName
      );

      if (operatorMismatchDiagnostic) {
        findings.push(operatorMismatchDiagnostic);
      }

      const semanticOperatorDiagnostic = buildSemanticOperatorDiagnostic(
        field.attributeType,
        comparison.operator,
        field.logicalName,
        context.entityLogicalName,
        comparison.rawValue
      );

      if (semanticOperatorDiagnostic) {
        findings.push(semanticOperatorDiagnostic);
      }

      const nullSemanticDiagnostic = buildNullSemanticDiagnostic(
        field.attributeType,
        comparison.operator,
        field.logicalName,
        context.entityLogicalName,
        comparison.rawValue
      );

      if (nullSemanticDiagnostic) {
        findings.push(nullSemanticDiagnostic);
      }

      const typeMismatchDiagnostic = buildTypeMismatchDiagnostic(
        field.attributeType,
        field.logicalName,
        context.entityLogicalName,
        comparison.rawValue
      );

      const isBooleanMismatch = normalizedType === "boolean";
      const isChoiceMismatch = isChoiceLikeAttributeType(normalizedType);

      const alreadyCoveredByValidation =
        (isBooleanMismatch || isChoiceMismatch)
        && hasValidationMessageForField(context.validationIssues, field.logicalName);

      const shouldSuppressGuidLiteralMismatch =
        isGuidLikeAttributeType(normalizedType)
        && isRangeComparisonOperator(comparison.operator)
        && !!operatorMismatchDiagnostic;

      const shouldSuppressLiteralMismatch =
        alreadyCoveredByValidation
        || shouldSuppressGuidLiteralMismatch
        || !!nullSemanticDiagnostic;

      if (typeMismatchDiagnostic && !shouldSuppressLiteralMismatch) {
        findings.push(typeMismatchDiagnostic);
      }

      if (field.isValidForAdvancedFind === false) {
        findings.push({
          message: `Field \`${field.logicalName}\` may not be filterable on \`${context.entityLogicalName}\`.`,
          severity: "warning" as const,
          suggestion: "Use a filterable field, or confirm the Dataverse attribute metadata before relying on this filter.",
          confidence: 0.8
        });
      }

      return findings;
    });
  },
  (context) => {
    if (!context.validationIssues?.length) {
      return [];
    }

    return context.validationIssues
      .filter((issue) => shouldPromoteValidationIssue(issue.message))
      .slice(0, 3)
      .map((issue) => ({
        message: issue.message,
        severity: issue.severity,
        suggestion: issue.suggestion,
        confidence: issue.severity === "error" ? 0.95 : 0.85
      }));
  }
];
