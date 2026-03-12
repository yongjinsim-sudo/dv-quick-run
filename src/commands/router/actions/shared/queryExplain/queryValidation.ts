import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import { EntityDef } from "../../../../../utils/entitySetCache.js";
import {
  findEntityByEntitySetName,
  findFieldByLogicalName,
  findFieldBySelectToken,
  findFieldOnDirectlyRelatedEntity,
  loadChoiceMetadata,
  loadEntityDefs,
  loadFields,
  type RelationshipHit,
  matchChoiceLabel
} from "../metadataAccess.js";
import { findChoiceMetadataForField } from "../valueAwareness.js";

type ParsedOrderBy = {
  field: string;
  direction: "asc" | "desc";
};

type ParsedExpand = {
  navigationProperty: string;
  nestedSelect: string[];
  raw: string;
};

type ParsedDataverseQuery = {
  raw: string;
  normalized: string;
  pathPart: string;
  queryPart: string;
  entitySetName?: string;
  recordId?: string;
  isSingleRecord: boolean;
  isCollection: boolean;
  params: Array<{ key: string; value: string }>;
  select: string[];
  filter?: string;
  orderBy: ParsedOrderBy[];
  top?: number;
  expand: ParsedExpand[];
  unknownParams: Array<{ key: string; value: string }>;
};

export type ValidationIssue = {
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
};

type SimpleComparison = {
  fieldLogicalName: string;
  operator: string;
  rawValue: string;
};

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function unquoteSingleQuoted(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  return trimmed;
}

function isSingleQuoted(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'");
}

function isNumericLiteral(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function isBooleanLiteral(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  return lowered === "true" || lowered === "false";
}

function isChoiceLikeAttributeType(attributeType?: string): boolean {
  const normalized = normalizeName(attributeType);
  return normalized === "picklist"
    || normalized === "state"
    || normalized === "status"
    || normalized === "boolean"
    || normalized === "multipicklist"
    || normalized === "multiselectpicklist";
}

function parseSimpleFilterComparisons(filter: string): SimpleComparison[] {
  const results: SimpleComparison[] = [];
  const regex = /\b([A-Za-z_][A-Za-z0-9_]*)\s+(eq|ne|gt|ge|lt|le)\s+((?:true|false|null|-?\d+(?:\.\d+)?)|'(?:[^']|'')*')/gi;

  for (const match of filter.matchAll(regex)) {
    const [, fieldLogicalName, operator, rawValue] = match;
    if (fieldLogicalName && operator && rawValue) {
      results.push({
        fieldLogicalName,
        operator: operator.toLowerCase(),
        rawValue
      });
    }
  }

  return results;
}

function levenshteinDistance(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();

  if (left === right) {
    return 0;
  }

  const dp = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= right.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[left.length][right.length];
}

function suggestClosest(input: string, candidates: string[], maxDistance = 3): string | undefined {
  const normalizedInput = normalizeName(input);
  if (!normalizedInput || !candidates.length) {
    return undefined;
  }

  let best: { value: string; distance: number } | undefined;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(normalizedInput, normalizeName(candidate));
    if (!best || distance < best.distance) {
      best = { value: candidate, distance };
    }
  }

  if (!best) {
    return undefined;
  }

  if (best.distance <= maxDistance) {
    return best.value;
  }

  return undefined;
}

function validateChoiceLikeValue(attributeType: string | undefined, rawValue: string): ValidationIssue | undefined {
  const typeKey = normalizeName(attributeType);

  if (typeKey === "boolean") {
    if (isBooleanLiteral(rawValue)) {
      return undefined;
    }

    if (isSingleQuoted(rawValue)) {
      const label = unquoteSingleQuoted(rawValue);
      return {
        severity: "warning",
        message: `Boolean field likely expects true/false, but received label-like value '${label}'.`,
        suggestion: "Use true or false for this field."
      };
    }

    return {
      severity: "warning",
      message: `Boolean field likely expects true/false, but received \`${rawValue}\`.`,
      suggestion: "Use true or false for this field."
    };
  }

  if (isNumericLiteral(rawValue)) {
    return undefined;
  }

  if (isSingleQuoted(rawValue)) {
    const label = unquoteSingleQuoted(rawValue);
    return {
      severity: "warning",
      message: `${typeKey || "Choice-like"} field likely expects numeric values, but received label-like value '${label}'.`,
      suggestion: "Use the numeric option value in the filter expression."
    };
  }

  return {
    severity: "warning",
    message: `${typeKey || "Choice-like"} field likely expects numeric values, but received \`${rawValue}\`.`,
    suggestion: "Use the numeric option value in the filter expression."
  };
}

