import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { SmartPatchState } from "./smartPatchTypes.js";
import { buildPatchBody, buildPatchPath } from "./smartPatchQueryBuilder.js";
import { saveLastState } from "./smartPatchPersistence.js";

export type SmartPatchExecutionDeps = {
  buildPath: (state: SmartPatchState) => string;
  buildBody: (state: SmartPatchState) => Record<string, unknown>;
  saveState: (ctx: CommandContext, state: SmartPatchState) => Promise<void>;
  logInfoMessage: (output: CommandContext["output"], message: string) => void;
  logDebugMessage: (output: CommandContext["output"], message: string) => void;
  showJson: (name: string, data: unknown) => Promise<void>;
};

const defaultDeps: SmartPatchExecutionDeps = {
  buildPath: buildPatchPath,
  buildBody: buildPatchBody,
  saveState: saveLastState,
  logInfoMessage: logInfo,
  logDebugMessage: logDebug,
  showJson: showJsonNamed
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

  await deps.showJson(`DVQR_PATCH_${state.entitySetName}_${state.id}`, {
    entity: state.entitySetName,
    id: state.id,
    path: patchPath,
    ifMatch: state.ifMatch,
    payload: body,
    result
  });
}

export async function executeSmartPatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState
): Promise<void> {
  await executeSmartPatchWithDeps(ctx, client, token, state, defaultDeps);
}