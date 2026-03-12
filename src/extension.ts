import * as vscode from "vscode";
import { registerRunGetCommand } from "./commands/runGet.js";
import { registerWhoAmICommand } from "./commands/whoAmI.js";
import { CommandContext } from "./commands/context/commandContext.js";
import { registerClearHistoryCommand } from "./commands/clearHistory.js";
import { registerVirtualJsonProvider } from "./utils/virtualJsonDoc.js";
import { createCommandContext } from "./commands/context/commandContext.js";
import { EnvironmentContext } from "./services/environmentContext.js";
import { registerGetMetadataCommand } from "./commands/getMetadata.js";
import { registerSmartGetCommand } from "./commands/smartGet.js";
import { registerSmartGetRerunLastCommand } from "./commands/smartGetRerunLast.js";
import { registerSmartGetEditLastCommand } from "./commands/smartGetEditLast.js";
import { registerSmartPatchCommand } from "./commands/smartPatch.js";
import { registerSmartPatchEditLastCommand } from "./commands/smartPatchEditLast.js";
import { registerSmartPatchRerunLastCommand } from "./commands/smartPatchRerunLast.js";
import { registerSmartGetFromGuidRawCommand } from "./commands/smartGetFromGuidRaw.js";
import { registerSmartGetFromGuidPickFieldsCommand } from "./commands/smartGetFromGuidPickFields.js";
import { registerGenerateQueryFromJsonCommand } from "./commands/generateQueryFromJson.js";
import { runQueryUnderCursor } from "./commands/runQueryUnderCursor.js";
import { addFieldsSelect } from "./commands/addFieldsSelect.js";
import { addFilter } from "./commands/addFilter.js";
import { addExpand } from "./commands/addExpand.js";
import { addOrderBy } from "./commands/addOrderBy.js";
import { explainQuery } from "./commands/explainQuery.js";
import { QueryCodeLensProvider } from "./providers/queryCodeLensProvider.js";
import { clearNavigationHoverEnrichmentCache, QueryHoverProvider } from "./providers/queryHoverProvider.js";
import { relationshipExplorer } from "./commands/relationshipExplorer.js";
import { relationshipGraphView } from "./commands/relationshipGraphView.js";
import { registerShowMetadataDiagnosticsCommand } from "./commands/showMetadataDiagnostics.js";
import { registerClearMetadataSessionCacheCommand } from "./commands/clearMetadataSessionCache.js";
import { registerClearPersistedMetadataCacheCommand } from "./commands/clearPersistedMetadataCache.js";
import { fetchEntityDefs } from "./services/entityMetadataService.js";
import { getCachedEntityDefs, setCachedEntityDefs } from "./utils/entitySetCache.js";
import { logDebug, logError, logInfo } from "./utils/logger.js";
import { registerSelectEnvironmentCommand } from "./commands/selectEnvironment.js";
import { EnvironmentStatusBar } from "./ui/environmentStatusBar.js";
import { registerAddEnvironmentCommand } from "./commands/addEnvironment.js";
import { clearHoverFieldContextCache } from "./providers/hoverFieldContextCache.js";
import { clearMetadataSessionCache } from "./commands/router/actions/shared/metadataLoadCache.js";
import { registerRemoveEnvironmentCommand } from "./commands/removeEnvironment.js";
import { registerCommand } from "./commands/registerCommandHelpers.js";

async function runCommandAtLine(
  documentUri: vscode.Uri,
  lineNumber: number,
  command: string
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(documentUri);
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false
  });

  const line = doc.lineAt(lineNumber);

  const pos = new vscode.Position(lineNumber, 0);
  
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(
    new vscode.Range(pos, pos),
    vscode.TextEditorRevealType.InCenter
  );

  await vscode.commands.executeCommand(command);
}

function createDebouncedCallback(callback: () => void, delayMs: number): () => void {
  let handle: NodeJS.Timeout | undefined;

  return () => {
    if (handle) {
      clearTimeout(handle);
    }

    handle = setTimeout(() => {
      handle = undefined;
      callback();
    }, delayMs);
  };
}

function shouldRefreshCodeLensForDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === "file" || document.uri.scheme === "untitled";
}

