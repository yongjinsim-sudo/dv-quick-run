import * as vscode from "vscode";
import { registerRunGetCommand } from "./commands/runGet.js";
import { registerWhoAmICommand } from "./commands/whoAmI.js";
import { CommandContext } from "./commands/context/commandContext.js";
import { registerClearHistoryCommand } from "./commands/clearHistory.js";
import { registerVirtualJsonProvider } from "./utils/virtualJsonDoc.js";
import { createCommandContext } from "./commands/context/commandContext.js";
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
import { QueryHoverProvider } from "./providers/queryHoverProvider.js";
import { relationshipExplorer } from "./commands/relationshipExplorer.js";
import { relationshipGraphView } from "./commands/relationshipGraphView.js";
import { registerShowMetadataDiagnosticsCommand } from "./commands/showMetadataDiagnostics.js";
import { registerClearMetadataSessionCacheCommand } from "./commands/clearMetadataSessionCache.js";
import { registerClearPersistedMetadataCacheCommand } from "./commands/clearPersistedMetadataCache.js";
import { fetchEntityDefs } from "./services/entityMetadataService.js";
import { getCachedEntityDefs, setCachedEntityDefs } from "./utils/entitySetCache.js";
import { logDebug, logError } from "./utils/logger.js";

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
    // Step 1 — load persisted cache first (instant)
    const cached = getCachedEntityDefs(ctx.ext);
    if (cached?.length) {
      ctx.output.appendLine(`DV Quick Run: Entity defs loaded from persisted cache (${cached.length}).`);
      return;
    }

    // Step 2 — fallback to network fetch
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);
    const token = await ctx.getToken(scope);
    const client = ctx.getClient(baseUrl);

    const defs = await fetchEntityDefs(client, token);

    if (defs?.length) {
      await setCachedEntityDefs(ctx.ext, defs);
      logDebug(ctx.output, `DV Quick Run: Entity defs fetched and cached (${defs.length}).`);
    }

  } catch (e: any) {
    logError(ctx.output, `DV Quick Run: Entity defs prewarm skipped: ${e?.message ?? String(e)}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  registerVirtualJsonProvider(context);

  const ctx = createCommandContext(context);

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

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.runQueryUnderCursor", async () => {
      await runQueryUnderCursor(ctx);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.addFieldsSelect", async () => {
      await addFieldsSelect(ctx);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.addFilter", async () => {
      await addFilter(ctx);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.addExpand", async () => {
      await addExpand(ctx);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.addOrderBy", async () => {
      await addOrderBy(ctx);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.explainQuery", async () => {
      await explainQuery(ctx);
    })
  );

  context.subscriptions.push(
	vscode.commands.registerCommand("dvQuickRun.relationshipExplorer", () => relationshipExplorer(ctx))
	);

  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.relationshipGraphView", () =>
      relationshipGraphView(ctx)
    )
  );

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