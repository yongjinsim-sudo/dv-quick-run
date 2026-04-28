import { canApplyQueryDoctorFix } from "../capabilities/capabilityResolver.js";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { extractExecutionEvidence } from "../../commands/router/actions/shared/diagnostics/executionEvidence.js";
import { buildRankedResultInsightCandidates } from "../../commands/router/actions/shared/diagnostics/resultInsights/resultInsightPipeline.js";
import type { ResultViewerTraversalContext } from "../../services/resultViewModelBuilder.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type { BinderSuggestion } from "./binderTypes.js";

const STRONG_ROWCOUNT_FOR_TOP = 25;
const STRONG_COLUMNCOUNT_FOR_SELECT = 10;
const MIN_BINDER_CONFIDENCE = 0.75;
const MAX_RESULT_INSIGHT_SUGGESTIONS = 3;

function isPreviewApplyAction(actionId: BinderSuggestion["actionId"]): boolean {
  return actionId === "previewAddTop" ||
    actionId === "previewAddSelect" ||
    actionId === "previewODataFilter";
}

function buildSuggestion(suggestion: BinderSuggestion): BinderSuggestion | undefined {
  if (suggestion.confidence < MIN_BINDER_CONFIDENCE) {
    return undefined;
  }

  if (!isPreviewApplyAction(suggestion.actionId)) {
    return suggestion;
  }

  return {
    ...suggestion,
    canApply: canApplyQueryDoctorFix(),
    applyLabel: "Apply"
  };
}

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
    if (normalizeQueryOptionName(key) === normalizedOption) {
      return true;
    }
  }

  return false;
}

function getParsedQueryShape(queryPath: string) {
  const parsed = parseEditorQuery(queryPath);
  return {
    hasTop: parsed.queryOptions.has("$top") || hasQueryOption(queryPath, "$top"),
    hasFilter: parsed.queryOptions.has("$filter") || hasQueryOption(queryPath, "$filter"),
    hasSelect: parsed.queryOptions.has("$select") || hasQueryOption(queryPath, "$select"),
    filter: parsed.queryOptions.get("$filter") ?? ""
  };
}

function buildTopSuggestion(args: { queryPath: string; rowCount: number; hasFilter: boolean }): BinderSuggestion | undefined {
  if (args.hasFilter && args.rowCount < STRONG_ROWCOUNT_FOR_TOP) {
    return undefined;
  }

  return buildSuggestion({
    text: "💡 Recommended next step: add $top to keep this query bounded",
    actionId: "previewAddTop",
    confidence: args.hasFilter ? 0.82 : 0.9,
    reason: args.hasFilter
      ? "The filtered result is still broad enough that a bounded preview is safer."
      : "The query has no $top and no narrowing filter, so a bounded preview is safer.",
    source: "queryShape",
    payload: {
      queryPath: args.queryPath,
      value: 50
    }
  });
}

function buildSelectSuggestion(args: { queryPath: string; columnCount: number }): BinderSuggestion | undefined {
  if (args.columnCount < STRONG_COLUMNCOUNT_FOR_SELECT) {
    return undefined;
  }

  return buildSuggestion({
    text: "💡 Recommended next step: reduce visible noise with $select",
    actionId: "previewAddSelect",
    confidence: args.columnCount >= STRONG_COLUMNCOUNT_FOR_SELECT + 4 ? 0.82 : 0.76,
    reason: "The result shape is wide and would be easier to inspect with an explicit $select.",
    source: "resultShape",
    payload: {
      queryPath: args.queryPath
    }
  });
}

function renderInsightValue(value: unknown, label: unknown): string {
  const display = String(label ?? value ?? "").trim();
  return display || "value";
}