function formatChoiceValuesPreview(options: Array<{ value: number | boolean; label: string }>): string {
  const shown = options.slice(0, 8).map((option) => `\`${String(option.value)}\` (${option.label})`);
  const remaining = Math.max(0, options.length - shown.length);
  return remaining > 0 ? `${shown.join(", ")} … and ${remaining} more` : shown.join(", ");
}

function buildExpandSuggestion(parsed: ParsedDataverseQuery, validBaseSelectTokens: string[], relation: RelationshipHit, fieldToken: string): string {
  const parts: string[] = [];

  if (validBaseSelectTokens.length) {
    parts.push(`$select=${validBaseSelectTokens.join(",")}`);
  }

  const existingExpand = parsed.expand.map((item) => item.raw);
  const newExpand = `${relation.navigationPropertyName}($select=${fieldToken})`;
  const expandParts = [...existingExpand, newExpand];
  if (expandParts.length) {
    parts.push(`$expand=${expandParts.join(",")}`);
  }

  const ignoredKeys = new Set(["$select", "$expand"]);
  for (const param of parsed.params) {
    if (ignoredKeys.has(normalizeName(param.key))) {
      continue;
    }
    parts.push(param.value ? `${param.key}=${param.value}` : param.key);
  }

  return `${parsed.entitySetName}?${parts.join("&")}`;
}

async function validateSelectFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  defs: EntityDef[],
  parsed: ParsedDataverseQuery,
  entityLogicalName: string,
  fields: any[]
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const candidateNames = fields.flatMap((field) => {
    const names = [field.logicalName];
    if (field.attributeType === "lookup" || field.attributeType === "customer" || field.attributeType === "owner") {
      names.push(`_${field.logicalName}_value`);
    }
    return names.filter(Boolean) as string[];
  });
  const validBaseSelectTokens = parsed.select.filter((token) => !!(findFieldBySelectToken(fields, token) ?? findFieldByLogicalName(fields, token)));

    for (const selectToken of parsed.select) {
    const found = findFieldBySelectToken(fields, selectToken) ?? findFieldByLogicalName(fields, selectToken);
    if (found) {
      continue;
    }

    const suggestion = suggestClosest(selectToken, candidateNames);
    let relationshipSuggestion: string | undefined;
    let extraMessage = "";

    try {
      const relationshipHit = await findFieldOnDirectlyRelatedEntity(ctx, client, token, defs, entityLogicalName, selectToken
      );
      if (relationshipHit) {
        extraMessage = ` It exists on related entity \`${relationshipHit.targetLogicalName}\`.`;
        relationshipSuggestion = buildExpandSuggestion(parsed, validBaseSelectTokens, relationshipHit, selectToken);
      }
    } catch {
      // ignore enrichment failures
    }

    issues.push({
      severity: "error",
      message: `Field \`${selectToken}\` in $select was not found on \`${entityLogicalName}\`.${extraMessage}`,
      suggestion: relationshipSuggestion
        ? `You may be looking for: \`${relationshipSuggestion}\``
        : suggestion
          ? `Did you mean \`${suggestion}\`?`
          : undefined
    });
  }

  return issues;
}

async function validateOrderByFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  defs: EntityDef[],
  items: ParsedOrderBy[],
  entityLogicalName: string,
  fields: any[]
): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
  const fieldNames = fields.map((field) => field.logicalName).filter(Boolean) as string[];

  for (const item of items) {
    if (findFieldByLogicalName(fields, item.field)) {
      continue;
    }

    const suggestion = suggestClosest(item.field, fieldNames);
    let relationshipSuggestion: string | undefined;
    let extraMessage = "";

    try {
      const relationshipHit = await findFieldOnDirectlyRelatedEntity(
        ctx,
        client,
        token,
        defs,
        entityLogicalName,
        item.field
      );

      if (relationshipHit) {
        extraMessage = ` It exists on related entity \`${relationshipHit.targetLogicalName}\`.`;
        relationshipSuggestion =
          `Consider using $expand=${relationshipHit.navigationPropertyName}($select=${item.field}) instead.`;
      }
    } catch {
      // ignore enrichment failures
    }

    issues.push({
      severity: "error",
      message: `Field \`${item.field}\` in $orderby was not found on \`${entityLogicalName}\`.${extraMessage}`,
      suggestion: relationshipSuggestion ?? (suggestion ? `Did you mean \`${suggestion}\`?` : undefined)
    });
  }

  return issues;
}

