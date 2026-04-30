import { canApplyQueryDoctorFix } from "../capabilities/capabilityResolver.js";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { extractExecutionEvidence } from "../../commands/router/actions/shared/diagnostics/executionEvidence.js";
import { buildRankedResultInsightCandidates } from "../../commands/router/actions/shared/diagnostics/resultInsights/resultInsightPipeline.js";
import type { ResultViewerTraversalContext } from "../../services/resultViewModelBuilder.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type { BinderSuggestion } from "./binderTypes.js";
import {
  createInsightExecutionContext,
  DEFAULT_RESULT_INSIGHT_MAX_COLUMNS,
  DEFAULT_RESULT_INSIGHT_MAX_ROWS,
  isInsightBudgetExceeded
} from "./insightExecutionContext.js";
import type { InsightExecutionContext } from "./insightExecutionContext.js";

const STRONG_ROWCOUNT_FOR_TOP = 25;
const STRONG_COLUMNCOUNT_FOR_SELECT = 10;
const MIN_BINDER_CONFIDENCE = 0.75;
const MAX_RESULT_INSIGHT_SUGGESTIONS = 3;
const RESULT_INSIGHT_SAMPLE_ROW_LIMIT = DEFAULT_RESULT_INSIGHT_MAX_ROWS;
const RESULT_INSIGHT_SAMPLE_COLUMN_LIMIT = DEFAULT_RESULT_INSIGHT_MAX_COLUMNS;
const WIDE_RESULT_COLUMN_THRESHOLD = 40;

interface InsightSampleMetadata {
  sourceRowCount: number;
  sampledRowCount: number;
  sampleRowLimit: number;
  sampleColumnLimit: number;
  rowLimited: boolean;
  columnLimited: boolean;
}

interface SampledInsightResult {
  result: unknown;
  metadata: InsightSampleMetadata;
}

