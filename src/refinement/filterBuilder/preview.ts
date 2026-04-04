import { previewAndApplyMutationResult, type MutationResult } from "../queryPreview.js";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { odataQuoteString } from "../../commands/router/actions/shared/queryMutation/odataValueUtils.js";
import type { BuildFilterInsight, FilterClauseModel } from "./models.js";

export interface BuildFilterPreviewResult extends MutationResult {
  previewQuery: string;
  generatedClause: string;
  mergeStrategy: "replace" | "appendAnd";
}

export function buildFilterClauseFromModel(clause: FilterClauseModel): string {
  const left = clause.selectToken ?? clause.fieldLogicalName;
  const rawValue = String(clause.value ?? "").trim();

  switch (clause.operator) {
    case "contains":
    case "startswith":
    case "endswith":
      return `${clause.operator}(${left},${odataQuoteString(rawValue)})`;
    case "null":
      return `${left} eq null`;
    case "notNull":
      return `${left} ne null`;
    default: {
      const formattedValue = formatModelValue(clause);
      return `${left} ${clause.operator} ${formattedValue}`;
    }
  }
}

export function buildFilterPreviewFromInsight(
  queryText: string,
  insight: BuildFilterInsight
): BuildFilterPreviewResult {
  const parsed = parseEditorQuery(queryText);
  const expression = insight.expression;

  if (!expression.clauses.length) {
    throw new Error("At least one filter clause is required.");
  }

  const clauseText = expression.clauses.map(buildFilterClauseFromModel).join(` ${expression.combinator} `);
  const existingFilter = (parsed.queryOptions.get("$filter") ?? "").trim();

  const mergedFilter = (!existingFilter || insight.mergeStrategy === "replace")
    ? clauseText
    : `${wrapForAndOperand(existingFilter)} and ${wrapForAndOperand(clauseText)}`;

  parsed.queryOptions.delete("$filter");
  parsed.queryOptions.set("$filter", mergedFilter);

  return {
    originalQuery: queryText,
    generatedClause: clauseText,
    updatedQuery: buildEditorQuery(parsed),
    previewQuery: buildEditorQuery(parsed),
    mergeStrategy: insight.mergeStrategy
  };
}

function wrapForAndOperand(value: string): string {
  const trimmed = value.trim();

  if (isWrappedBySingleBalancedParens(trimmed)) {
    return trimmed;
  }

  if (/\sand\s|\sor\s/i.test(trimmed)) {
    return `(${trimmed})`;
  }

  return trimmed;
}

function isWrappedBySingleBalancedParens(value: string): boolean {
  if (!value.startsWith("(") || !value.endsWith(")")) {
    return false;
  }

  let depth = 0;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];

    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;

      if (depth === 0 && i < value.length - 1) {
        return false;
      }

      if (depth < 0) {
        return false;
      }
    }
  }

  return depth === 0;
}

export async function previewAndApplyFilterInsight(target: EditorQueryTarget, insight: BuildFilterInsight): Promise<void> {
  const preview = buildFilterPreviewFromInsight(target.text, insight);

  await previewAndApplyMutationResult(target, preview, {
    heading: "Preview Add Filter ($filter)",
    sections: [
      {
        label: "Merge strategy",
        value: preview.mergeStrategy === "replace" ? "Replace existing filter" : "Append with AND"
      },
      {
        label: "Generated filter clause",
        value: preview.generatedClause
      }
    ]
  });
}

function formatModelValue(clause: FilterClauseModel): string {
  const rawValue = String(clause.value ?? "").trim();

  if (clause.fieldType === "choice" || clause.fieldType === "numeric") {
    return rawValue;
  }

  if (clause.fieldType === "boolean") {
    const lowered = rawValue.toLowerCase();
    return lowered === "1" ? "true" : lowered === "0" ? "false" : lowered;
  }

  if (clause.fieldType === "datetime") {
    return rawValue;
  }

  return odataQuoteString(rawValue);
}

