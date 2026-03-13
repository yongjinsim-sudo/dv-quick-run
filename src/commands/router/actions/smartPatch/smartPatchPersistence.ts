import { CommandContext } from "../../../context/commandContext.js";
import { SmartPatchState } from "./smartPatchTypes.js";

const LAST_SMART_PATCH_STATE_KEY = "dvQuickRun.smartPatch.lastState";

export async function saveLastState(ctx: CommandContext, state: SmartPatchState): Promise<void> {
  await ctx.ext.globalState.update(LAST_SMART_PATCH_STATE_KEY, state);
}

export function loadLastState(ctx: CommandContext): SmartPatchState | undefined {
  return ctx.ext.globalState.get<SmartPatchState>(LAST_SMART_PATCH_STATE_KEY);
}
