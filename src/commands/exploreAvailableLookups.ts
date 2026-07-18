import * as vscode from "vscode";
import type { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { runExploreAvailableLookupsAction } from "./router/actions/queryMutation/exploreAvailableLookupsAction.js";

export function registerExploreAvailableLookupsCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerCommand(context, "dvQuickRun.exploreAvailableLookups", runExploreAvailableLookupsAction, ctx);
}
