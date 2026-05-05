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
import { buildExecutionInsightSuggestions } from "../product/executionInsights/executionInsightsOrchestrator.js";
import { previewAndRunBatchQueries } from "../commands/router/actions/execution/batch/runBatchExecutionFlow.js";

const MAX_INLINE_JSON_WEBVIEW_BYTES = 2_000_000;
const EXECUTION_INSIGHTS_SUPPRESSION_MS = 10 * 60 * 1000;

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
        type: "runExecutionInsightQuery";
        payload: {
            query?: string;
        };
    }
    | {
        type: "runExecutionInsightBatchQueries";
        payload: {
            queries?: string[];
        };
    }
    | {
        type: "openExecutionInsightUrl";
        payload: {
            url?: string;
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
            sessionId?: string;
        };
    }
    | {
        type: "saveJson";
        payload: {
            fileName?: string;
            json?: string;
            sessionId?: string;
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
    private static executionInsightsSuppressedUntilByEnvironment = new Map<string, number>();

    public static show(
    ctx: CommandContext,
    model: ResultViewerDisplayModel
    ): void {
        const targetViewColumn = ResultViewerPanel.resolveViewColumn();

        // Dispose the previous panel before registering the new session. The dispose
        // handler cleans up the session attached to that panel; doing this after
        // currentSessionId is switched would delete the new session and break
        // session-backed JSON/CSV export for large payloads.
        if (ResultViewerPanel.currentPanel) {
            ResultViewerPanel.currentPanel.dispose();
            ResultViewerPanel.currentPanel = undefined;
        }

        ResultViewerPanel.currentContext = ctx;
        ResultViewerPanel.applyExecutionInsightsSuppression(model);
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

        const panelSessionId = isBatchResultViewerModel(model) ? undefined : model.session?.id;
        panel.onDidDispose(() => {
            if (panelSessionId) {
                ResultViewerSessionStore.dispose(panelSessionId);
            }

            if (ResultViewerPanel.currentPanel === panel) {
                ResultViewerPanel.currentPanel = undefined;
                ResultViewerPanel.currentSessionId = undefined;
                ResultViewerPanel.currentModel = undefined;
            }
        });

        ResultViewerPanel.lastViewColumn = panel.viewColumn;
        panel.webview.html = getResultViewerHtml(panel.webview, ctx.ext.extensionUri, model);
    }


    private static getExecutionInsightsSuppressionKey(model: ResultViewerDisplayModel | undefined): string {
        if (!model || isBatchResultViewerModel(model)) {
            return "default";
        }

        return model.environment?.name?.trim() || "default";
    }

    private static shouldSuppressExecutionInsights(model: ResultViewerDisplayModel | undefined): boolean {
        const key = ResultViewerPanel.getExecutionInsightsSuppressionKey(model);
        const suppressedUntil = ResultViewerPanel.executionInsightsSuppressedUntilByEnvironment.get(key) ?? 0;
        if (Date.now() < suppressedUntil) {
            return true;
        }

        if (suppressedUntil > 0) {
            ResultViewerPanel.executionInsightsSuppressedUntilByEnvironment.delete(key);
        }

        return false;
    }

    private static suppressExecutionInsightsForCurrentEnvironment(model: ResultViewerDisplayModel | undefined): void {
        const key = ResultViewerPanel.getExecutionInsightsSuppressionKey(model);
        ResultViewerPanel.executionInsightsSuppressedUntilByEnvironment.set(
            key,
            Date.now() + EXECUTION_INSIGHTS_SUPPRESSION_MS
        );
    }

    private static applyExecutionInsightsSuppression(model: ResultViewerDisplayModel): void {
        if (isBatchResultViewerModel(model) || !ResultViewerPanel.shouldSuppressExecutionInsights(model)) {
            return;
        }

        if (model.binderSuggestion?.actionId === "requestExecutionInsights") {
            model.binderSuggestion = undefined;
        }

        model.insightSuggestions = (model.insightSuggestions ?? [])
            .filter((suggestion) => suggestion.actionId !== "requestExecutionInsights");
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

            case "runExecutionInsightQuery":
                await ResultViewerPanel.handleRunExecutionInsightQuery(message.payload);
                return;

            case "runExecutionInsightBatchQueries":
                await ResultViewerPanel.handleRunExecutionInsightBatchQueries(ctx, message.payload);
                return;

            case "openExecutionInsightUrl":
                await ResultViewerPanel.handleOpenExecutionInsightUrl(message.payload);
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
                    message.payload.csv,
                    message.payload.sessionId
                );
                return;

            case "saveJson":
                await ResultViewerPanel.saveJson(
                    message.payload.fileName,
                    message.payload.json,
                    message.payload.sessionId
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


    private static async handleRunExecutionInsightQuery(payload: { query?: string }): Promise<void> {
        const query = String(payload.query ?? "").trim();
        if (!query) {
            return;
        }

        await ResultViewerPanel.copyToClipboard(query);
        const document = await vscode.workspace.openTextDocument({
            content: query,
            language: "http"
        });
        await vscode.window.showTextDocument(document, { preview: false });
        await vscode.commands.executeCommand("dvQuickRun.runQueryUnderCursor");
    }

    private static async handleRunExecutionInsightBatchQueries(ctx: CommandContext, payload: { queries?: string[] }): Promise<void> {
        const queries = Array.from(new Set((payload.queries ?? [])
            .map((query) => String(query ?? "").trim())
            .filter(Boolean)));

        if (queries.length === 0) {
            void vscode.window.showWarningMessage("DV Quick Run: No execution insight queries were available to run as $batch.");
            return;
        }

        if (queries.length === 1) {
            await ResultViewerPanel.handleRunExecutionInsightQuery({ query: queries[0] });
            return;
        }

        await previewAndRunBatchQueries(ctx, queries, {
            previewTitle: "Execution Insight grouped identifier investigation"
        });
    }



    private static async handleOpenExecutionInsightUrl(payload: { url?: string }): Promise<void> {
        const url = String(payload.url ?? "").trim();
        if (!/^https:\/\/make\.powerautomate\.com\//i.test(url)) {
            void vscode.window.showWarningMessage("DV Quick Run: Only Power Automate run links can be opened from Execution Insights.");
            return;
        }

        await vscode.env.openExternal(vscode.Uri.parse(url));
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

        if (rawJson.length > MAX_INLINE_JSON_WEBVIEW_BYTES) {
            await panel.webview.postMessage({
                type: "jsonDataTooLarge",
                payload: {
                    sessionId,
                    byteLength: Buffer.byteLength(rawJson, "utf8"),
                    message: "The full JSON payload is too large to render interactively. Use Save JSON to export the complete session-backed payload."
                }
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

                case "requestExecutionInsights":
                    await ResultViewerPanel.handleRequestExecutionInsights(ctx, payload.payload);
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

    private static async handleRequestExecutionInsights(ctx: CommandContext, payload?: Record<string, unknown>): Promise<void> {
        const panel = ResultViewerPanel.currentPanel;
        const currentModel = ResultViewerPanel.currentModel;
        if (!panel || !currentModel) {
            return;
        }

        const batchTarget = isBatchResultViewerModel(currentModel)
            ? ResultViewerPanel.resolveBatchExecutionInsightTarget(currentModel, payload)
            : undefined;
        const targetModel = batchTarget?.model ?? (!isBatchResultViewerModel(currentModel) ? currentModel : undefined);

        if (!targetModel) {
            return;
        }

        const rawJson = !isBatchResultViewerModel(currentModel) && targetModel.session?.id
            ? ResultViewerSessionStore.getRawJson(targetModel.session.id)
            : targetModel.rawJson;

        let currentResult: unknown;
        if (rawJson?.trim()) {
            try {
                currentResult = JSON.parse(rawJson);
            } catch {
                currentResult = undefined;
            }
        }

        await panel.webview.postMessage({
            type: "insightsLoading",
            payload: { message: "Getting bounded Execution Insights..." }
        });

        try {
            const token = await ctx.getToken(ctx.getScope());
            const executionInsightResult = await buildExecutionInsightSuggestions({
                client: ctx.getClient(),
                token,
                currentResult,
                queryPath: targetModel.queryPath,
                correlationId: targetModel.executionContext?.correlationId,
                requestId: targetModel.executionContext?.requestId,
                operationId: targetModel.executionContext?.operationId
            });
            const executionInsights = executionInsightResult.suggestions;
            const shouldSuppressExecutionInsights = executionInsightResult.shouldSuppressExecutionInsights;
            // Once the user explicitly runs Execution Insights, remove the trigger chip/card for
            // this Result Viewer session regardless of outcome. Successful runs replace it with
            // generated execution insights; empty/error/timeout runs replace it with bounded
            // feedback. Keeping the trigger after a successful run makes the drawer ask the user
            // to run Execution Insights again even though the insights are already loaded.
            if (shouldSuppressExecutionInsights) {
                ResultViewerPanel.suppressExecutionInsightsForCurrentEnvironment(targetModel);
            }

            if (targetModel.binderSuggestion?.actionId === "requestExecutionInsights") {
                targetModel.binderSuggestion = undefined;
            }

            targetModel.insightSuggestions = [
                ...(targetModel.insightSuggestions ?? []).filter((suggestion) => suggestion.actionId !== "requestExecutionInsights"),
                ...executionInsights
            ];

            await panel.webview.postMessage({
                type: "insightsUpdated",
                payload: {
                    suggestions: targetModel.insightSuggestions,
                    binderSuggestion: targetModel.binderSuggestion ?? null,
                    batchItemKey: batchTarget?.item.key
                }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await panel.webview.postMessage({
                type: "insightsError",
                payload: { message: "Could not get Execution Insights: " + message }
            });
        }
    }


    private static resolveBatchExecutionInsightTarget(
        batchModel: import("../services/resultViewModelBuilder.js").BatchResultViewerModel,
        payload?: Record<string, unknown>
    ): { item: import("../services/resultViewModelBuilder.js").BatchResultViewerItem; model: ResultViewerModel } | undefined {
        const batchItemKey = typeof payload?.batchItemKey === "string" ? payload.batchItemKey : undefined;
        const queryPath = typeof payload?.queryPath === "string" ? payload.queryPath.trim() : undefined;

        const item = batchModel.items.find((candidate) => batchItemKey && candidate.key === batchItemKey)
            ?? batchModel.items.find((candidate) => queryPath && candidate.queryText.trim() === queryPath)
            ?? batchModel.items.find((candidate) => !!candidate.model);

        if (!item?.model) {
            return undefined;
        }

        return { item, model: item.model };
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

        const response = await client.getWithMetadata(paging.nextLink, token);
        const result = response.data;
        const nextLink = ResultViewerPanel.extractNextLink(result);

        const { showResultViewerForQuery } = await import("../commands/router/actions/execution/shared/resultViewerLauncher.js");
        await showResultViewerForQuery(ctx, result, paging.sourcePath, {
            paging: {
                pageNumber: paging.pageNumber + 1,
                nextLink,
                history
            },
            executionContext: response.executionContext
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
        json?: string,
        sessionId?: string
    ): Promise<void> {
        const effectiveSessionId = String(sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        const sessionJson = effectiveSessionId
            ? ResultViewerSessionStore.getRawJson(effectiveSessionId)
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
        csv?: string,
        sessionId?: string
    ): Promise<void> {
        const effectiveSessionId = String(sessionId ?? ResultViewerPanel.currentSessionId ?? "").trim();
        const sessionCsv = effectiveSessionId
            ? ResultViewerSessionStore.buildCsv(effectiveSessionId)
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
