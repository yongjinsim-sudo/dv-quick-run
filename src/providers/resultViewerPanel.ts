import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import {
    executeResultViewerAction
} from "./resultViewerActions/registry.js";
import { runApplySiblingExpandAction } from "../commands/router/actions/traversal/applySiblingExpandAction.js";
import { runTraversalAsBatchAction } from "../commands/router/actions/traversal/runTraversalAsBatchAction.js";
import { runContinueTraversalAction } from "../commands/router/actions/traversal/continueTraversalAction.js";
import { ResultViewerDisplayModel, ResultViewerModel } from "../services/resultViewModelBuilder.js";
import { previewAndApplyAddTopForQueryInEditor, previewAndApplyAddTopInActiveEditor } from "../refinement/addTopPreview.js";
import { previewAndApplyAddSelectForQueryInEditor, previewAndApplyAddSelectInActiveEditor } from "../refinement/addSelectPreview.js";
import type { ResultViewerActionPayload } from "./resultViewerActions/types.js";
import { getResultViewerHtml } from "../webview/resultViewerHtml.js";
import { PreviewSurfacePanel } from "./previewSurfacePanel.js";
import { ResultViewerSessionStore } from "./resultViewerSessionStore.js";
import { buildManualResultViewerInsightSuggestions } from "../product/binder/buildBinderSuggestion.js";

