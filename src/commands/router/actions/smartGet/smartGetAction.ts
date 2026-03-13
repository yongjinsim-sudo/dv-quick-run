import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import {
  editSmartGetLastWorkflow,
  rerunSmartGetLastWorkflow,
  runSmartGetMainWorkflow
} from "./smartGetWorkflows.js";
import {
  runSmartGetFromGuidPickFieldsWorkflow,
  runSmartGetFromGuidRawWorkflow
} from "./smartGetGuidActions.js";

export async function runSmartGetAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Smart GET failed. Check Output.", async () => {
    await runSmartGetMainWorkflow(ctx);
  });
}

export async function runSmartGetRerunLastAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Re-run last failed. Check Output.", async () => {
    const found = await rerunSmartGetLastWorkflow(ctx);
    if (!found) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart GET state found yet.");
    }
  });
}

export async function runSmartGetEditLastAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Edit last failed. Check Output.", async () => {
    const found = await editSmartGetLastWorkflow(ctx);
    if (!found) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart GET state found yet.");
    }
  });
}

export async function runSmartGetFromGuidRawAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Smart GET from GUID (Raw) failed. Check Output.", async () => {
    await runSmartGetFromGuidRawWorkflow(ctx);
  });
}

export async function runSmartGetFromGuidPickFieldsAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Smart GET from GUID (Pick Fields) failed. Check Output.", async () => {
    await runSmartGetFromGuidPickFieldsWorkflow(ctx);
  });
}
