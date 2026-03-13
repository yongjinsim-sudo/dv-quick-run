import * as vscode from "vscode";
import { CommandContext } from "../commands/context/commandContext.js";
import { registerRunGetCommand } from "../commands/runGet.js";
import { registerWhoAmICommand } from "../commands/whoAmI.js";
import { registerClearHistoryCommand } from "../commands/clearHistory.js";
import { registerGetMetadataCommand } from "../commands/getMetadata.js";
import { registerSmartGetCommand } from "../commands/smartGet.js";
import { registerSmartGetRerunLastCommand } from "../commands/smartGetRerunLast.js";
import { registerSmartGetEditLastCommand } from "../commands/smartGetEditLast.js";
import { registerSmartPatchCommand } from "../commands/smartPatch.js";
import { registerSmartPatchEditLastCommand } from "../commands/smartPatchEditLast.js";
import { registerSmartPatchRerunLastCommand } from "../commands/smartPatchRerunLast.js";
import { registerSmartGetFromGuidRawCommand } from "../commands/smartGetFromGuidRaw.js";
import { registerSmartGetFromGuidPickFieldsCommand } from "../commands/smartGetFromGuidPickFields.js";
import { registerGenerateQueryFromJsonCommand } from "../commands/generateQueryFromJson.js";
import { registerShowMetadataDiagnosticsCommand } from "../commands/showMetadataDiagnostics.js";
import { registerClearMetadataSessionCacheCommand } from "../commands/clearMetadataSessionCache.js";
import { registerClearPersistedMetadataCacheCommand } from "../commands/clearPersistedMetadataCache.js";
import { registerCommand } from "../commands/registerCommandHelpers.js";
import { runQueryUnderCursor } from "../commands/runQueryUnderCursor.js";
import { addFieldsSelect } from "../commands/addFieldsSelect.js";
import { addFilter } from "../commands/addFilter.js";
import { addExpand } from "../commands/addExpand.js";
import { addOrderBy } from "../commands/addOrderBy.js";
import { explainQuery } from "../commands/explainQuery.js";
import { relationshipExplorer } from "../commands/relationshipExplorer.js";
import { relationshipGraphView } from "../commands/relationshipGraphView.js";

type ContextRegistration = (context: vscode.ExtensionContext, ctx: CommandContext) => void;
type DirectRegistration = {
  commandId: string;
  handler: (ctx: CommandContext) => Promise<void> | void;
};

const coreRegistrations: readonly ContextRegistration[] = [
  registerWhoAmICommand,
  registerRunGetCommand,
  registerClearHistoryCommand,
  registerGetMetadataCommand,
  registerSmartGetCommand,
  registerSmartGetRerunLastCommand,
  registerSmartGetEditLastCommand,
  registerSmartPatchCommand,
  registerSmartPatchEditLastCommand,
  registerSmartPatchRerunLastCommand,
  registerSmartGetFromGuidPickFieldsCommand,
  registerSmartGetFromGuidRawCommand,
  registerGenerateQueryFromJsonCommand
];

const diagnosticsRegistrations = (
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void => {
  registerShowMetadataDiagnosticsCommand(context, ctx, vscode);
  registerClearMetadataSessionCacheCommand(context, ctx, vscode);
  registerClearPersistedMetadataCacheCommand(context, ctx, vscode);
};

const directRegistrations: readonly DirectRegistration[] = [
  { commandId: "dvQuickRun.runQueryUnderCursor", handler: runQueryUnderCursor },
  { commandId: "dvQuickRun.addFieldsSelect", handler: addFieldsSelect },
  { commandId: "dvQuickRun.addFilter", handler: addFilter },
  { commandId: "dvQuickRun.addExpand", handler: addExpand },
  { commandId: "dvQuickRun.addOrderBy", handler: addOrderBy },
  { commandId: "dvQuickRun.explainQuery", handler: explainQuery },
  { commandId: "dvQuickRun.relationshipExplorer", handler: relationshipExplorer },
  { commandId: "dvQuickRun.relationshipGraphView", handler: relationshipGraphView }
];

function registerContextCommands(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  registrations: readonly ContextRegistration[]
): void {
  registrations.forEach((register) => register(context, ctx));
}

function registerDirectCommands(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  registrations: readonly DirectRegistration[]
): void {
  registrations.forEach(({ commandId, handler }) => {
    registerCommand(context, commandId, handler, ctx);
  });
}

export function registerCommandSurface(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerContextCommands(context, ctx, coreRegistrations);
  diagnosticsRegistrations(context, ctx);
  registerDirectCommands(context, ctx, directRegistrations);
}
