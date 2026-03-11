import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { logError, logInfo, logWarn } from "../../../utils/logger.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";
import { addQueryToHistory } from "../../../utils/queryHistory.js";
import { normalizePath, buildResultTitle } from "./get/getQueryBuilder.js";
import {
  analyzeQueryGuardrails,
  confirmGuardrailsIfNeeded,
  showGuardrailErrors
} from "./shared/guardrails/queryGuardrails.js";
import { getLogicalEditorQueryTarget } from "./shared/queryMutation/editorQueryTarget.js";

function getQueryFromEditor(): string {
  return getLogicalEditorQueryTarget().text;
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
    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);
    const client = ctx.getClient();

    const guardrails = await analyzeQueryGuardrails(ctx, client, token, raw);

    if (guardrails.hasErrors) {
      await showGuardrailErrors(guardrails);
      return;
    }

    const shouldContinue = await confirmGuardrailsIfNeeded(guardrails);
    if (!shouldContinue) {
      logWarn(ctx.output,"Run Query Under Cursor cancelled by guardrails.");
      return;
    }

    logInfo(ctx.output,`Run Query Under Cursor: ${path}`);
    logInfo(ctx.output,`GET ${path}`);

    await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));

    const result = await client.get(path, token);
    await showJsonNamed(buildResultTitle(path), result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Run Query Under Cursor failed. Check Output.");
  }
}
