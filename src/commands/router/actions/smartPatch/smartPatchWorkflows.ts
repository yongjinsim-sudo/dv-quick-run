import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import { initSmartPatchContext } from "./smartPatchContext.js";
import { executeSmartPatch } from "./smartPatchExecution.js";
import { buildInitialSmartPatchState } from "./smartPatchFieldSelection.js";
import { loadLastState } from "./smartPatchPersistence.js";
import { previewAndConfirmSmartPatch } from "./smartPatchPreview.js";
import { runSmartPatchReviewLoop } from "./smartPatchReview.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import type { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";
import type { PatchFieldValue, SmartField, SmartPatchRefreshSourceTarget, SmartPatchState } from "./smartPatchTypes.js";

type InitResult = { token: string; client: DataverseClient; baseUrl: string; session: SmartMetadataSession };
type BuiltPatch = { state: SmartPatchState; fields: SmartField[] } | undefined;

type SmartPatchWorkflowDeps = {
  runActionWrapper: typeof runAction;
  initContext: (ctx: CommandContext) => Promise<InitResult>;
  buildInitialState: (session: SmartMetadataSession, initial?: SmartPatchState) => Promise<BuiltPatch>;
  reviewLoop: (
    ctx: CommandContext,
    client: DataverseClient,
    token: string,
    baseUrl: string,
    session: SmartMetadataSession,
    state: SmartPatchState,
    fields: SmartField[]
  ) => Promise<BuiltPatch>;
  executePatch: (ctx: CommandContext, client: DataverseClient, token: string, state: SmartPatchState) => Promise<void>;
  previewPatch?: (ctx: CommandContext, baseUrl: string, state: SmartPatchState) => Promise<boolean>;
  loadLastState: (ctx: CommandContext) => SmartPatchState | undefined;
  showInformationMessage: (message: string) => Thenable<string | undefined>;
};

const defaultDeps: SmartPatchWorkflowDeps = {
  runActionWrapper: runAction,
  initContext: initSmartPatchContext,
  buildInitialState: buildInitialSmartPatchState,
  reviewLoop: runSmartPatchReviewLoop,
  executePatch: executeSmartPatch,
  previewPatch: previewAndConfirmSmartPatch,
  loadLastState,
  showInformationMessage: vscode.window.showInformationMessage
};

async function confirmPatchPreview(
  deps: SmartPatchWorkflowDeps,
  ctx: CommandContext,
  baseUrl: string,
  state: SmartPatchState
): Promise<boolean> {
  return deps.previewPatch ? deps.previewPatch(ctx, baseUrl, state) : true;
}

export async function runSmartPatchWorkflowWithDeps(ctx: CommandContext, deps: SmartPatchWorkflowDeps): Promise<void> {
  await deps.runActionWrapper(ctx, "DV Quick Run: Smart PATCH failed. Check Output.", async () => {
    const { token, client, baseUrl, session } = await deps.initContext(ctx);

    const built = await deps.buildInitialState(session, undefined);
    if (!built) {
      return;
    }

    const reviewed = await deps.reviewLoop(
      ctx,
      client,
      token,
      baseUrl,
      session,
      built.state,
      built.fields
    );
    if (!reviewed) {
      return;
    }

    const confirmed = await confirmPatchPreview(deps, ctx, baseUrl, reviewed.state);
    if (!confirmed) {
      return;
    }

    await deps.executePatch(ctx, client, token, reviewed.state);
  });
}

export async function runSmartPatchRerunLastWorkflowWithDeps(ctx: CommandContext, deps: SmartPatchWorkflowDeps): Promise<void> {
  await deps.runActionWrapper(ctx, "DV Quick Run: Re-run last PATCH failed. Check Output.", async () => {
    const last = deps.loadLastState(ctx);
    if (!last) {
      await deps.showInformationMessage("DV Quick Run: No previous Smart PATCH state found yet.");
      return;
    }

    const { token, client } = await deps.initContext(ctx);
    await deps.executePatch(ctx, client, token, last);
  });
}

export async function runSmartPatchEditLastWorkflowWithDeps(ctx: CommandContext, deps: SmartPatchWorkflowDeps): Promise<void> {
  await deps.runActionWrapper(ctx, "DV Quick Run: Edit last PATCH failed. Check Output.", async () => {
    const last = deps.loadLastState(ctx);
    if (!last) {
      await deps.showInformationMessage("DV Quick Run: No previous Smart PATCH state found yet.");
      return;
    }

    const { token, client, baseUrl, session } = await deps.initContext(ctx);

    const rebuilt = await deps.buildInitialState(session, last);
    if (!rebuilt) {
      return;
    }

    const reviewed = await deps.reviewLoop(
      ctx,
      client,
      token,
      baseUrl,
      session,
      rebuilt.state,
      rebuilt.fields
    );
    if (!reviewed) {
      return;
    }

    const confirmed = await confirmPatchPreview(deps, ctx, baseUrl, reviewed.state);
    if (!confirmed) {
      return;
    }

    await deps.executePatch(ctx, client, token, reviewed.state);
  });
}

export async function runSmartPatchWorkflow(ctx: CommandContext): Promise<void> {
  await runSmartPatchWorkflowWithDeps(ctx, defaultDeps);
}

export async function runSmartPatchRerunLastWorkflow(ctx: CommandContext): Promise<void> {
  await runSmartPatchRerunLastWorkflowWithDeps(ctx, defaultDeps);
}

export async function runSmartPatchEditLastWorkflow(ctx: CommandContext): Promise<void> {
  await runSmartPatchEditLastWorkflowWithDeps(ctx, defaultDeps);
}

export async function runSmartPatchPrefilledWorkflow(
  ctx: CommandContext,
  initial: Pick<SmartPatchState, "entityLogicalName" | "entitySetName" | "id"> & { fields?: PatchFieldValue[]; refreshSourceTarget?: SmartPatchRefreshSourceTarget }
): Promise<void> {
  await defaultDeps.runActionWrapper(ctx, "DV Quick Run: Smart PATCH failed. Check Output.", async () => {
    const { token, client, baseUrl, session } = await defaultDeps.initContext(ctx);

    const built = await defaultDeps.buildInitialState(session, {
      entityLogicalName: initial.entityLogicalName,
      entitySetName: initial.entitySetName,
      id: initial.id,
      fields: initial.fields ?? [],
      ifMatch: "*",
      refreshSourceTarget: initial.refreshSourceTarget
    });
    if (!built) {
      return;
    }

    const reviewed = await defaultDeps.reviewLoop(
      ctx,
      client,
      token,
      baseUrl,
      session,
      built.state,
      built.fields
    );
    if (!reviewed) {
      return;
    }

    const confirmed = await confirmPatchPreview(defaultDeps, ctx, baseUrl, reviewed.state);
    if (!confirmed) {
      return;
    }

    await defaultDeps.executePatch(ctx, client, token, reviewed.state);
  });
}
