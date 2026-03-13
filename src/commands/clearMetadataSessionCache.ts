import { CommandContext } from "./context/commandContext.js";
import { runClearMetadataSessionCacheAction } from "./router/actions/metadata/clearMetadataSessionCacheAction.js";

export function registerClearMetadataSessionCacheCommand(
  context: { subscriptions: { push(...items: any[]): void } },
  ctx: CommandContext,
  vscodeApi: typeof import("vscode")
): void {
  context.subscriptions.push(
    vscodeApi.commands.registerCommand("dvQuickRun.clearMetadataSessionCache", async () => {
      await runClearMetadataSessionCacheAction(ctx);
    })
  );
}