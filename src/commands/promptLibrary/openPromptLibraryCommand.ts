import * as vscode from "vscode";
import { CommandContext } from "../context/commandContext.js";
import { registerCommand } from "../registerCommandHelpers.js";
import { resolveEntitlement } from "../../product/capabilities/entitlementResolver.js";
import { getDvqrPrompt, renderDvqrPrompt } from "../../product/promptLibrary/promptLibraryService.js";
import { buildPromptLibraryViewModel } from "./promptLibraryViewModel.js";
import { renderPromptLibraryHtml } from "../../webview/promptLibrary/renderPromptLibraryHtml.js";

let promptLibraryPanel: vscode.WebviewPanel | undefined;

function resolvePlan(): "free" | "pro" {
  return resolveEntitlement().plan === "pro" ? "pro" : "free";
}

export async function openPromptLibrary(ctx: CommandContext): Promise<void> {
  if (promptLibraryPanel) {
    promptLibraryPanel.reveal(vscode.ViewColumn.One);
    promptLibraryPanel.webview.html = renderPromptLibraryHtml(
      promptLibraryPanel.webview,
      buildPromptLibraryViewModel(resolvePlan())
    );
    return;
  }

  promptLibraryPanel = vscode.window.createWebviewPanel(
    "dvQuickRunPromptLibrary",
    "DV Quick Run Prompt Library",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  promptLibraryPanel.webview.html = renderPromptLibraryHtml(
    promptLibraryPanel.webview,
    buildPromptLibraryViewModel(resolvePlan())
  );

  promptLibraryPanel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!promptLibraryPanel || !message || typeof message !== "object") {
      return;
    }

    const payload = message as Record<string, unknown>;
    if (typeof payload.type !== "string") {
      return;
    }

    if (payload.type === "renderPrompt" && typeof payload.promptId === "string") {
      const prompt = getDvqrPrompt(payload.promptId);
      if (!prompt) {
        promptLibraryPanel.webview.postMessage({ type: "promptRenderFailed", promptId: payload.promptId });
        return;
      }

      const values = payload.values && typeof payload.values === "object" ? payload.values as Record<string, string> : {};
      const rendered = renderDvqrPrompt(prompt, values);
      promptLibraryPanel.webview.postMessage({ type: "promptRendered", rendered });
      return;
    }

    if (payload.type === "copyPrompt" && typeof payload.text === "string") {
      await vscode.env.clipboard.writeText(payload.text);
      promptLibraryPanel.webview.postMessage({ type: "promptCopied" });
      return;
    }

    if (payload.type === "openPricing") {
      await vscode.commands.executeCommand("dvQuickRun.openDvQuickRunPricing");
      return;
    }

    if (payload.type === "showMcpStatus") {
      await vscode.commands.executeCommand("dvQuickRun.showLocalMcpServerStatus");
    }
  }, null, ctx.ext.subscriptions);

  promptLibraryPanel.onDidDispose(() => {
    promptLibraryPanel = undefined;
  }, null, ctx.ext.subscriptions);
}

export function registerOpenPromptLibraryCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerCommand(context, "dvQuickRun.openPromptLibrary", openPromptLibrary, ctx);
}
