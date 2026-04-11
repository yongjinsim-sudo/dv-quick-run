import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import type { ResultViewerTraversalContext } from "../../services/resultViewModelBuilder.js";
import type { BinderSuggestion } from "./binderTypes.js";

const STRONG_ROWCOUNT_FOR_TOP = 10;
const STRONG_COLUMNCOUNT_FOR_SELECT = 8;

function isLikelyFetchXml(queryPath: string): boolean {
  return queryPath.trim().startsWith("<fetch");
}

function normalizeQueryOptionName(name: string): string {
  return name.trim().toLowerCase();
}

function hasQueryOption(queryPath: string, optionName: string): boolean {
  const normalizedOption = normalizeQueryOptionName(optionName);
  const trimmed = queryPath.trim();
  const qIndex = trimmed.indexOf("?");

  if (qIndex < 0) {
    return false;
  }

  const queryString = trimmed.slice(qIndex + 1);
  if (!queryString) {
    return false;
  }

  for (const part of queryString.split("&")) {
    const key = part.split("=")[0] ?? "";
    if (normalizeQueryOptionName(key) == normalizedOption) {
      return true;
    }
  }

  return false;
}

export function buildResultViewerBinderSuggestion(args: {
  queryPath: string;
  rowCount: number;
  columnCount: number;
  traversalContext?: ResultViewerTraversalContext;
}): BinderSuggestion | undefined {
  const traversal = args.traversalContext;

  if (traversal?.hasNextLeg && traversal.traversalSessionId) {
    return {
      text: traversal.nextLegEntityName
        ? `💡 Want to continue this traversal to ${traversal.nextLegEntityName}?`
        : "💡 Want to continue this traversal?",
      actionId: "continueTraversal",
      payload: {
        traversalSessionId: traversal.traversalSessionId
      }
    };
  }

  if (traversal?.isFinalLeg && traversal.canRunBatch && traversal.traversalSessionId) {
    return {
      text: "💡 This traversal is ready to run as $batch.",
      actionId: "runTraversalBatch",
      payload: {
        traversalSessionId: traversal.traversalSessionId
      }
    };
  }

  if (!args.queryPath.trim() || isLikelyFetchXml(args.queryPath)) {
    return undefined;
  }

  const parsed = parseEditorQuery(args.queryPath);
  const hasTop = parsed.queryOptions.has("$top") || hasQueryOption(args.queryPath, "$top");
  const hasFilter = parsed.queryOptions.has("$filter") || hasQueryOption(args.queryPath, "$filter");
  const hasSelect = parsed.queryOptions.has("$select") || hasQueryOption(args.queryPath, "$select");

  if (!hasTop && (!hasFilter || args.rowCount >= STRONG_ROWCOUNT_FOR_TOP)) {
    return {
      text: "💡 This query looks broad — add $top?",
      actionId: "previewAddTop",
      payload: {
        queryPath: args.queryPath,
        value: 50
      }
    };
  }

  if (!hasSelect && args.columnCount >= STRONG_COLUMNCOUNT_FOR_SELECT) {
    return {
      text: "💡 Want to reduce noise with $select?",
      actionId: "previewAddSelect",
      payload: {
        queryPath: args.queryPath
      }
    };
  }

  return undefined;
}

export function buildBatchResultViewerBinderSuggestion(args: {
  traversalSessionId?: string;
  canRunOptimizedBatch?: boolean;
}): BinderSuggestion | undefined {
  if (!args.traversalSessionId || !args.canRunOptimizedBatch) {
    return undefined;
  }

  return {
    text: "💡 Want to tighten this $batch before running it again?",
    actionId: "runTraversalOptimizedBatch",
    payload: {
      traversalSessionId: args.traversalSessionId
    }
  };
}
