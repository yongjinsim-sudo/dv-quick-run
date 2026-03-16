import { CommandContext } from "../../../context/commandContext.js";
import { logWarn } from "../../../../utils/logger.js";
import { normalizePath } from "./get/getQueryBuilder.js";
import { analyzeQueryGuardrails, confirmGuardrailsIfNeeded, showGuardrailErrors} from "../shared/guardrails/queryGuardrails.js";
import { looksLikeDataverseQuery } from "../../../../shared/editorIntelligence/queryDetection.js";
import { resolveEditorQueryText } from "../../../../shared/editorIntelligence/queryCursorResolver.js";
import { runAction } from "../shared/actionRunner.js";
import { logDataverseExecutionResult, logDataverseExecutionStart } from "../shared/executionLogging.js";
import { showResultViewerForQuery } from "./shared/resultViewerLauncher.js";


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

    logDataverseExecutionStart(ctx.output, ctx.envContext.getEnvironmentName(), "GET", path);

    const startedAt = Date.now();
    const result = await client.get(path, token);
    const durationMs = Date.now() - startedAt;

    const recordCount = Array.isArray((result as any)?.value)
      ? (result as any).value.length
      : Array.isArray(result)
        ? result.length
        : result
          ? 1
          : 0;

    logDataverseExecutionResult(ctx.output, recordCount, durationMs);

    await showResultViewerForQuery(ctx, result, path);
  });
}
