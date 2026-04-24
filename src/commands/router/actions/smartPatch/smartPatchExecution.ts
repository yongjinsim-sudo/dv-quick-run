import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { SmartPatchState } from "./smartPatchTypes.js";
import { buildPatchBody, buildPatchPath } from "./smartPatchQueryBuilder.js";
import { saveLastState } from "./smartPatchPersistence.js";
import { findLogicalEditorQueryTargetBySourceTarget } from "../shared/queryMutation/editorQueryTarget.js";
import { showResultViewerForQuery } from "../execution/shared/resultViewerLauncher.js";

export type SmartPatchExecutionDeps = {
  buildPath: (state: SmartPatchState) => string;
  buildBody: (state: SmartPatchState) => Record<string, unknown>;
  saveState: (ctx: CommandContext, state: SmartPatchState) => Promise<void>;
  logInfoMessage: (output: CommandContext["output"], message: string) => void;
  logDebugMessage: (output: CommandContext["output"], message: string) => void;
  showJson: (name: string, data: unknown) => Promise<void>;
  showInformationMessage?: typeof vscode.window.showInformationMessage;
  showWarningMessage?: typeof vscode.window.showWarningMessage;
};

const defaultDeps: SmartPatchExecutionDeps = {
  buildPath: buildPatchPath,
  buildBody: buildPatchBody,
  saveState: saveLastState,
  logInfoMessage: logInfo,
  logDebugMessage: logDebug,
  showJson: showJsonNamed,
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
  const result = await client.patch(patchPath, token, body, state.ifMatch);
  const duration = Date.now() - start;

  deps.logInfoMessage(ctx.output, `→ Record updated (${duration}ms)`);
  void (deps.showInformationMessage ?? vscode.window.showInformationMessage)(`DV Quick Run: PATCH applied to ${state.entitySetName} (${duration}ms).`);

  await deps.showJson(`DVQR_PATCH_${state.entitySetName}_${state.id}`, {
    entity: state.entitySetName,
    id: state.id,
    path: patchPath,
    ifMatch: state.ifMatch,
    payload: body,
    result
  });

  await refreshResultViewerAfterPatch(ctx, client, token, state, deps);
}

async function refreshResultViewerAfterPatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState,
  deps: SmartPatchExecutionDeps
): Promise<void> {
  const sourceTarget = state.refreshSourceTarget;
  if (!sourceTarget) {
    deps.logDebugMessage(ctx.output, "PATCH refresh skipped: no source query target was captured.");
    return;
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
      deps.logDebugMessage(ctx.output, "PATCH refresh skipped: source query is empty.");
      return;
    }

    deps.logInfoMessage(ctx.output, `[DV:${ctx.envContext.getEnvironmentName()}] Refreshing Result Viewer after PATCH`);
    const result = await client.get(queryPath, token);
    await showResultViewerForQuery(ctx, result, logicalQueryText);
    deps.logInfoMessage(ctx.output, "→ Result Viewer refreshed after PATCH");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logInfoMessage(ctx.output, `→ PATCH applied, but Result Viewer refresh failed: ${message}`);
    void (deps.showWarningMessage ?? vscode.window.showWarningMessage)(`DV Quick Run: PATCH applied, but result refresh failed. ${message}`);
  }
}

export async function executeSmartPatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState
): Promise<void> {
  await executeSmartPatchWithDeps(ctx, client, token, state, defaultDeps);
}
