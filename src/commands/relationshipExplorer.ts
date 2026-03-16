import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runRelationshipExplorerAction } from "./router/actions/relationships/relationshipExplorerAction.js";

export async function relationshipExplorer(
    ctx: CommandContext,
    entitySetNameOverride?: string
): Promise<void> {
    await runRelationshipExplorerAction(ctx, entitySetNameOverride);
}

export function registerRelationshipExplorerCommand(
    context: vscode.ExtensionContext,
    ctx: CommandContext
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "dvQuickRun.relationshipExplorer",
            async (entitySetNameOverride?: string) => {
                await relationshipExplorer(ctx, entitySetNameOverride);
            }
        )
    );
}