function isPreviewApplyAction(actionId: BinderSuggestion["actionId"]): boolean {
  return actionId === "previewAddTop" ||
    actionId === "previewAddSelect" ||
    actionId === "previewODataFilter" ||
    actionId === "requestResultInsights";
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
    canApply: suggestion.actionId === "requestResultInsights" ? true : canApplyQueryDoctorFix(),
    applyLabel: suggestion.actionId === "requestResultInsights" ? "Get Insights" : "Apply"
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

export function getParsedQueryShape(queryPath: string) {
  const parsed = parseEditorQuery(queryPath);
  return {
    hasTop: parsed.queryOptions.has("$top") || hasQueryOption(queryPath, "$top"),
    hasFilter: parsed.queryOptions.has("$filter") || hasQueryOption(queryPath, "$filter"),
    hasSelect: parsed.queryOptions.has("$select") || hasQueryOption(queryPath, "$select"),
    filter: parsed.queryOptions.get("$filter") ?? ""
  };
}


function getCollectionRows(result: unknown): Record<string, unknown>[] {
  if (typeof result !== "object" || result === null || !("value" in result)) {
    return [];
  }

  const value = result.value;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((row): row is Record<string, unknown> =>
    typeof row === "object" && row !== null && !Array.isArray(row)
  );
}

export function sampleResultForInsights(
  result: unknown,
  ctx: InsightExecutionContext = createInsightExecutionContext()
): SampledInsightResult {
  const rows = getCollectionRows(result);
  if (!rows.length) {
    return {
      result,
      metadata: {
        sourceRowCount: 0,
        sampledRowCount: 0,
        sampleRowLimit: ctx.maxRows,
        sampleColumnLimit: ctx.maxColumns,
        rowLimited: false,
        columnLimited: false
      }
    };
  }

  let columnLimited = false;
  // CRITICAL INVARIANT:
  // All result-based insights MUST use this sampled result only.
  // NEVER iterate over full result.value from insight providers. Wide enterprise entities can crash the extension host.
  const sampledRows = rows.slice(0, ctx.maxRows).map((row) => {
    const sampled: Record<string, unknown> = {};
    const observableKeys = Object.keys(row)
      .filter((key) => !key.includes("@OData.Community.Display.V1.FormattedValue"));
    const baseKeys = observableKeys.slice(0, ctx.maxColumns);
    columnLimited = columnLimited || observableKeys.length > baseKeys.length;

    for (const key of baseKeys) {
      sampled[key] = row[key];

      const formattedKey = `${key}@OData.Community.Display.V1.FormattedValue`;
      if (formattedKey in row) {
        sampled[formattedKey] = row[formattedKey];
      }
    }
    return sampled;
  });

  const baseResult = typeof result === "object" && result !== null && !Array.isArray(result)
    ? result
    : {};

  return {
    result: {
      ...baseResult,
      value: sampledRows
    },
    metadata: {
      sourceRowCount: rows.length,
      sampledRowCount: sampledRows.length,
      sampleRowLimit: ctx.maxRows,
      sampleColumnLimit: ctx.maxColumns,
      rowLimited: rows.length > sampledRows.length,
      columnLimited
    }
  };
}

function buildSampleDisclosure(metadata?: InsightSampleMetadata): string {
  if (!metadata || metadata.sampledRowCount <= 0) {
    return "";
  }

  const rows = metadata.rowLimited
    ? `${metadata.sampledRowCount} sampled rows from ${metadata.sourceRowCount} returned rows`
    : `${metadata.sampledRowCount} returned rows`;
  const columnNote = metadata.columnLimited
    ? ` and up to ${metadata.sampleColumnLimit} columns`
    : "";

  return `Observed in ${rows}${columnNote}. `;
}

function buildInsightsUnavailableSuggestion(reason?: string): BinderSuggestion[] {
  const suggestion = buildSuggestion({
    text: "💡 Insights unavailable: DV Quick Run skipped analysis to stay responsive",
    actionId: "requestResultInsights",
    confidence: 0.76,
    reason: reason ?? "Insight analysis was skipped to keep DV Quick Run responsive.",
    source: "performance",
    tier: "queryShape",
    payload: {
      reason: "insightAnalysisUnavailable"
    }
  });

  return suggestion ? [suggestion] : [];
}

function buildPartialInsightsSuggestion(): BinderSuggestion[] {
  const suggestion = buildSuggestion({
    text: "💡 Partial insights: analysis was limited for responsiveness",
    actionId: "requestResultInsights",
    confidence: 0.76,
    reason: "Insight analysis reached its soft budget. DV Quick Run returned partial insight guidance to stay responsive.",
    source: "performance",
    tier: "queryShape",
    payload: {
      reason: "insightBudgetExceeded"
    }
  });

  return suggestion ? [suggestion] : [];
}

function buildDeferredResultInsightSuggestion(args: {
  queryPath: string;
  hasSelect: boolean;
  rowCount: number;
  columnCount: number;
}): BinderSuggestion | undefined {
  const isBroadOrWide = !args.hasSelect || args.columnCount > WIDE_RESULT_COLUMN_THRESHOLD;
  if (!isBroadOrWide) {
    return undefined;
  }

  const reason = !args.hasSelect
    ? "This query is broad because it has no $select. DV Quick Run opened it safely to keep VS Code responsive. Click Get Insights to analyse a safe sample of the current result page."
    : "This result is wide. DV Quick Run opened it safely to keep VS Code responsive. Click Get Insights to analyse a safe sample of the current result page.";

  return buildSuggestion({
    text: "💡 Insights paused: analyse a safe sample when needed",
    actionId: "requestResultInsights",
    confidence: 0.99,
    reason,
    source: "performance",
    tier: "queryShape",
    payload: {
      queryPath: args.queryPath,
      rowCount: args.rowCount,
      columnCount: args.columnCount,
      sampleRows: RESULT_INSIGHT_SAMPLE_ROW_LIMIT,
      sampleColumns: RESULT_INSIGHT_SAMPLE_COLUMN_LIMIT
    }
  });
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
    tier: "queryShape",
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
    tier: "queryShape",
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
  sampleMetadata?: InsightSampleMetadata;
  ctx?: InsightExecutionContext;
}): BinderSuggestion[] {
  if (!args.queryPath.trim() || isLikelyFetchXml(args.queryPath)) {
    return [];
  }

  const ctx = args.ctx ?? createInsightExecutionContext();
  try {
    const evidence = extractExecutionEvidence(args.queryPath, args.result, 0);
    if (isInsightBudgetExceeded(ctx)) {
      return buildPartialInsightsSuggestion();
    }

    const candidates = buildRankedResultInsightCandidates({
      evidence,
      fields: args.fields
    });
    if (isInsightBudgetExceeded(ctx)) {
      return buildPartialInsightsSuggestion();
    }

    const sampleDisclosure = buildSampleDisclosure(args.sampleMetadata);

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
        ? `${sampleDisclosure}${fieldLabel} has a repeated value pattern in this result: ${valueLabel} appears ${topValue.count} times.`
        : `${sampleDisclosure}${fieldLabel} has the clearest observed narrowing signal in this result.`;

      return buildSuggestion({
        text,
        actionId: "previewODataFilter",
        confidence,
        reason,
        source: "queryDoctor",
        tier: "resultSample",
        payload: {
          columnName: observation.field,
          rawValue: topValue?.rawValue ?? topValue?.value ?? "",
          displayValue: topValue?.value ?? topValue?.rawValue ?? "",
          fieldLogicalName: observation.field,
          isNullValue: false,
          insightBasis: args.sampleMetadata ? "sampledCurrentResult" : "currentResult",
          sampleRowCount: args.sampleMetadata?.sampledRowCount,
          sourceRowCount: args.sampleMetadata?.sourceRowCount,
          sampleColumnLimit: args.sampleMetadata?.sampleColumnLimit,
          rowLimited: args.sampleMetadata?.rowLimited === true,
          columnLimited: args.sampleMetadata?.columnLimited === true
        }
      });
    })
    .filter((suggestion): suggestion is BinderSuggestion => !!suggestion);
  } catch {
    return buildInsightsUnavailableSuggestion();
  }
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

  const ctx = createInsightExecutionContext();
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

  const deferredInsight = buildDeferredResultInsightSuggestion({
    queryPath: args.queryPath,
    hasSelect: shape.hasSelect,
    rowCount: args.rowCount,
    columnCount: args.columnCount
  });

  if (deferredInsight) {
    suggestions.push(deferredInsight);
    return suggestions;
  }

  const sampled = sampleResultForInsights(args.result, ctx);
  suggestions.push(...buildResultFilterSuggestions({
    queryPath: args.queryPath,
    result: sampled.result,
    fields: args.fields,
    sampleMetadata: sampled.metadata,
    ctx
  }));

  return suggestions;
}

export function buildManualResultViewerInsightSuggestions(args: {
  queryPath: string;
  result: unknown;
  fields?: FieldDef[];
}): BinderSuggestion[] {
  if (!args.queryPath.trim() || isLikelyFetchXml(args.queryPath)) {
    return [];
  }

  const ctx = createInsightExecutionContext();
  const sampled = sampleResultForInsights(args.result, ctx);
  return buildResultFilterSuggestions({
    queryPath: args.queryPath,
    result: sampled.result,
    fields: args.fields,
    sampleMetadata: sampled.metadata,
    ctx
  });
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
      tier: "queryShape",
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
      tier: "queryShape",
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
    tier: "queryShape",
    payload: {
      traversalSessionId: args.traversalSessionId
    }
  });
}
