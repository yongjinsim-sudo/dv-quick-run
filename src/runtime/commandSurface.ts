import * as vscode from "vscode";
import { CommandContext } from "../commands/context/commandContext.js";
import { registerRunGetCommand } from "../commands/runGet.js";
import { registerWhoAmICommand } from "../commands/whoAmI.js";
import { registerClearHistoryCommand } from "../commands/clearHistory.js";
import { registerGetMetadataCommand } from "../commands/getMetadata.js";
import { registerShowEntityMetadataCommand } from "../commands/showEntityMetadata.js";
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
import { registerRunQueryUnderCursorCommand } from "../commands/runQueryUnderCursor.js";
import { registerAddFieldsSelectCommand } from "../commands/addFieldsSelect.js";
import { registerAddFilterCommand } from "../commands/addFilter.js";
import { registerAddExpandCommand } from "../commands/addExpand.js";
import { registerAddOrderByCommand } from "../commands/addOrderBy.js";
import { registerExplainQueryCommand } from "../commands/explainQuery.js";
import { registerRelationshipExplorerCommand } from "../commands/relationshipExplorer.js";
import { registerRelationshipGraphViewCommand } from "../commands/relationshipGraphView.js";
import { registerInvestigateRecordCommand } from "../commands/investigateRecord.js";
import { registerTrySampleQueryCommand } from "../commands/trySampleQuery.js";
import { registerTryFetchXmlSampleCommand } from "../commands/tryFetchXmlSample.js";
import { registerFindPathToTableCommand } from "../commands/findPathToTable.js";
import { registerContinueTraversalCommand } from "../commands/continueTraversal.js";
import { registerClearTraversalCacheCommand } from '../commands/clearTraversalCache';

type ContextRegistration = (context: vscode.ExtensionContext, ctx: CommandContext) => void;
const coreRegistrations: readonly ContextRegistration[] = [
  registerWhoAmICommand,
  registerRunGetCommand,
  registerClearHistoryCommand,
  registerGetMetadataCommand,
  registerShowEntityMetadataCommand,
  registerSmartGetCommand,
  registerSmartGetRerunLastCommand,
  registerSmartGetEditLastCommand,
  registerSmartPatchCommand,
  registerSmartPatchEditLastCommand,
  registerSmartPatchRerunLastCommand,
  registerSmartGetFromGuidPickFieldsCommand,
  registerSmartGetFromGuidRawCommand,
  registerGenerateQueryFromJsonCommand,
  registerRunQueryUnderCursorCommand,
  registerAddFieldsSelectCommand,
  registerAddFilterCommand,
  registerAddExpandCommand,
  registerAddOrderByCommand,
  registerExplainQueryCommand,
  registerRelationshipExplorerCommand,
  registerRelationshipGraphViewCommand,
  registerInvestigateRecordCommand,
  registerTrySampleQueryCommand,
  registerTryFetchXmlSampleCommand,
  registerFindPathToTableCommand,
  registerContinueTraversalCommand,
  registerClearTraversalCacheCommand
];

const diagnosticsRegistrations = (
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void => {
  registerShowMetadataDiagnosticsCommand(context, ctx, vscode);
  registerClearMetadataSessionCacheCommand(context, ctx, vscode);
  registerClearPersistedMetadataCacheCommand(context, ctx, vscode);
};

function registerContextCommands(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  registrations: readonly ContextRegistration[]
): void {
  registrations.forEach((register) => register(context, ctx));
}

export function registerCommandSurface(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerContextCommands(context, ctx, coreRegistrations);
  diagnosticsRegistrations(context, ctx);
}
