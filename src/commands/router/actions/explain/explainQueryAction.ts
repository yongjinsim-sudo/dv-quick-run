import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import { runExplainQueryWorkflow } from "./explainQueryWorkflow.js";

export async function runExplainQueryAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Explain Query failed. Check Output.", async () => {
    await runExplainQueryWorkflow(ctx);
  });
}