function buildResultFilterSuggestions(args: {
  queryPath: string;
  result: unknown;
  fields?: FieldDef[];
}): BinderSuggestion[] {
  if (!args.queryPath.trim() || isLikelyFetchXml(args.queryPath)) {
    return [];
  }

  const evidence = extractExecutionEvidence(args.queryPath, args.result, 0);
  const candidates = buildRankedResultInsightCandidates({
    evidence,
    fields: args.fields
  });

  return candidates
    .slice(0, MAX_RESULT_INSIGHT_SUGGESTIONS)
    .map((candidate, index) => {
      const observation = candidate.item.observation;
      const topValue = observation.topValues[0];
      const valueLabel = renderInsightValue(topValue?.rawValue, topValue?.value);
      const confidence = index === 0 ? 0.88 : 0.8;
      const fieldLabel = candidate.item.field?.displayName?.trim() || observation.field;
      const text = topValue
        ? `💡 Recommended next step: filter ${fieldLabel} to ${valueLabel}`
        : `💡 Recommended next step: filter ${fieldLabel}`;
      const reason = topValue
        ? `${fieldLabel} has a repeated value pattern in this result: ${valueLabel} appears ${topValue.count} times.`
        : `${fieldLabel} has the clearest observed narrowing signal in this result.`;

      return buildSuggestion({
        text,
        actionId: "previewODataFilter",
        confidence,
        reason,
        source: "queryDoctor",
        payload: {
          columnName: observation.field,
          rawValue: topValue?.rawValue ?? topValue?.value ?? "",
          displayValue: topValue?.value ?? topValue?.rawValue ?? "",
          fieldLogicalName: observation.field,
          isNullValue: false
        }
      });
    })
    .filter((suggestion): suggestion is BinderSuggestion => !!suggestion);
}

export function buildResultViewerInsightSuggestions(args: {
  queryPath: string;
  rowCount: number;
  columnCount: number;
  result: unknown;
  fields?: FieldDef[];
  traversalContext?: ResultViewerTraversalContext;
}): BinderSuggestion[] {
  if (!args.queryPath.trim() || isLikelyFetchXml(args.queryPath)) {
    return [];
  }

  const shape = getParsedQueryShape(args.queryPath);
  const suggestions: BinderSuggestion[] = [];

  if (!shape.hasTop) {
    const topSuggestion = buildTopSuggestion({
      queryPath: args.queryPath,
      rowCount: args.rowCount,
      hasFilter: shape.hasFilter
    });
    if (topSuggestion) {
      suggestions.push(topSuggestion);
    }
  }

  if (!shape.hasSelect) {
    const selectSuggestion = buildSelectSuggestion({
      queryPath: args.queryPath,
      columnCount: args.columnCount
    });
    if (selectSuggestion) {
      suggestions.push(selectSuggestion);
    }
  }

  suggestions.push(...buildResultFilterSuggestions({
    queryPath: args.queryPath,
    result: args.result,
    fields: args.fields
  }));

  return suggestions;
}

export function buildResultViewerBinderSuggestion(args: {
  queryPath: string;
  rowCount: number;
  columnCount: number;
  traversalContext?: ResultViewerTraversalContext;
}): BinderSuggestion | undefined {
  const traversal = args.traversalContext;
  const shouldPreferTraversalSuggestion = traversal?.isBestMatchRoute !== false;

  if (shouldPreferTraversalSuggestion && traversal?.hasNextLeg && traversal.traversalSessionId) {
    return buildSuggestion({
      text: traversal.nextLegEntityName
        ? `💡 Recommended next step: continue this traversal to ${traversal.nextLegEntityName}`
        : "💡 Recommended next step: continue this traversal",
      actionId: "continueTraversal",
      confidence: 0.96,
      reason: "An active best-match traversal session has a deterministic next leg.",
      source: "traversal",
      payload: {
        traversalSessionId: traversal.traversalSessionId
      }
    });
  }

  if (shouldPreferTraversalSuggestion && traversal?.isFinalLeg && traversal.canRunBatch && traversal.traversalSessionId) {
    return buildSuggestion({
      text: "💡 Recommended next step: run this traversal as $batch",
      actionId: "runTraversalBatch",
      confidence: 0.92,
      reason: "The traversal has reached its final leg and can be replayed as a read-only batch workflow.",
      source: "traversal",
      payload: {
        traversalSessionId: traversal.traversalSessionId
      }
    });
  }

  if (!args.queryPath.trim() || isLikelyFetchXml(args.queryPath)) {
    return undefined;
  }

  const shape = getParsedQueryShape(args.queryPath);

  if (!shape.hasTop) {
    const topSuggestion = buildTopSuggestion({
      queryPath: args.queryPath,
      rowCount: args.rowCount,
      hasFilter: shape.hasFilter
    });
    if (topSuggestion) {
      return topSuggestion;
    }
  }

  if (!shape.hasSelect) {
    const selectSuggestion = buildSelectSuggestion({
      queryPath: args.queryPath,
      columnCount: args.columnCount
    });
    if (selectSuggestion) {
      return selectSuggestion;
    }
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

  return buildSuggestion({
    text: "💡 Recommended next step: tighten this $batch before replay",
    actionId: "runTraversalOptimizedBatch",
    confidence: 0.88,
    reason: "This batch is traversal-backed and has an optimized replay path available.",
    source: "batch",
    payload: {
      traversalSessionId: args.traversalSessionId
    }
  });
}
