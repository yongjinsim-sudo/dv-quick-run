import { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo, logWarn } from "../../../../utils/logger.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { addQueryToHistory } from "../../../../utils/queryHistory.js";
import { normalizePath, buildResultTitle } from "./get/getQueryBuilder.js";
import { analyzeQueryGuardrails, confirmGuardrailsIfNeeded, showGuardrailErrors} from "../shared/guardrails/queryGuardrails.js";
import { looksLikeDataverseQuery } from "../../../../shared/editorIntelligence/queryDetection.js";
import { resolveEditorQueryText } from "../../../../shared/editorIntelligence/queryCursorResolver.js";
import { runAction } from "../shared/actionRunner.js";

export async function runQueryUnderCursorAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Run Query Under Cursor failed. Check Output.", async () => {
    const raw = resolveEditorQueryText();

    if (!looksLikeDataverseQuery(raw)) {
      throw new Error(`Current line does not look like a Dataverse Web API path: ${raw}`);
    }

    const path = normalizePath(raw);
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();

    const guardrails = await analyzeQueryGuardrails(ctx, client, token, raw);

    if (guardrails.hasErrors) {
      await showGuardrailErrors(guardrails);
      return;
    }

    const shouldContinue = await confirmGuardrailsIfNeeded(guardrails);
    if (!shouldContinue) {
      logWarn(ctx.output, "Run Query Under Cursor cancelled by guardrails.");
      return;
    }

    logInfo(ctx.output, "Run Query Under Cursor request issued.");
    logInfo(ctx.output, `Entity path: ${path.split("?")[0]}`);
    logDebug(ctx.output, `GET ${path}`);

    await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));

    const result = await client.get(path, token);
    await showJsonNamed(buildResultTitle(path), result);
  });
}
