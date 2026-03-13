import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import { initSmartPatchContext } from "./smartPatchContext.js";
import { executeSmartPatch } from "./smartPatchExecution.js";
import { buildInitialSmartPatchState } from "./smartPatchFieldSelection.js";
import { loadLastState } from "./smartPatchPersistence.js";
import { runSmartPatchReviewLoop } from "./smartPatchReview.js";

export async function runSmartPatchWorkflow(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Smart PATCH failed. Check Output.", async () => {
    const { token, client, baseUrl, session } = await initSmartPatchContext(ctx);

    const built = await buildInitialSmartPatchState(session, undefined);
    if (!built) {
      return;
    }

    const reviewed = await runSmartPatchReviewLoop(
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

    await executeSmartPatch(ctx, client, token, reviewed.state);
  });
}

export async function runSmartPatchRerunLastWorkflow(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Re-run last PATCH failed. Check Output.", async () => {
    const last = loadLastState(ctx);
    if (!last) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart PATCH state found yet.");
      return;
    }

    const { token, client } = await initSmartPatchContext(ctx);
    await executeSmartPatch(ctx, client, token, last);
  });
}

export async function runSmartPatchEditLastWorkflow(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Edit last PATCH failed. Check Output.", async () => {
    const last = loadLastState(ctx);
    if (!last) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart PATCH state found yet.");
      return;
    }

    const { token, client, baseUrl, session } = await initSmartPatchContext(ctx);

    const rebuilt = await buildInitialSmartPatchState(session, last);
    if (!rebuilt) {
      return;
    }

    const reviewed = await runSmartPatchReviewLoop(
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

    await executeSmartPatch(ctx, client, token, reviewed.state);
  });
}
