import type { CommandContext } from "../commands/context/commandContext.js";
import { runAddFilterAction } from "../commands/router/actions/queryMutation/addFilterAction.js";

export async function previewAndApplyAddFilterInActiveEditor(ctx: CommandContext): Promise<void> {
  await runAddFilterAction(ctx);
}
