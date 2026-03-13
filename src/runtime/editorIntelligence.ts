import * as vscode from "vscode";
import { CommandContext } from "../commands/context/commandContext.js";
import { QueryCodeLensProvider } from "../providers/queryCodeLensProvider.js";
import { QueryHoverProvider } from "../providers/queryHoverProvider.js";

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

export function registerEditorIntelligence(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
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