async function validateFilterFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  defs: EntityDef[],
  filter: string,
  entityLogicalName: string,
  fields: any[]
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const fieldNames = fields.map((field) => field.logicalName).filter(Boolean) as string[];
  let cachedChoiceMetadata: any[] | undefined;

  for (const comparison of parseSimpleFilterComparisons(filter)) {
    const field = findFieldByLogicalName(fields, comparison.fieldLogicalName);
    if (!field) {
      const suggestion = suggestClosest(comparison.fieldLogicalName, fieldNames);
      let relationshipSuggestion: string | undefined;
      let extraMessage = "";
    
      try {
        const relationshipHit = await findFieldOnDirectlyRelatedEntity(ctx, client, token, defs, entityLogicalName, comparison.fieldLogicalName
        );
    
        if (relationshipHit) {
          extraMessage = ` It exists on related entity \`${relationshipHit.targetLogicalName}\`.`;
          relationshipSuggestion =
            `Consider using $expand=${relationshipHit.navigationPropertyName}($select=${comparison.fieldLogicalName}) instead.`;
        }
      } catch {
        // ignore enrichment failures
      }
    
      issues.push({
        severity: "error",
        message: `Field \`${comparison.fieldLogicalName}\` in $filter was not found on \`${entityLogicalName}\`.${extraMessage}`,
        suggestion: relationshipSuggestion ?? (suggestion ? `Did you mean \`${suggestion}\`?` : undefined)
      });
      continue;
    }

    if (!isChoiceLikeAttributeType(field.attributeType)) {
      continue;
    }

    const choiceIssue = validateChoiceLikeValue(field.attributeType, comparison.rawValue);
    if (choiceIssue) {
      let suggestion = choiceIssue.suggestion;

      if (isSingleQuoted(comparison.rawValue)) {
        const label = unquoteSingleQuoted(comparison.rawValue);
        try {
          if (!cachedChoiceMetadata) {
            cachedChoiceMetadata = await loadChoiceMetadata(ctx, client, token, entityLogicalName);
          }
          const match = await matchChoiceLabel(ctx, client, token, entityLogicalName, field.logicalName, label);
                  
          if (match) {
            suggestion = `Did you mean \`${field.logicalName} ${comparison.operator} ${String(match.option.value)}\`?`;
          }
        } catch {
          // ignore enrichment failures
        }
      }

      issues.push({
        ...choiceIssue,
        message: `Field \`${field.logicalName}\`: ${choiceIssue.message}`,
        suggestion
      });
      continue;
    }

    if (!isNumericLiteral(comparison.rawValue) && !isBooleanLiteral(comparison.rawValue)) {
      continue;
    }

    try {
      if (!cachedChoiceMetadata) {
        cachedChoiceMetadata = await loadChoiceMetadata(ctx, client, token, entityLogicalName);
      }

      const choiceMetadata = findChoiceMetadataForField(cachedChoiceMetadata, field.logicalName);
      if (!choiceMetadata) {
        continue;
      }

      const normalizedValue: number | boolean = isBooleanLiteral(comparison.rawValue)
        ? comparison.rawValue.trim().toLowerCase() === "true"
        : Number(comparison.rawValue.trim());

      const isKnownValue = choiceMetadata.options.some((option: any) => option.value === normalizedValue);
      if (isKnownValue) {
        continue;
      }

      const preview = formatChoiceValuesPreview(choiceMetadata.options);
      issues.push({
        severity: "warning",
        message: `Field \`${field.logicalName}\` does not contain known option value \`${comparison.rawValue.trim()}\`.`,
        suggestion: preview ? `Valid values include: ${preview}` : undefined
      });
    } catch {
      // ignore enrichment failures
    }
  }

  return issues;
}

export async function validateParsedQuery(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  parsed: ParsedDataverseQuery,
  entity?: EntityDef
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  if (!parsed.entitySetName) {
    issues.push({
      severity: "error",
      message: "Could not detect an entity set from the query path."
    });
    return issues;
  }

  const defs = await loadEntityDefs(ctx, client, token);
  let resolvedEntity = entity;

  if (!resolvedEntity) {
    resolvedEntity = findEntityByEntitySetName(defs, parsed.entitySetName);

    if (!resolvedEntity) {
      const suggestion = suggestClosest(parsed.entitySetName, defs.map((d) => d.entitySetName));
      issues.push({
        severity: "error",
        message: `Entity set \`${parsed.entitySetName}\` was not found in metadata.`,
        suggestion: suggestion ? `Did you mean \`${suggestion}\`?` : undefined
      });
      return issues;
    }
  }

  const fields = await loadFields(ctx, client, token, resolvedEntity.logicalName);

  issues.push(...await validateSelectFields(ctx, client, token, defs, parsed, resolvedEntity.logicalName, fields  ));
  issues.push(...await validateOrderByFields(ctx, client, token, defs, parsed.orderBy, resolvedEntity.logicalName, fields ));

  if (parsed.filter) {
    issues.push(...await validateFilterFields(ctx, client, token, defs, parsed.filter, resolvedEntity.logicalName, fields ));
  }

  const topParam = parsed.params.find((p) => normalizeName(p.key) === "$top");
  if (topParam && typeof parsed.top !== "number") {
    issues.push({
      severity: "error",
      message: `$top value \`${topParam.value}\` is not a valid number.`
    });
  }

  return issues;
}