async function prewarmEntityDefs(ctx: CommandContext): Promise<void> {
  try {
    const cached = getCachedEntityDefs(ctx.ext, ctx.envContext.getEnvironmentName());
    if (cached?.length) {
      ctx.output.appendLine(`DV Quick Run: Entity defs loaded from persisted cache (${cached.length}).`);
      return;
    }

    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);
    const client = ctx.getClient();

    const defs = await fetchEntityDefs(client, token);

    if (defs?.length) {
      await setCachedEntityDefs(ctx.ext, ctx.envContext.getEnvironmentName(),defs);
      logDebug(ctx.output, `DV Quick Run: Entity defs fetched and cached (${defs.length}).`);
    }

  } catch (e: any) {
    logError(ctx.output, `DV Quick Run: Entity defs prewarm skipped: ${e?.message ?? String(e)}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  registerVirtualJsonProvider(context);

  const envContext = new EnvironmentContext(context);
  await envContext.initialize();
  const ctx = createCommandContext(context, envContext);

  // log active environment on startup
  logInfo(ctx.output, `DV Quick Run: Active environment: ${envContext.getEnvironmentName()}`);

  // show environment in status bar
  const environmentStatusBar = new EnvironmentStatusBar(envContext);
  environmentStatusBar.show();

  context.subscriptions.push(environmentStatusBar);

  setTimeout(() => {
    void prewarmEntityDefs(ctx);
  }, 2000);

  registerWhoAmICommand(context, ctx);
  registerRunGetCommand(context, ctx);
  registerClearHistoryCommand(context, ctx);
  registerGetMetadataCommand(context, ctx);
  registerSmartGetCommand(context, ctx);
  registerSmartGetRerunLastCommand(context, ctx);
  registerSmartGetEditLastCommand(context, ctx);
  registerSmartPatchCommand(context, ctx);
  registerSmartPatchEditLastCommand(context, ctx);
  registerSmartPatchRerunLastCommand(context, ctx);
  registerSmartGetFromGuidPickFieldsCommand(context, ctx);
  registerSmartGetFromGuidRawCommand(context, ctx);
  registerGenerateQueryFromJsonCommand(context, ctx);
  registerShowMetadataDiagnosticsCommand(context, ctx, vscode);
  registerClearMetadataSessionCacheCommand(context, ctx, vscode);
  registerClearPersistedMetadataCacheCommand(context, ctx, vscode);
  registerSelectEnvironmentCommand(context, ctx, () => {
    environmentStatusBar.refresh();
  });
  registerAddEnvironmentCommand(context, ctx, () => {
    environmentStatusBar.refresh();
  });
  registerRemoveEnvironmentCommand(context, ctx, () => {
    environmentStatusBar.refresh();
  });
  registerCommand(context, "dvQuickRun.runQueryUnderCursor", runQueryUnderCursor, ctx);
  registerCommand(context, "dvQuickRun.addFieldsSelect", addFieldsSelect, ctx);
  registerCommand(context, "dvQuickRun.addFilter", addFilter, ctx);
  registerCommand(context, "dvQuickRun.addExpand", addExpand, ctx);
  registerCommand(context, "dvQuickRun.addOrderBy", addOrderBy, ctx);
  registerCommand(context, "dvQuickRun.explainQuery", explainQuery, ctx);
  registerCommand(context, "dvQuickRun.relationshipExplorer", relationshipExplorer, ctx);
  registerCommand(context, "dvQuickRun.relationshipGraphView", relationshipGraphView, ctx);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.runQueryAtLine",
      async (documentUri: vscode.Uri, lineNumber: number) => {
        await runCommandAtLine(documentUri, lineNumber, "dvQuickRun.runQueryUnderCursor");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.explainQueryAtLine",
      async (documentUri: vscode.Uri, lineNumber: number) => {
        await runCommandAtLine(documentUri, lineNumber, "dvQuickRun.explainQuery");
      }
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration("dvQuickRun.environments")) {
        logInfo(ctx.output, "DV Quick Run: Environment configuration changed. Reloading...");

        await envContext.initialize();
        clearMetadataSessionCache();
        clearHoverFieldContextCache();
        clearNavigationHoverEnrichmentCache();
        logInfo(ctx.output, "DV Quick Run: Cleared metadata session caches after environment switch.");
        environmentStatusBar.refresh();
        logInfo(
          ctx.output,
          `DV Quick Run: Active environment: ${envContext.getEnvironmentName()}`
        );

        vscode.window.showInformationMessage(
          `DV Quick Run environment: ${envContext.getEnvironmentName()}`
        );
      }
    })
  );

  const codeLensProvider = new QueryCodeLensProvider();
  const refreshCodeLensDebounced = createDebouncedCallback(() => {
    codeLensProvider.refresh();
  }, 200);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: "file" },
        { scheme: "untitled" }
      ],
      codeLensProvider
    )
  );

  const hoverProvider = new QueryHoverProvider(ctx);

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [
        { scheme: "file" },
        { scheme: "untitled" }
      ],
      hoverProvider
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("dvQuickRun.enableCodeLens")) {
        codeLensProvider.refresh();
      }
    })
  );

context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument((document) => {
      if (shouldRefreshCodeLensForDocument(document)) {
        refreshCodeLensDebounced();
      }
    })
  );

context.subscriptions.push(
  vscode.workspace.onDidChangeTextDocument((event) => {
        if (shouldRefreshCodeLensForDocument(event.document)) {
          refreshCodeLensDebounced();
        }
      })
    );

}

export function deactivate() {}