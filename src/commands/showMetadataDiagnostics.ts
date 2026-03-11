import { CommandContext } from "./context/commandContext.js";
import { runShowMetadataDiagnosticsAction } from "./router/actions/showMetadataDiagnosticsAction.js";

export function registerShowMetadataDiagnosticsCommand(
  context: { subscriptions: { push(...items: any[]): void } },
  ctx: CommandContext,
  vscodeApi: typeof import("vscode")
): void {
  context.subscriptions.push(
    vscodeApi.commands.registerCommand("dvQuickRun.showMetadataDiagnostics", async () => {
      await runShowMetadataDiagnosticsAction(ctx);
    })
  );
}