import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function relationshipExplorer(ctx: CommandContext) {
  return runDvQuickRunAction("relationshipExplorer", ctx);
}