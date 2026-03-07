import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addFieldsSelect(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addFieldsSelect", ctx);
}