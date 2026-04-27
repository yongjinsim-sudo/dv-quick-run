import type { CommandContext } from "../../../../context/commandContext.js";
import { ResultViewerPanel } from "../../../../../providers/resultViewerPanel.js";
import { ResultViewerSessionStore } from "../../../../../providers/resultViewerSessionStore.js";
import { buildBatchResultViewerBinderSuggestion } from "../../../../../product/binder/buildBinderSuggestion.js";
import {
    buildResultViewerModel,
    type BatchResultViewerItem,
    type BatchResultViewerModel,
    type ResultViewerSourceTargetInfo,
    type ResultViewerTraversalContext
} from "../../../../../services/resultViewModelBuilder.js";
import {
    loadChoiceMetadata,
    loadEntityDefByEntitySetName,
    loadFields
} from "../../shared/metadataAccess.js";
import type { BatchExecutionPart } from "../../../../../services/batchExecution.js";
import { findLogicalEditorQueryTargetByText } from "../../shared/queryMutation/editorQueryTarget.js";

export type ResultViewerLaunchOptions = {
    traversalContext?: ResultViewerTraversalContext;
    paging?: {
        pageNumber?: number;
        nextLink?: string;
        history?: Array<{
            sourcePath: string;
            pageNumber: number;
            rawJson: string;
            nextLink?: string;
        }>;
    };
};

function tryCaptureSourceTarget(path: string): ResultViewerSourceTargetInfo | undefined {
    try {
        const target = findLogicalEditorQueryTargetByText(path);
        return {
            sourceDocumentUri: target.editor.document.uri.toString(),
            sourceRangeStartLine: target.range.start.line,
            sourceRangeStartCharacter: target.range.start.character,
            sourceRangeEndLine: target.range.end.line,
            sourceRangeEndCharacter: target.range.end.character
        };
    } catch {
        return undefined;
    }
}

export async function showResultViewerForQuery(
    ctx: CommandContext,
    result: unknown,
    path: string,
    options?: ResultViewerLaunchOptions
): Promise<void> {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());

    const entitySetName = getEntitySetNameFromPath(path);

    const entityDef = entitySetName
        ? await loadEntityDefByEntitySetName(ctx, client, token, entitySetName)
        : undefined;

    const fields = entityDef?.logicalName
        ? await loadFields(ctx, client, token, entityDef.logicalName, { silent: true })
        : [];

    const choiceMetadata = entityDef?.logicalName
        ? await loadChoiceMetadata(ctx, client, token, entityDef.logicalName, { silent: true })
        : [];

    const activeEnvironment = ctx.envContext.getActiveEnvironment();
    const nextLink = extractNextLink(result) ?? options?.paging?.nextLink;
    const sourceTarget = tryCaptureSourceTarget(path);

    const model = ResultViewerSessionStore.createInitialModel(result, path, {
        entitySetName: entityDef?.entitySetName ?? entitySetName,
        entityLogicalName: entityDef?.logicalName,
        primaryIdField: entityDef?.primaryIdAttribute,
        fields,
        choiceMetadata,
        traversalContext: options?.traversalContext,
        environment: activeEnvironment
            ? {
                name: activeEnvironment.name,
                colorHint: activeEnvironment.statusBarColor ?? "white"
            }
            : undefined,
        paging: {
            pageNumber: options?.paging?.pageNumber ?? 1,
            hasNextPage: !!nextLink,
            nextLink,
            history: options?.paging?.history ?? []
        },
        sourceTarget
    });

    ResultViewerPanel.show(ctx, model);
}

function getEntitySetNameFromPath(path: string): string | undefined {
    const normalizedPath = path.trim();

    if (!normalizedPath) {
        return undefined;
    }

    const beforeQuery = normalizedPath.split("?")[0] ?? "";
    const beforeRecord = beforeQuery.split("(")[0] ?? "";
    const entitySetName = beforeRecord.replace(/^\/+/, "").trim();

    return entitySetName || undefined;
}

function extractNextLink(result: unknown): string | undefined {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return undefined;
    }

    const nextLink = (result as Record<string, unknown>)["@odata.nextLink"];
    return typeof nextLink === "string" && nextLink.trim() ? nextLink.trim() : undefined;
}


