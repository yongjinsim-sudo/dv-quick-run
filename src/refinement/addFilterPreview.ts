import { previewAndApplyMutationResult, type MutationResult } from "./queryPreview.js";
import type { CommandContext } from "../commands/context/commandContext.js";
import type { EditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { buildEditorQuery, parseEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { parseExpandClause, serializeExpandNodes, type ExpandNode } from "../commands/router/actions/shared/expand/expandComposer.js";
import { buildFilterClauseFromModel } from "./filterBuilder/preview.js";
import type { BuildFilterInsight } from "./filterBuilder/models.js";
import { runAddFilterAction } from "../commands/router/actions/queryMutation/addFilterAction.js";

export async function previewAndApplyAddFilterInActiveEditor(ctx: CommandContext): Promise<void> {
  await runAddFilterAction(ctx);
}

export function readFilterAtScope(queryText: string, relationshipPath: string[]): string | undefined {
  const parsed = parseEditorQuery(queryText);

  if (!relationshipPath.length) {
    return parsed.queryOptions.get("$filter") ?? undefined;
  }

  const expanded = parseExpandClause(parsed.queryOptions.get("$expand") ?? undefined);
  return readExpandFilter(expanded, relationshipPath);
}

function readExpandFilter(nodes: ExpandNode[], relationshipPath: string[]): string | undefined {
  const [head, ...rest] = relationshipPath;
  const node = nodes.find((candidate) => candidate.relationship.toLowerCase() === head.toLowerCase());
  if (!node) {
    return undefined;
  }

  if (rest.length === 0) {
    const existing = node.additionalOptions?.find((option) => option.toLowerCase().startsWith("$filter="));
    return existing ? existing.slice("$filter=".length) : undefined;
  }

  return readExpandFilter(node.expand ?? [], rest);
}

function wrapForAndOperand(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

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

function mergeFilter(existingFilter: string | undefined, clauseText: string, mergeStrategy: "replace" | "appendAnd"): string {
  const existing = (existingFilter ?? "").trim();
  if (!existing || mergeStrategy === "replace") {
    return clauseText;
  }

  return `${wrapForAndOperand(existing)} and ${wrapForAndOperand(clauseText)}`;
}

function applyFilterToExpandPath(
  nodes: ExpandNode[],
  relationshipPath: string[],
  clauseText: string,
  mergeStrategy: "replace" | "appendAnd"
): ExpandNode[] {
  return nodes.map((node) => {
    if (node.relationship.toLowerCase() !== relationshipPath[0].toLowerCase()) {
      return {
        ...node,
        expand: [...(node.expand ?? [])],
        additionalOptions: [...(node.additionalOptions ?? [])]
      };
    }

    if (relationshipPath.length === 1) {
      const currentOptions = [...(node.additionalOptions ?? [])];
      const existingFilterIndex = currentOptions.findIndex((option) => option.toLowerCase().startsWith("$filter="));
      const existingFilter = existingFilterIndex >= 0
        ? currentOptions[existingFilterIndex].slice("$filter=".length)
        : undefined;
      const merged = mergeFilter(existingFilter, clauseText, mergeStrategy);

      const nextOptions = currentOptions.filter((option) => !option.toLowerCase().startsWith("$filter="));
      nextOptions.push(`$filter=${merged}`);

      return {
        ...node,
        additionalOptions: nextOptions
      };
    }

    return {
      ...node,
      expand: applyFilterToExpandPath(node.expand ?? [], relationshipPath.slice(1), clauseText, mergeStrategy)
    };
  });
}

export function buildScopedFilterPreviewFromInsight(
  queryText: string,
  insight: BuildFilterInsight,
  relationshipPath: string[]
): MutationResult & { generatedClause: string; mergeStrategy: "replace" | "appendAnd"; previewQuery: string } {
  const parsed = parseEditorQuery(queryText);
  const expression = insight.expression;

  if (!expression.clauses.length) {
    throw new Error("At least one filter clause is required.");
  }

  const clauseText = expression.clauses.map(buildFilterClauseFromModel).join(` ${expression.combinator} `);

  if (!relationshipPath.length) {
    const existingFilter = (parsed.queryOptions.get("$filter") ?? "").trim();
    const mergedFilter = mergeFilter(existingFilter, clauseText, insight.mergeStrategy);
    parsed.queryOptions.delete("$filter");
    parsed.queryOptions.set("$filter", mergedFilter);
  } else {
    const expanded = parseExpandClause(parsed.queryOptions.get("$expand") ?? undefined);
    if (!expanded.length) {
      throw new Error("Query does not contain $expand.");
    }

    const updatedExpand = applyFilterToExpandPath(expanded, relationshipPath, clauseText, insight.mergeStrategy);
    parsed.queryOptions.set("$expand", serializeExpandNodes(updatedExpand));
  }

  const updatedQuery = buildEditorQuery(parsed);

  return {
    originalQuery: queryText,
    updatedQuery,
    previewQuery: updatedQuery,
    generatedClause: clauseText,
    mergeStrategy: insight.mergeStrategy
  };
}

export async function previewAndApplyFilterInsightForScope(
  target: EditorQueryTarget,
  insight: BuildFilterInsight,
  relationshipPath: string[]
): Promise<void> {
  const preview = buildScopedFilterPreviewFromInsight(target.text, insight, relationshipPath);

  await previewAndApplyMutationResult(target, preview, {
    heading: "Preview Add Filter ($filter)",
    sections: [
      {
        label: "Scope",
        value: relationshipPath.length ? relationshipPath.join(" -> ") : "root"
      },
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
