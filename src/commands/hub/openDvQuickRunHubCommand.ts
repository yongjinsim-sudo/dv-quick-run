import * as vscode from "vscode";
import { CommandContext } from "../context/commandContext.js";
import { registerCommand } from "../registerCommandHelpers.js";
import { buildDvQuickRunHubViewModel } from "./dvQuickRunHubViewModel.js";
import { renderDvQuickRunHubHtml } from "../../webview/hub/renderDvQuickRunHubHtml.js";
import { investigationContextStore } from "../../investigation/context/investigationContextStore.js";

let hubPanel: vscode.WebviewPanel | undefined;
let hubContextChangeSubscription: { dispose: () => void } | undefined;

function getHubIconUri(extensionContext: vscode.ExtensionContext, webview: vscode.Webview): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionContext.extensionUri, "images", "icon.png"));
}

function refreshHubPanel(ctx: CommandContext): void {
  if (!hubPanel) {
    return;
  }

  hubPanel.webview.html = renderDvQuickRunHubHtml(
    hubPanel.webview,
    buildDvQuickRunHubViewModel(investigationContextStore.getCurrent()),
    getHubIconUri(ctx.ext, hubPanel.webview)
  );
}

function ensureHubContextSubscription(ctx: CommandContext): void {
  if (hubContextChangeSubscription) {
    return;
  }

  hubContextChangeSubscription = investigationContextStore.onDidChange(() => {
    refreshHubPanel(ctx);
  });

  ctx.ext.subscriptions.push(hubContextChangeSubscription);
}

export async function openDvQuickRunHub(ctx: CommandContext): Promise<void> {
  ensureHubContextSubscription(ctx);
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  const currentInvestigationContext = investigationContextStore.update({
    source: "hub",
    environmentName: activeEnvironment?.name,
    environmentUrl: activeEnvironment?.url
  });

  if (hubPanel) {
    hubPanel.reveal(vscode.ViewColumn.One);
    refreshHubPanel(ctx);
    return;
  }

  hubPanel = vscode.window.createWebviewPanel(
    "dvQuickRunHub",
    "DV Quick Run Hub",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(ctx.ext.extensionUri, "images")]
    }
  );

  hubPanel.webview.html = renderDvQuickRunHubHtml(
    hubPanel.webview,
    buildDvQuickRunHubViewModel(currentInvestigationContext),
    getHubIconUri(ctx.ext, hubPanel.webview)
  );
  hubPanel.webview.onDidReceiveMessage(async (message) => {
    if (message?.type !== "runCommand" || typeof message.command !== "string") {
      return;
    }

    try {
      const args = Array.isArray(message.args) ? message.args : [];
      await vscode.commands.executeCommand(message.command, ...args);
    } catch (error) {
      void vscode.window.showErrorMessage(`Failed to run command: ${message.command}`);
    }
  }, null, ctx.ext.subscriptions);

  hubPanel.onDidDispose(() => {
    hubPanel = undefined;
  }, null, ctx.ext.subscriptions);
}

export function registerOpenDvQuickRunHubCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.openHub", openDvQuickRunHub, ctx);
}
