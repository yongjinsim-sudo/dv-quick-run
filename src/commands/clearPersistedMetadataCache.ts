import { CommandContext } from "./context/commandContext.js";
import { runClearPersistedMetadataCacheAction } from "./router/actions/metadata/clearPersistedMetadataCacheAction.js";

export function registerClearPersistedMetadataCacheCommand(
  context: { subscriptions: { push(...items: any[]): void } },
  ctx: CommandContext,
  vscodeApi: typeof import("vscode")
): void {
  context.subscriptions.push(
    vscodeApi.commands.registerCommand("dvQuickRun.clearPersistedMetadataCache", async () => {
      await runClearPersistedMetadataCacheAction(ctx);
    })
  );
}