type ResultViewerMessage =
    | {
        type: "copyToClipboard";
        payload: string;
    }
    | {
        type: "executeBinderSuggestion";
        payload: {
            actionId?: string;
            payload?: Record<string, unknown>;
        };
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
        type: "requestRows";
        payload: {
            sessionId?: string;
            offset?: number;
            limit?: number;
        };
    }
    | {
        type: "requestRowJson";
        payload: {
            sessionId?: string;
            rowIndex?: number;
        };
    }
    | {
        type: "copySessionRowJson";
        payload: {
            sessionId?: string;
            rowIndex?: number;
        };
    }
    | {
        type: "requestJson";
        payload: {
            sessionId?: string;
        };
    }
    | {
        type: "searchSessionRows";
        payload: {
            sessionId?: string;
            searchText?: string;
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
    }
    | {
        type: "runTraversalBatch";
        payload: {
            traversalSessionId?: string;
        };
    }
    | {
        type: "runTraversalOptimizedBatch";
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

function isBatchResultViewerModel(
    model: ResultViewerDisplayModel
): model is import("../services/resultViewModelBuilder.js").BatchResultViewerModel {
    return (model as { type?: string }).type === "batch";
}

export class ResultViewerPanel {

    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentContext: CommandContext | undefined;
    private static currentPagingState: ResultViewerPagingState | undefined;
    private static lastViewColumn: vscode.ViewColumn | undefined;
    private static currentSessionId: string | undefined;
    private static currentModel: ResultViewerDisplayModel | undefined;

    public static show(
    ctx: CommandContext,
    model: ResultViewerDisplayModel
    ): void {
        ResultViewerPanel.currentContext = ctx;
        ResultViewerPanel.currentModel = model;
        ResultViewerPanel.currentSessionId = isBatchResultViewerModel(model) ? undefined : model.session?.id;

        if (isBatchResultViewerModel(model)) {
            ResultViewerPanel.currentPagingState = undefined;
        } else {
            ResultViewerPanel.currentPagingState = {
                sourcePath: model.queryPath,
                pageNumber: model.paging?.pageNumber ?? 1,
                nextLink: model.paging?.hasNextPage
                    ? (model.paging.nextLink ?? ResultViewerPanel.extractNextLinkFromRawJson(model.rawJson))
                    : undefined,
                history: model.paging?.history ?? []
            };
        }

        const targetViewColumn = ResultViewerPanel.resolveViewColumn();

        if (ResultViewerPanel.currentPanel) {
            ResultViewerPanel.currentPanel.dispose();
            ResultViewerPanel.currentPanel = undefined;
        }

        const panel = vscode.window.createWebviewPanel(
            "dvQuickRunResultViewer",
            model.title,
            targetViewColumn,
            {
                enableScripts: true
            }
        );

        ResultViewerPanel.currentPanel = panel;

        panel.webview.onDidReceiveMessage(async (message: ResultViewerMessage) => {
            await ResultViewerPanel.handleMessage(message);
        });

        panel.onDidChangeViewState((event: { webviewPanel: vscode.WebviewPanel }) => {
            ResultViewerPanel.lastViewColumn = event.webviewPanel.viewColumn;
        });

        panel.onDidDispose(() => {
            if (ResultViewerPanel.currentSessionId) {
                ResultViewerSessionStore.dispose(ResultViewerPanel.currentSessionId);
            }
            ResultViewerPanel.currentPanel = undefined;
            ResultViewerPanel.currentSessionId = undefined;
            ResultViewerPanel.currentModel = undefined;
        });

        ResultViewerPanel.lastViewColumn = panel.viewColumn;
        panel.webview.html = getResultViewerHtml(panel.webview, ctx.ext.extensionUri, model);
    }

    private static resolveViewColumn(): vscode.ViewColumn {
        if (ResultViewerPanel.currentPanel?.viewColumn) {
            return ResultViewerPanel.currentPanel.viewColumn;
        }

        if (ResultViewerPanel.lastViewColumn) {
            return ResultViewerPanel.lastViewColumn;
        }

        const previewColumn = PreviewSurfacePanel.getCurrentViewColumn();
        if (typeof previewColumn === "number" && previewColumn > vscode.ViewColumn.One) {
            return (Number(previewColumn) - 1) as vscode.ViewColumn;
        }

        return vscode.ViewColumn.Beside;
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

            case "executeBinderSuggestion":
                await ResultViewerPanel.handleExecuteBinderSuggestion(ctx, message.payload);
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

            case "requestRows":
                await ResultViewerPanel.handleRequestRows(message.payload);
                return;

            case "requestRowJson":
                await ResultViewerPanel.handleRequestRowJson(message.payload);
                return;

            case "copySessionRowJson":
                await ResultViewerPanel.handleCopySessionRowJson(message.payload);
                return;

            case "requestJson":
                await ResultViewerPanel.handleRequestJson(message.payload);
                return;

            case "searchSessionRows":
                await ResultViewerPanel.handleSearchSessionRows(message.payload);
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

            case "runTraversalBatch":
                await runTraversalAsBatchAction(ctx, {
                    traversalSessionId: message.payload.traversalSessionId
                });
                return;

            case "runTraversalOptimizedBatch":
                await runTraversalAsBatchAction(ctx, {
                    traversalSessionId: message.payload.traversalSessionId,
                    optimizeSelectedPath: true
                });
                return;
        }
    }


    private static async handleRequestRows(payload: { sessionId?: string; offset?: number; limit?: number }): Promise<void> {
        const sessionId = String(payload.sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        const panel = ResultViewerPanel.currentPanel;
        if (!sessionId || !panel) {
            return;
        }

        const chunk = ResultViewerSessionStore.getRows(
            sessionId,
            Number(payload.offset ?? 0),
            Number(payload.limit ?? 200)
        );

        if (!chunk) {
            await panel.webview.postMessage({
                type: "rowsChunkError",
                payload: { sessionId, message: "Result Viewer session is no longer available." }
            });
            return;
        }

        await panel.webview.postMessage({
            type: "rowsChunk",
            payload: chunk
        });
    }

    private static async handleRequestRowJson(payload: { sessionId?: string; rowIndex?: number }): Promise<void> {
        const sessionId = String(payload.sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        const panel = ResultViewerPanel.currentPanel;
        if (!sessionId || !panel) {
            return;
        }

        const rowJson = ResultViewerSessionStore.getRowJson(sessionId, Number(payload.rowIndex ?? -1));
        if (!rowJson) {
            return;
        }

        await panel.webview.postMessage({
            type: "rowJson",
            payload: {
                sessionId,
                rowIndex: Number(payload.rowIndex ?? -1),
                rowJson
            }
        });
    }


    private static async handleCopySessionRowJson(payload: { sessionId?: string; rowIndex?: number }): Promise<void> {
        const sessionId = String(payload.sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        if (!sessionId) {
            return;
        }

        const rowIndex = Number(payload.rowIndex ?? -1);
        const rowJson = ResultViewerSessionStore.getRowJson(sessionId, rowIndex);
        if (!rowJson) {
            void vscode.window.showWarningMessage("DV Quick Run: Row JSON is no longer available.");
            return;
        }

        await vscode.env.clipboard.writeText(rowJson);
        void vscode.window.showInformationMessage("DV Quick Run: Row JSON copied.");
    }

    private static async handleRequestJson(payload: { sessionId?: string }): Promise<void> {
        const sessionId = String(payload.sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        const panel = ResultViewerPanel.currentPanel;
        if (!sessionId || !panel) {
            return;
        }

        const rawJson = ResultViewerSessionStore.getRawJson(sessionId);
        if (!rawJson) {
            await panel.webview.postMessage({
                type: "jsonDataError",
                payload: { sessionId, message: "Result Viewer JSON payload is no longer available." }
            });
            return;
        }

        await panel.webview.postMessage({
            type: "jsonData",
            payload: { sessionId, rawJson }
        });
    }

    private static async handleSearchSessionRows(payload: { sessionId?: string; searchText?: string }): Promise<void> {
        const sessionId = String(payload.sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        const panel = ResultViewerPanel.currentPanel;
        if (!sessionId || !panel) {
            return;
        }

        const result = ResultViewerSessionStore.searchRows(sessionId, String(payload.searchText ?? ""));
        if (!result) {
            await panel.webview.postMessage({
                type: "sessionSearchError",
                payload: { sessionId, message: "Result Viewer session is no longer available." }
            });
            return;
        }

        await panel.webview.postMessage({
            type: "sessionSearchResult",
            payload: result
        });
    }

    private static async handleExecuteBinderSuggestion(
        ctx: CommandContext,
        payload: {
            actionId?: string;
            payload?: Record<string, unknown>;
        }
    ): Promise<void> {
        const actionId = payload.actionId ?? "";

        try {
            switch (actionId) {
                case "continueTraversal":
                    await runContinueTraversalAction(ctx);
                    return;

                case "runTraversalBatch":
                    await runTraversalAsBatchAction(ctx, {
                        traversalSessionId: typeof payload.payload?.traversalSessionId === "string" ? payload.payload.traversalSessionId : undefined
                    });
                    return;

                case "runTraversalOptimizedBatch":
                    await runTraversalAsBatchAction(ctx, {
                        traversalSessionId: typeof payload.payload?.traversalSessionId === "string" ? payload.payload.traversalSessionId : undefined,
                        optimizeSelectedPath: true
                    });
                    return;

                case "requestResultInsights":
                    await ResultViewerPanel.handleRequestResultInsights();
                    return;

                case "previewAddTop":
                    if (typeof payload.payload?.queryPath === "string" && payload.payload.queryPath.trim()) {
                        await previewAndApplyAddTopForQueryInEditor(payload.payload.queryPath, typeof payload.payload?.value === "number" ? payload.payload.value : 50);
                        return;
                    }
                    await previewAndApplyAddTopInActiveEditor(typeof payload.payload?.value === "number" ? payload.payload.value : 50);
                    return;

                case "previewAddSelect":
                    if (typeof payload.payload?.queryPath === "string" && payload.payload.queryPath.trim()) {
                        await previewAndApplyAddSelectForQueryInEditor(ctx, payload.payload.queryPath);
                        return;
                    }
                    await previewAndApplyAddSelectInActiveEditor(ctx);
                    return;

                case "previewODataFilter":
                    await executeResultViewerAction(ctx, "preview-odata-filter", {
                        columnName: typeof payload.payload?.columnName === "string" ? payload.payload.columnName : "",
                        rawValue: typeof payload.payload?.rawValue === "string" || typeof payload.payload?.rawValue === "number" || typeof payload.payload?.rawValue === "boolean"
                            ? String(payload.payload.rawValue)
                            : "",
                        displayValue: typeof payload.payload?.displayValue === "string" ? payload.payload.displayValue : undefined,
                        fieldLogicalName: typeof payload.payload?.fieldLogicalName === "string" ? payload.payload.fieldLogicalName : undefined,
                        isNullValue: payload.payload?.isNullValue === true
                    });
                    return;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void vscode.window.showWarningMessage(`DV Quick Run: ${message}`);
            ctx.output.appendLine(`[Binder] ${message}`);
        }
    }

    private static async handleRequestResultInsights(): Promise<void> {
        const panel = ResultViewerPanel.currentPanel;
        const currentModel = ResultViewerPanel.currentModel;
        if (!panel || !currentModel || isBatchResultViewerModel(currentModel)) {
            return;
        }

        const rawJson = currentModel.session?.id
            ? ResultViewerSessionStore.getRawJson(currentModel.session.id)
            : currentModel.rawJson;

        if (!rawJson?.trim()) {
            await panel.webview.postMessage({
                type: "insightsError",
                payload: { message: "Current result payload is unavailable for insight analysis." }
            });
            return;
        }

        try {
            const result = JSON.parse(rawJson);
            const manualInsights = buildManualResultViewerInsightSuggestions({
                queryPath: currentModel.queryPath,
                result
            });
            currentModel.insightSuggestions = [
                ...(currentModel.insightSuggestions ?? []).filter((suggestion) => suggestion.actionId !== "requestResultInsights"),
                ...manualInsights
            ];

            await panel.webview.postMessage({
                type: "insightsUpdated",
                payload: { suggestions: currentModel.insightSuggestions }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await panel.webview.postMessage({
                type: "insightsError",
                payload: { message: "Could not analyse the current result: " + message }
            });
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
            displayValue: (payload as any).displayValue,
            rowJson: (payload as any).rowJson,
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
        displayValue: (payload as any).displayValue,
        rowJson: (payload as any).rowJson,
        sliceOperation: (payload as any).sliceOperation,
        traversalSessionId: (payload as any).traversalSessionId,
        traversalLegIndex: (payload as any).traversalLegIndex,
        carryField: (payload as any).carryField,
        carryValue: (payload as any).carryValue,
        sourceDocumentUri: (payload as any).sourceDocumentUri,
        sourceRangeStartLine: typeof (payload as any).sourceRangeStartLine === "string" && (payload as any).sourceRangeStartLine.trim() ? Number((payload as any).sourceRangeStartLine) : (payload as any).sourceRangeStartLine,
        sourceRangeStartCharacter: typeof (payload as any).sourceRangeStartCharacter === "string" && (payload as any).sourceRangeStartCharacter.trim() ? Number((payload as any).sourceRangeStartCharacter) : (payload as any).sourceRangeStartCharacter,
        sourceRangeEndLine: typeof (payload as any).sourceRangeEndLine === "string" && (payload as any).sourceRangeEndLine.trim() ? Number((payload as any).sourceRangeEndLine) : (payload as any).sourceRangeEndLine,
        sourceRangeEndCharacter: typeof (payload as any).sourceRangeEndCharacter === "string" && (payload as any).sourceRangeEndCharacter.trim() ? Number((payload as any).sourceRangeEndCharacter) : (payload as any).sourceRangeEndCharacter,
        primaryIdField: (payload as any).primaryIdField,
        fieldLogicalName: (payload as any).fieldLogicalName || payload.columnName,
        fieldAttributeType: (payload as any).fieldAttributeType,
        isNullValue: (payload as any).isNullValue === true || (payload as any).isNullValue === "true"
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
        const currentRawJson = ResultViewerPanel.currentSessionId
            ? ResultViewerSessionStore.getRawJson(ResultViewerPanel.currentSessionId)
            : (ResultViewerPanel.currentPanel
                ? ResultViewerPanel.extractRawJsonFromCurrentPanel(ResultViewerPanel.currentPanel.webview.html)
                : undefined);
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
        const sessionJson = ResultViewerPanel.currentSessionId
            ? ResultViewerSessionStore.getRawJson(ResultViewerPanel.currentSessionId)
            : undefined;
        const jsonText = String(sessionJson ?? json ?? "").trim();
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
        const sessionCsv = ResultViewerPanel.currentSessionId
            ? ResultViewerSessionStore.buildCsv(ResultViewerPanel.currentSessionId)
            : undefined;
        const csvText = String(sessionCsv ?? csv ?? "");
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
