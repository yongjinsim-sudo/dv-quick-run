import * as vscode from "vscode";
import type { CommandContext } from "../../../../context/commandContext.js";
import { normalizePath } from "../get/getQueryBuilder.js";
import { logDebug, logInfo, logWarn } from "../../../../../utils/logger.js";
import { buildBatchRequestBody, type BatchExecutionPart } from "../../../../../services/batchExecution.js";
import { showBatchPreview } from "./batchDocument.js";
import { showBatchResultViewer } from "../shared/resultViewerLauncher.js";

type BatchRunOptions = {
  previewTitle?: string;
  traversalSessionId?: string;
  canRunOptimizedBatch?: boolean;
};

export async function previewAndRunBatchQueries(
  ctx: CommandContext,
  queries: string[],
  options?: BatchRunOptions
): Promise<void> {
  const normalizedQueries = queries.map((query) => normalizePath(query));
  const previewBoundary = "batch_preview";
  const batchPreview = buildBatchRequestBody(await ctx.getBaseUrl(), normalizedQueries, previewBoundary);
  const previewResult = await showBatchPreview(normalizedQueries, batchPreview);

  if (previewResult.actionKind !== "apply") {
    void vscode.window.showInformationMessage("DV Quick Run: Batch preview cancelled.");
    return;
  }

  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();

  logInfo(ctx.output, `[DV:${ctx.envContext.getEnvironmentName()}] BATCH ${normalizedQueries.length} GET request(s)`);
  normalizedQueries.forEach((query, index) => {
    logDebug(ctx.output, `BATCH[${index + 1}] GET ${query}`);
  });

  const startedAt = Date.now();
  const result = await client.batchGet(normalizedQueries, token);
  const durationMs = Date.now() - startedAt;

  result.parts.forEach((part) => {
    const summary = buildOutputSummary(part);
    if (part.statusCode >= 400 || part.statusCode === 0) {
      logWarn(ctx.output, `→ Request ${part.index + 1}: ${summary}`);
      return;
    }

    logInfo(ctx.output, `→ Request ${part.index + 1}: ${summary}`);
  });
  logInfo(ctx.output, `→ Batch completed (${durationMs}ms)`);

  await showBatchResultViewer(ctx, result.parts, {
    traversalSessionId: options?.traversalSessionId,
    canRunOptimizedBatch: options?.canRunOptimizedBatch
  });
}

function buildOutputSummary(part: BatchExecutionPart): string {
  const status = `${part.statusCode} ${part.statusText}`.trim();

  if (part.resultType === "collection") {
    const value = part.payload && typeof part.payload === "object" && !Array.isArray(part.payload)
      ? (part.payload as Record<string, unknown>).value
      : undefined;
    return `${status} • ${Array.isArray(value) ? value.length : 0} row(s)`;
  }

  if (part.resultType === "single") {
    return `${status} • single record`;
  }

  if (part.resultType === "empty") {
    return `${status} • no content`;
  }

  if (part.resultType === "raw") {
    return `${status} • raw response`;
  }

  return `${status} • ${part.error ?? "error"}`;
}
