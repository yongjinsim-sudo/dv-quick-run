import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logError } from "../../../../utils/logger.js";

export async function runAction(
  ctx: CommandContext,
  failureMessage: string,
  work: () => Promise<void>
): Promise<void> {
  ctx.output.show(true);

  try {
    await work();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output, msg);
    vscode.window.showErrorMessage(failureMessage);
  }
}

export async function runActionWithResult<T>(
  ctx: CommandContext,
  failureMessage: string,
  work: () => Promise<T>
): Promise<T | undefined> {
  ctx.output.show(true);

  try {
    return await work();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output, msg);
    vscode.window.showErrorMessage(failureMessage);
    return undefined;
  }
}
