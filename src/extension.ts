import * as vscode from "vscode";
import { createCommandContext } from "./commands/context/commandContext.js";
import { registerVirtualJsonProvider } from "./utils/virtualJsonDoc.js";
import { EnvironmentContext } from "./services/environmentContext.js";
import { logInfo } from "./utils/logger.js";
import { EnvironmentStatusBar } from "./ui/environmentStatusBar.js";
import { initializeMetadataRuntime } from "./runtime/metadataRuntime.js";
import { registerCommandSurface } from "./runtime/commandSurface.js";
import { registerEnvironmentLifecycle } from "./runtime/environmentLifecycle.js";
import { registerEditorIntelligence } from "./runtime/editorIntelligence.js";
import { registerInternalSupportCommands } from "./runtime/internalSupportCommands.js";

export async function activate(context: vscode.ExtensionContext) {
  registerVirtualJsonProvider(context);

  const envContext = new EnvironmentContext(context);
  await envContext.initialize();

  const ctx = createCommandContext(context, envContext);

  logInfo(ctx.output, `DV Quick Run: Active environment: ${envContext.getEnvironmentName()}`);

  const environmentStatusBar = new EnvironmentStatusBar(envContext);
  environmentStatusBar.show();
  context.subscriptions.push(environmentStatusBar);

  initializeMetadataRuntime(ctx);
  registerCommandSurface(context, ctx);
  registerEnvironmentLifecycle(context, ctx, envContext, environmentStatusBar);
  registerInternalSupportCommands(context);
  registerEditorIntelligence(context, ctx);
}

export function deactivate() {}
