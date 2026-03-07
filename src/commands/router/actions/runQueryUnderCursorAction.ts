import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";
import { addQueryToHistory } from "../../../utils/queryHistory.js";
import { normalizePath, buildResultTitle } from "./get/getQueryBuilder.js";
import {
  analyzeQueryGuardrails,
  confirmGuardrailsIfNeeded,
  showGuardrailErrors
} from "./shared/guardrails/queryGuardrails.js";

function getQueryFromEditor(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor.");
  }

  const selection = editor.document.getText(editor.selection).trim();

  if (selection) {
    return selection;
  }

  const line = editor.document.lineAt(editor.selection.active.line).text.trim();

  if (!line) {
    throw new Error("Current line is empty.");
  }

  return line;
}

function looksLikeDataverseQuery(input: string): boolean {
  const q = input.trim();

  if (!q) {return false;}

  return /^\/?[A-Za-z_][A-Za-z0-9_]*([(][^)]*[)])?([?].*)?$/.test(q);
}

export async function runQueryUnderCursorAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const raw = getQueryFromEditor();

    if (!looksLikeDataverseQuery(raw)) {
      throw new Error(`Current line does not look like a Dataverse Web API path: ${raw}`);
    }

    const path = normalizePath(raw);

    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);

    ctx.output.appendLine(`BaseUrl: ${baseUrl}`);
    ctx.output.appendLine(`Scope: ${scope}`);
    ctx.output.appendLine(`Getting token via Azure CLI...`);

    const token = await ctx.getToken(scope);
    const client = ctx.getClient(baseUrl);

    const guardrails = await analyzeQueryGuardrails(ctx, client, token, raw);

    if (guardrails.hasErrors) {
      await showGuardrailErrors(guardrails);
      return;
    }

    const shouldContinue = await confirmGuardrailsIfNeeded(guardrails);
    if (!shouldContinue) {
      ctx.output.appendLine("Run Query Under Cursor cancelled by guardrails.");
      return;
    }

    ctx.output.appendLine(`Run Query Under Cursor: ${path}`);
    ctx.output.appendLine(`GET ${path}`);

    await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));

    const result = await client.get(path, token);
    await showJsonNamed(buildResultTitle(path), result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Run Query Under Cursor failed. Check Output.");
  }
}