import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { SmartPatchState } from "./smartPatchTypes.js";
import { buildPatchBody, buildPatchPath } from "./smartPatchQueryBuilder.js";
import { saveLastState } from "./smartPatchPersistence.js";
import { findLogicalEditorQueryTargetBySourceTarget } from "../shared/queryMutation/editorQueryTarget.js";
import { showResultViewerForQuery } from "../execution/shared/resultViewerLauncher.js";
import { updatePreviewSurface } from "../../../../services/previewSurfaceService.js";
import type { PreviewSurfaceRiskLevel, PreviewSurfaceSection } from "../../../../services/previewSurfaceTypes.js";

export type SmartPatchExecutionDeps = {
  buildPath: (state: SmartPatchState) => string;
  buildBody: (state: SmartPatchState) => Record<string, unknown>;
  saveState: (ctx: CommandContext, state: SmartPatchState) => Promise<void>;
  logInfoMessage: (output: CommandContext["output"], message: string) => void;
  logDebugMessage: (output: CommandContext["output"], message: string) => void;
  showJson?: (name: string, data: unknown) => Promise<void>;
  showPatchResultPreview?: (ctx: CommandContext, state: SmartPatchState, result: SmartPatchExecutionPreviewResult) => void;
  showInformationMessage?: typeof vscode.window.showInformationMessage;
  showWarningMessage?: typeof vscode.window.showWarningMessage;
};

type PatchRefreshResult = {
  refreshed: boolean;
  message?: string;
};

export type SmartPatchExecutionPreviewResult = {
  patchPath: string;
  payload: Record<string, unknown>;
  result?: unknown;
  durationMs: number;
  status: "success" | "failed";
  errorMessage?: string;
  refresh: PatchRefreshResult;
};

const defaultDeps: SmartPatchExecutionDeps = {
  buildPath: buildPatchPath,
  buildBody: buildPatchBody,
  saveState: saveLastState,
  logInfoMessage: logInfo,
  logDebugMessage: logDebug,
  showJson: async () => undefined,
  showPatchResultPreview: showSmartPatchExecutionResultPreview,
  showInformationMessage: vscode.window.showInformationMessage,
  showWarningMessage: vscode.window.showWarningMessage
};

export async function executeSmartPatchWithDeps(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState,
  deps: SmartPatchExecutionDeps
): Promise<void> {
  const patchPath = deps.buildPath(state);
  const body = deps.buildBody(state);

  await deps.saveState(ctx, state);

  const env = ctx.envContext.getEnvironmentName();

  deps.logInfoMessage(
    ctx.output,
    `[DV:${env}] PATCH ${patchPath.replace(/^\//, "")}`
  );

  deps.logDebugMessage(
    ctx.output,
    `Payload fields: ${state.fields.map((x) => x.logicalName).join(", ")}`
  );

  const start = Date.now();
  let result: unknown;

  try {
    result = await client.patch(patchPath, token, body, state.ifMatch);
  } catch (error) {
    const duration = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    deps.showPatchResultPreview?.(ctx, state, {
      patchPath,
      payload: body,
      durationMs: duration,
      status: "failed",
      errorMessage: message,
      refresh: { refreshed: false, message: "Result Viewer was not refreshed because PATCH failed." }
    });
    throw error;
  }

  const duration = Date.now() - start;

  deps.logInfoMessage(ctx.output, `→ Record updated (${duration}ms)`);
  void (deps.showInformationMessage ?? vscode.window.showInformationMessage)(`DV Quick Run: PATCH applied to ${state.entitySetName} (${duration}ms).`);

  await deps.showJson?.(`DVQR_PATCH_${state.entitySetName}_${state.id}`, {
    entity: state.entitySetName,
    id: state.id,
    path: patchPath,
    ifMatch: state.ifMatch,
    payload: body,
    result
  });

  const refresh = await refreshResultViewerAfterPatch(ctx, client, token, state, deps);

  deps.showPatchResultPreview?.(ctx, state, {
    patchPath,
    payload: body,
    result,
    durationMs: duration,
    status: "success",
    refresh
  });
}

async function refreshResultViewerAfterPatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState,
  deps: SmartPatchExecutionDeps
): Promise<PatchRefreshResult> {
  const sourceTarget = state.refreshSourceTarget;
  if (!sourceTarget) {
    const message = "No source query target was captured.";
    deps.logDebugMessage(ctx.output, `PATCH refresh skipped: ${message}`);
    return { refreshed: false, message };
  }

  try {
    const target = await findLogicalEditorQueryTargetBySourceTarget(sourceTarget);
    const rawQueryText = target.text.trim();

    const logicalQueryText = rawQueryText
      .replace(/:\s*$/, "")
      .trim();

    const queryPath = `/${logicalQueryText
      .replace(/^\/+/, "")
      .replace(/^api\/data\/v9\.2\/?/i, "")}`;

    if (!queryPath) {
      const message = "Source query is empty.";
      deps.logDebugMessage(ctx.output, `PATCH refresh skipped: ${message}`);
      return { refreshed: false, message };
    }

    deps.logInfoMessage(ctx.output, `[DV:${ctx.envContext.getEnvironmentName()}] Refreshing Result Viewer after PATCH`);
    const result = await client.get(queryPath, token);
    await showResultViewerForQuery(ctx, result, logicalQueryText);
    deps.logInfoMessage(ctx.output, "→ Result Viewer refreshed after PATCH");
    return { refreshed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logInfoMessage(ctx.output, `→ PATCH applied, but Result Viewer refresh failed: ${message}`);
    void (deps.showWarningMessage ?? vscode.window.showWarningMessage)(`DV Quick Run: PATCH applied, but result refresh failed. ${message}`);
    return { refreshed: false, message };
  }
}

function showSmartPatchExecutionResultPreview(
  ctx: CommandContext,
  state: SmartPatchState,
  result: SmartPatchExecutionPreviewResult
): void {
  const environment = ctx.envContext.getEnvironmentName();
  updatePreviewSurface({
    kind: "patch",
    title: result.status === "success" ? "DV Quick Run – PATCH Applied" : "DV Quick Run – PATCH Failed",
    source: "smartPatch",
    sourceAction: result.status === "success" ? "Smart PATCH result" : "Smart PATCH failure",
    environmentName: environment,
    riskLevel: resolvePatchRiskLevel(ctx),
    summary: buildPatchResultSummary(environment, result),
    sections: buildPatchResultSections(state, result),
    secondaryActions: []
  });
}

function resolvePatchRiskLevel(ctx: CommandContext): PreviewSurfaceRiskLevel {
  const colorHint = ctx.envContext.getActiveEnvironment()?.statusBarColor ?? "white";
  if (colorHint === "red" || colorHint === "amber") {
    return colorHint;
  }
  return "normal";
}

function buildPatchResultSummary(environment: string, result: SmartPatchExecutionPreviewResult): string {
  if (result.status === "failed") {
    return `DV Quick Run: PATCH failed in ${environment}. Result Viewer was not refreshed.`;
  }

  const refreshText = result.refresh.refreshed
    ? "Result Viewer refreshed."
    : `Result Viewer was not refreshed. ${result.refresh.message ?? ""}`.trim();
  return `DV Quick Run: PATCH applied in ${environment}. ${refreshText}`;
}

function buildPatchResultSections(
  state: SmartPatchState,
  result: SmartPatchExecutionPreviewResult
): PreviewSurfaceSection[] {
  const fieldSummary = state.fields
    .map((field) => `- ${field.logicalName}: ${field.setNull === true ? "<null>" : (field.displayValue ?? field.rawValue)}`)
    .join("\n");

  return [
    {
      title: "Target",
      content: [
        `Entity: ${state.entitySetName} (${state.entityLogicalName})`,
        `Record ID: ${state.id}`,
        `PATCH path: ${result.patchPath}`,
        `If-Match: ${state.ifMatch}`
      ].join("\n"),
      language: "text"
    },
    {
      title: "Fields",
      content: fieldSummary || "(none)",
      language: "text"
    },
    {
      title: "Payload",
      content: JSON.stringify(result.payload, null, 2),
      language: "json"
    },
    {
      title: "PATCH Result",
      content: buildPatchResultText(result),
      language: "text"
    },
    {
      title: "Raw Response",
      content: JSON.stringify(result.result ?? { status: result.status }, null, 2),
      language: "json"
    }
  ];
}

function buildPatchResultText(result: SmartPatchExecutionPreviewResult): string {
  if (result.status === "failed") {
    return [
      "Status: Failed",
      `Duration: ${result.durationMs}ms`,
      `Message: ${result.errorMessage ?? "Unknown error"}`,
      "Result Viewer refreshed: No"
    ].join("\n");
  }

  return [
    "Status: Success",
    `HTTP: ${resolveHttpStatusLabel(result.result)}`,
    `Duration: ${result.durationMs}ms`,
    `Result Viewer refreshed: ${result.refresh.refreshed ? "Yes" : "No"}`,
    result.refresh.message ? `Refresh detail: ${result.refresh.message}` : ""
  ].filter(Boolean).join("\n");
}

function resolveHttpStatusLabel(result: unknown): string {
  const status = typeof result === "object" && result && "status" in result
    ? Number((result as { status?: unknown }).status)
    : 204;

  if (status === 204) {
    return "204 No Content";
  }

  return Number.isFinite(status) ? String(status) : "Unknown";
}

export async function executeSmartPatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState
): Promise<void> {
  await executeSmartPatchWithDeps(ctx, client, token, state, defaultDeps);
}
