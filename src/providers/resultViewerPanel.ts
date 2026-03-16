import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import { buildDataverseRecordUiLink } from "../commands/router/actions/investigateRecord/dataverseUiLinkBuilder.js";
import {
    findEntityByEntitySetName,
    loadEntityDefs
} from "../commands/router/actions/shared/metadataAccess.js";
import { ResultViewerModel } from "../services/resultViewModelBuilder";
import { getResultViewerHtml } from "../ui/resultViewerHtml";

type ResultViewerMessage =
    | {
        type: "copyToClipboard";
        payload: string;
    }
    | {
        type: "investigateRecord";
        payload: {
            guid: string;
            entitySetName?: string;
        };
    }
    | {
        type: "openInDataverseUi";
        payload: {
            guid: string;
            entitySetName?: string;
        };
    }
    | {
        type: "showRelationships";
        payload: {
            entitySetName?: string;
        };
    };

export class ResultViewerPanel {

    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentContext: CommandContext | undefined;

    public static show(
        ctx: CommandContext,
        model: ResultViewerModel
    ): void {
        ResultViewerPanel.currentContext = ctx;

        if (!ResultViewerPanel.currentPanel) {
            ResultViewerPanel.currentPanel = vscode.window.createWebviewPanel(
                "dvQuickRunResultViewer",
                "DV Quick Run Result Viewer",
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true
                }
            );

            ResultViewerPanel.currentPanel.webview.onDidReceiveMessage(async (message: ResultViewerMessage) => {
                await ResultViewerPanel.handleMessage(message);
            });

            ResultViewerPanel.currentPanel.onDidDispose(() => {
                ResultViewerPanel.currentPanel = undefined;
            });
        }

        const panel = ResultViewerPanel.currentPanel;

        panel.title = model.title;
        panel.webview.html = getResultViewerHtml(panel.webview, ctx.ext.extensionUri, model);
        panel.reveal(vscode.ViewColumn.Beside);
    }

    private static async handleMessage(message: ResultViewerMessage): Promise<void> {
        const ctx = ResultViewerPanel.currentContext;
        if (!ctx) {
            return;
        }

        switch (message.type) {
            case "copyToClipboard":
                await vscode.env.clipboard.writeText(String(message.payload ?? ""));
                return;

            case "investigateRecord":
                await ResultViewerPanel.investigateRecord(
                    String(message.payload.guid ?? ""),
                    message.payload.entitySetName
                );
                return;

            case "openInDataverseUi":
                await ResultViewerPanel.openInDataverseUi(
                    ctx,
                    String(message.payload.guid ?? ""),
                    message.payload.entitySetName
                );
                return;

            case "showRelationships":
                await ResultViewerPanel.showRelationships(
                    message.payload.entitySetName
                );
                return;
        }
    }

    private static async investigateRecord(
        guid: string,
        entitySetName?: string
    ): Promise<void> {
        if (!guid.trim()) {
            return;
        }

        const input = entitySetName?.trim()
            ? `${entitySetName}(${guid})`
            : guid;

        await vscode.commands.executeCommand("dvQuickRun.investigateRecord", input);
    }

    private static async showRelationships(
        entitySetName?: string
    ): Promise<void> {
        if (!entitySetName?.trim()) {
            void vscode.window.showWarningMessage("DV Quick Run: Could not determine entity set for relationship exploration.");
            return;
        }

        await vscode.commands.executeCommand(
            "dvQuickRun.relationshipExplorer",
            entitySetName
        );
    }

    private static async openInDataverseUi(
        ctx: CommandContext,
        guid: string,
        entitySetName?: string
    ): Promise<void> {
        if (!guid.trim()) {
            return;
        }

        if (!entitySetName?.trim()) {
            void vscode.window.showWarningMessage("DV Quick Run: Could not determine entity set for Dataverse UI link.");
            return;
        }

        try {
            const token = await ctx.getToken(ctx.getScope());
            const client = ctx.getClient();
            const defs = await loadEntityDefs(ctx, client, token);
            const entityDef = findEntityByEntitySetName(defs, entitySetName);

            if (!entityDef?.logicalName) {
                throw new Error(`Could not resolve logical name for entity set '${entitySetName}'.`);
            }

            const baseUrl = await ctx.getBaseUrl();
            const url = buildDataverseRecordUiLink(baseUrl, entityDef.logicalName, guid);

            await vscode.env.openExternal(vscode.Uri.parse(url));
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : String(error);

            void vscode.window.showErrorMessage(`DV Quick Run: Failed to open Dataverse UI. ${message}`);
        }
    }
}