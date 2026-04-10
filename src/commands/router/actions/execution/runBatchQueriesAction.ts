import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import { detectQueryKind } from "../../../../shared/editorIntelligence/queryDetection.js";
import { normalizePath } from "./get/getQueryBuilder.js";
import { logDebug, logInfo, logWarn } from "../../../../utils/logger.js";
import { buildBatchRequestBody, type BatchExecutionPart } from "../../../../services/batchExecution.js";
import { openBatchPreviewDocument } from "./batch/batchDocument.js";
import { showBatchResultViewer } from "./shared/resultViewerLauncher.js";

export async function runBatchQueriesAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Run as $batch failed. Check Output.", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage("DV Quick Run: Open a document with two or more OData GET queries first.");
      return;
    }

    const queries = extractBatchCandidateQueries(editor.document, editor.selection);
    if (queries.length < 2) {
      void vscode.window.showWarningMessage(
        "DV Quick Run: Batch execution requires at least two OData GET queries. Select multiple query lines or place them in the current document."
      );
      return;
    }

    const normalizedQueries = queries.map((query) => normalizePath(query));
    const previewBoundary = "batch_preview";
    const batchPreview = buildBatchRequestBody(await ctx.getBaseUrl(), normalizedQueries, previewBoundary);
    await openBatchPreviewDocument(normalizedQueries, batchPreview);

    const choice = await vscode.window.showWarningMessage(
      `DV Quick Run: Execute ${normalizedQueries.length} read-only GET queries as one $batch call?`,
      { modal: true },
      "Run as $batch"
    );

    if (choice !== "Run as $batch") {
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

    await showBatchResultViewer(ctx, result.parts);
  });
}

function extractBatchCandidateQueries(document: vscode.TextDocument, selection: vscode.Selection): string[] {
  const sourceText = selection && !selection.isEmpty
    ? document.getText(selection)
    : document.getText();

  return sourceText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => detectQueryKind(line) === "odata")
    .filter((line: string, index: number, lines: string[]) => lines.indexOf(line) === index);
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