export async function showBatchResultViewer(
    ctx: CommandContext,
    parts: BatchExecutionPart[],
    options?: { traversalSessionId?: string; canRunOptimizedBatch?: boolean }
): Promise<void> {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());
    const activeEnvironment = ctx.envContext.getActiveEnvironment();

    const items: BatchResultViewerItem[] = [];

    for (const part of parts) {
        const entitySetName = getEntitySetNameFromPath(part.queryText);
        let entityDef: Awaited<ReturnType<typeof loadEntityDefByEntitySetName>> | undefined;
        let fields: Awaited<ReturnType<typeof loadFields>> = [];
        let choiceMetadata: Awaited<ReturnType<typeof loadChoiceMetadata>> = [];

        const shouldAttemptMetadata = part.statusCode > 0 && part.statusCode < 400 && part.payload !== undefined;

        if (shouldAttemptMetadata && entitySetName) {
            try {
                entityDef = await loadEntityDefByEntitySetName(ctx, client, token, entitySetName);
                fields = entityDef?.logicalName
                    ? await loadFields(ctx, client, token, entityDef.logicalName, { silent: true })
                    : [];
                choiceMetadata = entityDef?.logicalName
                    ? await loadChoiceMetadata(ctx, client, token, entityDef.logicalName, { silent: true })
                    : [];
            } catch {
                entityDef = undefined;
                fields = [];
                choiceMetadata = [];
            }
        }

        const model = part.payload !== undefined && part.statusCode > 0 && part.statusCode < 400
            ? buildResultViewerModel(part.payload, part.queryText, {
                entitySetName: entityDef?.entitySetName ?? entitySetName,
                entityLogicalName: entityDef?.logicalName,
                primaryIdField: entityDef?.primaryIdAttribute,
                fields,
                choiceMetadata,
                environment: activeEnvironment
                    ? {
                        name: activeEnvironment.name,
                        colorHint: activeEnvironment.statusBarColor ?? "white"
                    }
                    : undefined
            })
            : undefined;

        items.push({
            key: String(part.index),
            label: buildBatchItemLabel(part),
            queryText: part.queryText,
            statusCode: part.statusCode,
            statusText: part.statusText,
            rowCount: model?.rowCount ?? getBatchPartRowCount(part),
            model,
            error: part.error,
            rawBody: part.rawBody
        });
    }

    const successCount = items.filter((item) => item.statusCode < 400 && item.statusCode > 0).length;
    const failureCount = items.length - successCount;
    const firstSelectable = items.find((item) => !!item.model || !!item.error || !!item.rawBody)?.key ?? "summary";

    const batchModel: BatchResultViewerModel = {
        type: "batch",
        title: "DV Quick Run Batch Result Viewer",
        summary: {
            totalRequests: items.length,
            successCount,
            failureCount
        },
        items,
        selectedKey: firstSelectable,
        environment: activeEnvironment
            ? {
                name: activeEnvironment.name,
                colorHint: activeEnvironment.statusBarColor ?? "white"
            }
            : undefined,
        batchTraversal: options?.traversalSessionId
            ? {
                traversalSessionId: options.traversalSessionId,
                canRunOptimizedBatch: !!options?.canRunOptimizedBatch
            }
            : undefined,
        binderSuggestion: buildBatchResultViewerBinderSuggestion({
            traversalSessionId: options?.traversalSessionId,
            canRunOptimizedBatch: options?.canRunOptimizedBatch
        })
    };

    ResultViewerPanel.show(ctx, batchModel);
}

function buildBatchItemLabel(part: BatchExecutionPart): string {
    const entitySetName = getEntitySetNameFromPath(part.queryText) ?? `Request ${part.index + 1}`;
    const rowCount = getBatchPartRowCount(part);
    if (part.statusCode >= 400 || part.statusCode === 0) {
        return `${entitySetName} (Failed)`;
    }
    if (typeof rowCount === "number") {
        return `${entitySetName} (${rowCount})`;
    }
    return entitySetName;
}

function getBatchPartRowCount(part: BatchExecutionPart): number | undefined {
    if (part.resultType === "collection") {
        const value = part.payload && typeof part.payload === "object" && !Array.isArray(part.payload)
            ? (part.payload as Record<string, unknown>).value
            : undefined;
        return Array.isArray(value) ? value.length : 0;
    }

    if (part.resultType === "single") {
        return 1;
    }

    if (part.resultType === "empty") {
        return 0;
    }

    return undefined;
}
