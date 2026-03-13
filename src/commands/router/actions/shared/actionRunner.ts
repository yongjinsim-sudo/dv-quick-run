import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logError } from "../../../../utils/logger.js";

export type ActionFailureDeps = {
  logError: (message: string) => void;
  showErrorMessage: (message: string) => void | Thenable<unknown>;
};

export function handleActionFailure(
  error: unknown,
  failureMessage: string,
  deps: ActionFailureDeps
): void {
  const msg = error instanceof Error ? error.message : String(error);
  deps.logError(msg);
  void deps.showErrorMessage(failureMessage);
}

function createActionFailureDeps(ctx: CommandContext): ActionFailureDeps {
  return {
    logError: (message: string) => logError(ctx.output, message),
    showErrorMessage: (message: string) => vscode.window.showErrorMessage(message)
  };
}

export async function runAction(
  ctx: CommandContext,
  failureMessage: string,
  work: () => Promise<void>
): Promise<void> {
  ctx.output.show(true);

  try {
    await work();
  } catch (e: any) {
    handleActionFailure(e, failureMessage, createActionFailureDeps(ctx));
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
    handleActionFailure(e, failureMessage, createActionFailureDeps(ctx));
    return undefined;
  }
}
