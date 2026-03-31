import { CommandContext } from "../commands/context/commandContext.js";
import {
  hasSeenQuickStart,
  markQuickStartSeen,
  runOpenQuickStartAction
} from "../commands/router/actions/onboarding/openQuickStartAction.js";
import { logInfo } from "../utils/logger.js";

export async function maybeOpenQuickStartOnFirstRun(ctx: CommandContext): Promise<void> {
  const alreadySeenQuickStart = await hasSeenQuickStart(ctx);

  if (alreadySeenQuickStart) {
    return;
  }

  await runOpenQuickStartAction(ctx);
  await markQuickStartSeen(ctx);
  logInfo(ctx.output, "DV Quick Run: Opened Quickstart on first activation.");
}
