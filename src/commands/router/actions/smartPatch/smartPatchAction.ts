import { CommandContext } from "../../../context/commandContext.js";
import {
  runSmartPatchEditLastWorkflow,
  runSmartPatchRerunLastWorkflow,
  runSmartPatchWorkflow
} from "./smartPatchWorkflows.js";

export async function runSmartPatchAction(ctx: CommandContext): Promise<void> {
  await runSmartPatchWorkflow(ctx);
}

export async function runSmartPatchRerunLastAction(ctx: CommandContext): Promise<void> {
  await runSmartPatchRerunLastWorkflow(ctx);
}

export async function runSmartPatchEditLastAction(ctx: CommandContext): Promise<void> {
  await runSmartPatchEditLastWorkflow(ctx);
}
