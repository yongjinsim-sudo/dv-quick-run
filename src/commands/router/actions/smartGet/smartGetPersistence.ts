import { CommandContext } from "../../../context/commandContext.js";
import { SmartGetState } from "./smartGetTypes.js";

const LAST_SMART_GET_STATE_KEY = "dvQuickRun.smartGet.lastState";

export async function saveLastSmartGetState(ctx: CommandContext, state: SmartGetState): Promise<void> {
  await ctx.ext.globalState.update(LAST_SMART_GET_STATE_KEY, state);
}

export function loadLastSmartGetState(ctx: CommandContext): SmartGetState | undefined {
  return ctx.ext.globalState.get<SmartGetState>(LAST_SMART_GET_STATE_KEY);
}
