import * as vscode from "vscode";
import type { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import {
  runRefreshMetadataContextAction,
  runShowMetadataQuerySuggestionsAction
} from "./router/actions/queryMutation/showMetadataQuerySuggestionsAction.js";

export function registerMetadataQueryIntelligenceCommands(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerCommand(context, "dvQuickRun.showMetadataQuerySuggestions", runShowMetadataQuerySuggestionsAction, ctx);
  registerCommand(context, "dvQuickRun.refreshMetadataContext", runRefreshMetadataContextAction, ctx);
}
