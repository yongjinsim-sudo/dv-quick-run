import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function relationshipGraphView(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("relationshipGraphView", ctx);
}

export function registerRelationshipGraphViewCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.relationshipGraphView", "relationshipGraphView", ctx);
}
