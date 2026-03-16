import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { investigateRecordAction } from "./router/actions/investigateRecord/investigateRecordAction.js";

export async function investigateRecord(
    ctx: CommandContext,
    inputOverride?: string
): Promise<void> {
    await investigateRecordAction(ctx, inputOverride);
}

export function registerInvestigateRecordCommand(
    context: vscode.ExtensionContext,
    ctx: CommandContext
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "dvQuickRun.investigateRecord",
            async (inputOverride?: string) => {
                await investigateRecord(ctx, inputOverride);
            }
        )
    );
}