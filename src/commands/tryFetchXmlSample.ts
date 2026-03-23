import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function tryFetchXmlSample(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("tryFetchXmlSample", ctx);
}

export function registerTryFetchXmlSampleCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerRouterCommand(
    context,
    "dvQuickRun.tryFetchXmlSample",
    "tryFetchXmlSample",
    ctx
  );
}