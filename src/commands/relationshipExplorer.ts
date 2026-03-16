import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function relationshipExplorer(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("relationshipExplorer", ctx);
}

export function registerRelationshipExplorerCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.relationshipExplorer", "relationshipExplorer", ctx);
}
