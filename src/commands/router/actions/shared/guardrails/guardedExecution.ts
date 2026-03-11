import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import {
  analyzeQueryGuardrails,
  confirmGuardrailsIfNeeded,
  showGuardrailErrors
} from "./queryGuardrails.js";
import { logWarn } from "../../../../../utils/logger.js";

export async function shouldExecuteQueryWithGuardrails(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  query: string,
  cancelMessage?: string
): Promise<boolean> {
  const guardrails = await analyzeQueryGuardrails(ctx, client, token, query);

  if (guardrails.hasErrors) {
    await showGuardrailErrors(guardrails);
    return false;
  }

  const shouldContinue = await confirmGuardrailsIfNeeded(guardrails);
  if (!shouldContinue) {
    if (cancelMessage) {
      logWarn(ctx.output,cancelMessage);
    }
    return false;
  }

  return true;
}