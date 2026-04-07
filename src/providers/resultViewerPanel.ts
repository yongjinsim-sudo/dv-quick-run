import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import {
    executeResultViewerAction
} from "./resultViewerActions/registry.js";
import { runApplySiblingExpandAction } from "../commands/router/actions/traversal/applySiblingExpandAction.js";
import { ResultViewerModel } from "../services/resultViewModelBuilder.js";
import type { ResultViewerActionPayload } from "./resultViewerActions/types.js";
import { getResultViewerHtml } from "../webview/resultViewerHtml.js";

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
    }
    | {
        type: "saveJson";
        payload: {
            fileName?: string;
            json?: string;
        };
    }
    | {
        type: "previousPage";
    }
    | {
        type: "nextPage";
    }
    | {
        type: "applySiblingExpand";
        payload: {
            traversalSessionId?: string;
        };
    };

type ResultViewerPageSnapshot = {
    sourcePath: string;
    pageNumber: number;
    rawJson: string;
    nextLink?: string;
};

type ResultViewerPagingState = {
    sourcePath: string;
    pageNumber: number;
    nextLink?: string;
    history: ResultViewerPageSnapshot[];
};

export class ResultViewerPanel {

    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentContext: CommandContext | undefined;
    private static currentPagingState: ResultViewerPagingState | undefined;

    public static show(
        ctx: CommandContext,
        model: ResultViewerModel
    ): void {
        ResultViewerPanel.currentContext = ctx;
        ResultViewerPanel.currentPagingState = {
            sourcePath: model.queryPath,
            pageNumber: model.paging?.pageNumber ?? 1,
            nextLink: model.paging?.hasNextPage
                ? ResultViewerPanel.extractNextLinkFromRawJson(model.rawJson)
                : undefined,
            history: model.paging?.history ?? []
        };

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
        console.log("[DVQR][panel] incoming webview message", message);

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

            case "saveJson":
                await ResultViewerPanel.saveJson(
                    message.payload.fileName,
                    message.payload.json
                );
                return;

            case "previousPage":
                await ResultViewerPanel.previousPage();
                return;

            case "nextPage":
                await ResultViewerPanel.nextPage();
                return;

            case "applySiblingExpand":
                await runApplySiblingExpandAction(ctx, {
                    traversalSessionId: message.payload.traversalSessionId
                });
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

        console.log("[DVQR][panel] forwarding action payload", {
            actionId,
            guid: payload.guid,
            entitySetName: payload.entitySetName,
            entityLogicalName: payload.entityLogicalName,
            columnName: payload.columnName,
            rawValue: payload.rawValue,
            primaryIdField: (payload as any).primaryIdField,
            fieldLogicalName: (payload as any).fieldLogicalName || payload.columnName,
            fieldAttributeType: (payload as any).fieldAttributeType
        });

        await executeResultViewerAction(ctx, actionId, {
            guid: payload.guid,
            entitySetName: payload.entitySetName,
            entityLogicalName: payload.entityLogicalName,
            columnName: payload.columnName,
            rawValue: payload.rawValue,
            primaryIdField: (payload as any).primaryIdField,
            fieldLogicalName: (payload as any).fieldLogicalName || payload.columnName,
            fieldAttributeType: (payload as any).fieldAttributeType
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


    private static async nextPage(): Promise<void> {
        const ctx = ResultViewerPanel.currentContext;
        const paging = ResultViewerPanel.currentPagingState;

        if (!ctx || !paging?.nextLink) {
            void vscode.window.showWarningMessage("DV Quick Run: No next page is available.");
            return;
        }

        const token = await ctx.getToken(ctx.getScope());
        const client = ctx.getClient();
        const currentRawJson = ResultViewerPanel.currentPanel
            ? ResultViewerPanel.extractRawJsonFromCurrentPanel(ResultViewerPanel.currentPanel.webview.html)
            : undefined;
        const history = [...(paging.history ?? [])];

        if (currentRawJson) {
            history.push({
                sourcePath: paging.sourcePath,
                pageNumber: paging.pageNumber,
                rawJson: currentRawJson,
                nextLink: paging.nextLink
            });
        }

        const result = await client.get(paging.nextLink, token);
        const nextLink = ResultViewerPanel.extractNextLink(result);

        const { showResultViewerForQuery } = await import("../commands/router/actions/execution/shared/resultViewerLauncher.js");
        await showResultViewerForQuery(ctx, result, paging.sourcePath, {
            paging: {
                pageNumber: paging.pageNumber + 1,
                nextLink,
                history
            }
        });
    }

    private static async previousPage(): Promise<void> {
        const ctx = ResultViewerPanel.currentContext;
        const paging = ResultViewerPanel.currentPagingState;

        if (!ctx || !paging?.history?.length) {
            void vscode.window.showWarningMessage("DV Quick Run: No previous page is available.");
            return;
        }

        const history = [...paging.history];
        const previous = history.pop();
        if (!previous) {
            void vscode.window.showWarningMessage("DV Quick Run: No previous page is available.");
            return;
        }

        const result = JSON.parse(previous.rawJson);
        const { showResultViewerForQuery } = await import("../commands/router/actions/execution/shared/resultViewerLauncher.js");
        await showResultViewerForQuery(ctx, result, previous.sourcePath, {
            paging: {
                pageNumber: previous.pageNumber,
                nextLink: previous.nextLink,
                history
            }
        });
    }

    private static extractNextLink(result: unknown): string | undefined {
        if (!result || typeof result !== "object" || Array.isArray(result)) {
            return undefined;
        }

        const nextLink = (result as Record<string, unknown>)["@odata.nextLink"];
        return typeof nextLink === "string" && nextLink.trim() ? nextLink.trim() : undefined;
    }

    private static extractRawJsonFromCurrentPanel(html: string): string | undefined {
        const marker = "const model = JSON.parse(";
        const start = html.indexOf(marker);
        if (start < 0) {
            return undefined;
        }

        const afterStart = start + marker.length;
        const end = html.indexOf(");", afterStart);
        if (end < 0) {
            return undefined;
        }

        const jsonLiteral = html.slice(afterStart, end).trim();
        if (!jsonLiteral) {
            return undefined;
        }

        try {
            const model = JSON.parse(JSON.parse(jsonLiteral)) as { rawJson?: string };
            return typeof model.rawJson === "string" ? model.rawJson : undefined;
        } catch {
            return undefined;
        }
    }

    private static extractNextLinkFromRawJson(rawJson: string): string | undefined {
        try {
            const parsed = JSON.parse(rawJson) as Record<string, unknown>;
            const nextLink = parsed["@odata.nextLink"];
            return typeof nextLink === "string" && nextLink.trim() ? nextLink.trim() : undefined;
        } catch {
            return undefined;
        }
    }


    private static async saveJson(
        fileName?: string,
        json?: string
    ): Promise<void> {
        const jsonText = String(json ?? "").trim();
        if (!jsonText) {
            void vscode.window.showWarningMessage("DV Quick Run: No JSON payload is available to save.");
            return;
        }

        const targetUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName?.trim() || "dv-quick-run-results.json"),
            filters: {
                "JSON Files": ["json"]
            },
            saveLabel: "Save JSON"
        });

        if (!targetUri) {
            return;
        }

        await vscode.workspace.fs.writeFile(
            targetUri,
            Buffer.from(jsonText, "utf8")
        );

        void vscode.window.showInformationMessage(
            `DV Quick Run: Saved JSON to ${targetUri.fsPath}`
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
