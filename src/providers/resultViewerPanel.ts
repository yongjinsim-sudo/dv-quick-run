import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import {
    executeResultViewerAction
} from "./resultViewerActions/registry.js";
import { ResultViewerModel } from "../services/resultViewModelBuilder.js";
import type { ResultViewerActionPayload } from "./resultViewerActions/types.js";
import { getResultViewerHtml } from "../ui/resultViewerHtml.js";

type ResultViewerMessage =
    | {
        type: "copyToClipboard";
        payload: string;
    }
    | {
        type: "executeResultViewerAction";
        payload: ResultViewerActionPayload & {
            actionId?: string;
        };
    }
    | {
        type: "showRelationships";
        payload: {
            entitySetName?: string;
        };
    }
    | {
        type: "showMetadata";
        payload: {
            entitySetName?: string;
            entityLogicalName?: string;
        };
    }
    | {
        type: "exportCsv";
        payload: {
            fileName?: string;
            csv?: string;
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
                await ResultViewerPanel.copyToClipboard(message.payload);
                return;

            case "executeResultViewerAction":
                await ResultViewerPanel.handleExecuteResultViewerAction(ctx, message.payload);
                return;

            case "showRelationships":
                await ResultViewerPanel.showRelationships(
                    message.payload.entitySetName
                );
                return;

            case "showMetadata":
                await ResultViewerPanel.showMetadata(
                    message.payload.entitySetName,
                    message.payload.entityLogicalName
                );
                return;

            case "exportCsv":
                await ResultViewerPanel.exportCsv(
                    message.payload.fileName,
                    message.payload.csv
                );
                return;
        }
    }

    private static async copyToClipboard(payload: string): Promise<void> {
        await vscode.env.clipboard.writeText(String(payload ?? ""));
    }

    private static async handleExecuteResultViewerAction(
        ctx: CommandContext,
        payload: ResultViewerActionPayload & {
            actionId?: string;
        }
    ): Promise<void> {
        const actionId = String(payload.actionId ?? "").trim();
        if (!actionId) {
            return;
        }

        await executeResultViewerAction(ctx, actionId, {
            guid: payload.guid,
            entitySetName: payload.entitySetName,
            entityLogicalName: payload.entityLogicalName,
            columnName: payload.columnName,
            rawValue: payload.rawValue
        });
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

    private static async showMetadata(
        entitySetName?: string,
        entityLogicalName?: string
    ): Promise<void> {

        const entity = entityLogicalName?.trim();

        if (!entity) {
            void vscode.window.showWarningMessage(
                "DV Quick Run: Could not determine entity for metadata inspection."
            );
            return;
        }

        await vscode.commands.executeCommand(
            "dvQuickRun.showEntityMetadata",
            entity
        );
    }

    private static async exportCsv(
        fileName?: string,
        csv?: string
    ): Promise<void> {
        const csvText = String(csv ?? "");
        if (!csvText) {
            void vscode.window.showWarningMessage("DV Quick Run: Nothing to export.");
            return;
        }

        const targetUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName?.trim() || "dv-quick-run-results.csv"),
            filters: {
                "CSV Files": ["csv"]
            },
            saveLabel: "Export CSV"
        });

        if (!targetUri) {
            return;
        }

        await vscode.workspace.fs.writeFile(
            targetUri,
            Buffer.from(csvText, "utf8")
        );

        void vscode.window.showInformationMessage(
            `DV Quick Run: Exported CSV to ${targetUri.fsPath}`
        );
    }
}
