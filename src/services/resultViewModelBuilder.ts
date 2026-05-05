import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../services/entityFieldMetadataService.js";
import type { DataverseExecutionContext } from "./dataverseClient.js";
import {
    resolveResultViewerActions
} from "../providers/resultViewerActions/registry.js";
import type {
    ResultViewerQueryMode,
    ResultViewerResolvedAction,
    ResultViewerTraversalActionContext
} from "../providers/resultViewerActions/types.js";
import { isChoiceAttributeType, isLookupLikeAttributeType } from "../metadata/metadataModel.js";
import {
    isLookupColumn,
    isSystemColumn
} from "../providers/resultViewerActions/columnIntelligence.js";
import { resolveChoiceValueFromMetadata } from "../commands/router/actions/shared/valueAwareness.js";
import { buildBatchResultViewerBinderSuggestion, buildResultViewerBinderSuggestion, buildResultViewerInsightSuggestions, getParsedQueryShape } from "../product/binder/buildBinderSuggestion.js";
import type { BinderSuggestion } from "../product/binder/binderTypes.js";

export interface ResultViewerEnvironmentInfo {
    name: string;
    colorHint: "white" | "amber" | "red";
}

export interface ResultViewerTraversalStatus {
    title: string;
    subtitle?: string;
    traversalSessionId?: string;
    canSiblingExpand?: boolean;
    canRunBatch?: boolean;
    canRunOptimizedBatch?: boolean;
    requiredCarryField?: string;
}

export interface ResultViewerEmptyState {
    title: string;
    message?: string;
}

export interface ResultViewerTraversalContext extends ResultViewerTraversalActionContext {
    isBestMatchRoute?: boolean;
    legCount: number;
    nextLegLabel?: string;
    nextLegEntityName?: string;
    currentEntityName?: string;
    showBanner?: boolean;
    bannerTitle?: string;
    bannerSubtitle?: string;
    canRunBatch?: boolean;
    canRunOptimizedBatch?: boolean;
}

export type ResultViewerCellValueType = "scalar" | "object" | "array" | "empty";

export interface ResultViewerDrawerPayload {
    column: string;
    payload: unknown;
}

export interface ResultViewerCell {
    value: string;
    rawValue: unknown;
    isTruncated?: boolean;
    largeValueHint?: string;
    copyValue?: string;
    exportValue?: string;
    valueType?: ResultViewerCellValueType;
    originalColumnName?: string;
    primaryActions?: ResultViewerResolvedAction[];
    overflowActions?: ResultViewerResolvedAction[];
    drawerPayload?: ResultViewerDrawerPayload;
    actions?: ResultViewerResolvedAction[];
}

export interface ResultViewerRowActionItem {
    rowIndex: number;
    actions: ResultViewerResolvedAction[];
}

export interface ResultViewerPagingHistoryEntry {
    sourcePath: string;
    pageNumber: number;
    rawJson: string;
    nextLink?: string;
}

export interface ResultViewerPagingInfo {
    pageNumber: number;
    hasNextPage: boolean;
    nextLink?: string;
    history?: ResultViewerPagingHistoryEntry[];
}

export interface ResultViewerSourceTargetInfo {
    sourceDocumentUri: string;
    sourceRangeStartLine: number;
    sourceRangeStartCharacter: number;
    sourceRangeEndLine: number;
    sourceRangeEndCharacter: number;
}

export type ResultViewerExecutionContext = DataverseExecutionContext;

export interface ResultViewerSessionInfo {
    id: string;
    rowOffset: number;
    chunkSize: number;
    totalRows: number;
    hasMoreRows: boolean;
    /**
     * Maps each rendered row back to its original source row index within
     * the session payload. This is used by full-session search results,
     * where the displayed rows may be non-contiguous and therefore cannot
     * be addressed with rowOffset + renderedIndex.
     */
    sourceRowIndexes?: number[];
}

export interface ResultViewerModel {
    binderSuggestion?: BinderSuggestion;
    insightSuggestions?: BinderSuggestion[];
    title: string;
    mode: "collection" | "record" | "raw";
    columns: string[];
    rows: Array<Record<string, ResultViewerCell>>;
    rawJson: string;
    rowCount: number;
    queryPath: string;
    entitySetName?: string;
    entityLogicalName?: string;
    primaryIdField?: string;
    traversal?: ResultViewerTraversalStatus;
    emptyState?: ResultViewerEmptyState;
    environment?: ResultViewerEnvironmentInfo;
    legend?: ResultViewerLegendItem[];
    rowActions?: ResultViewerRowActionItem[];
    paging?: ResultViewerPagingInfo;
    sourceTarget?: ResultViewerSourceTargetInfo;
    session?: ResultViewerSessionInfo;
    executionContext?: ResultViewerExecutionContext;
}

export interface ResultViewerBuildOptions {
    entitySetName?: string;
    entityLogicalName?: string;
    primaryIdField?: string;
    environment?: ResultViewerEnvironmentInfo;
    fields?: FieldDef[];
    choiceMetadata?: ChoiceMetadataDef[];
    traversalContext?: ResultViewerTraversalContext;
    paging?: ResultViewerPagingInfo;
    sourceTarget?: ResultViewerSourceTargetInfo;
    rowWindow?: {
        offset: number;
        limit: number;
    };
    suppressRawJson?: boolean;
    sessionId?: string;
    executionContext?: ResultViewerExecutionContext;
}


export interface BatchResultViewerItem {
    key: string;
    label: string;
    queryText: string;
    statusCode: number;
    statusText: string;
    rowCount?: number;
    model?: ResultViewerModel;
    error?: string;
    rawBody?: string;
}

export interface BatchResultViewerSummary {
    totalRequests: number;
    successCount: number;
    failureCount: number;
}

export interface BatchTraversalContext {
    traversalSessionId: string;
    canRunOptimizedBatch: boolean;
}

export interface BatchResultViewerModel {
    binderSuggestion?: BinderSuggestion;
    insightSuggestions?: BinderSuggestion[];
    type: "batch";
    title: string;
    summary: BatchResultViewerSummary;
    items: BatchResultViewerItem[];
    selectedKey: string;
    environment?: ResultViewerEnvironmentInfo;
    batchTraversal?: BatchTraversalContext;
}

export type ResultViewerDisplayModel = ResultViewerModel | BatchResultViewerModel;

export interface ResultViewerLegendItem {
    alias: string;
    fullName: string;
}

// Result viewer detanglement guardrail:
// keep flattening depth intentionally capped so the builder remains the
// single place that defines how nested payloads are interpreted.
export const RESULT_VIEWER_MAX_FLATTEN_DEPTH = 2;
const RESULT_VIEWER_MAX_CELL_TEXT_LENGTH = 240;
const RESULT_VIEWER_MAX_ACTION_VALUE_LENGTH = 200;
const RESULT_VIEWER_MAX_DRAWER_PAYLOAD_CHARS = 12000;
const RESULT_VIEWER_SAFE_MODE_COLUMN_LIMIT = 60;

function truncateResultViewerText(value: string, maxLength = RESULT_VIEWER_MAX_CELL_TEXT_LENGTH): string {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength)}…`;
}

function estimateJsonLength(value: unknown, maxLength: number): number {
    try {
        const json = JSON.stringify(value);
        return json.length > maxLength ? maxLength + 1 : json.length;
    } catch {
        return maxLength + 1;
    }
}

function shouldInlineDrawerPayload(value: unknown): boolean {
    return estimateJsonLength(value, RESULT_VIEWER_MAX_DRAWER_PAYLOAD_CHARS) <= RESULT_VIEWER_MAX_DRAWER_PAYLOAD_CHARS;
}

function toDisplayCell(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return summariseArray(value);
        }

        return "[Object]";
    }

    return truncateResultViewerText(String(value));
}

function toCopyCell(value: unknown): string {
    if (value === null) {
        return "null";
    }

    if (value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        return Array.isArray(value) ? summariseArray(value) : "[Object]";
    }

    const text = String(value);
    return text.length > RESULT_VIEWER_MAX_CELL_TEXT_LENGTH
        ? `${text.slice(0, RESULT_VIEWER_MAX_CELL_TEXT_LENGTH)}… (truncated in viewer; use Save JSON for full value)`
        : text;
}

function isLargeScalarValue(value: unknown): boolean {
    return typeof value === "string" && value.length > RESULT_VIEWER_MAX_CELL_TEXT_LENGTH;
}

function isPrimitiveArray(value: unknown[]): boolean {
    return value.every((item) =>
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
    );
}

function isObjectArray(value: unknown[]): boolean {
    return value.length > 0 && value.every((item) =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item)
    );
}

function summariseObjectArrayFields(items: unknown[]): string {
    const fieldSet = new Set<string>();

    items.forEach((item) => {
        if (isPlainObject(item)) {
            Object.keys(item).forEach((key) => {
                if (key.startsWith("@odata.")) {
                    return;
                }

                if (key.startsWith("_") && key.endsWith("_value")) {
                    return;
                }

                fieldSet.add(key);
            });
        }
    });

    const preview = Array.from(fieldSet).slice(0, 2);
    return preview.join(", ");
}

function summarisePrimitiveArray(items: unknown[]): string {
    const printable = items
        .filter((item) => item !== null && item !== undefined)
        .map((item) => String(item));

    if (printable.length === 0) {
        return "Empty";
    }

    const preview = printable.slice(0, 2).join(", ");
    return printable.length <= 2
        ? `${printable.length} value${printable.length === 1 ? "" : "s"} • ${preview}`
        : `${printable.length} values • ${preview}`;
}

function summariseObjectArray(items: unknown[]): string {
    if (items.length === 0) {
        return "Empty";
    }

    const preview = summariseObjectArrayFields(items);
    const label = items.length === 1 ? "1 record" : `${items.length} records`;

    return preview ? `${label} • ${preview}` : label;
}

function summariseArray(items: unknown[]): string {
    if (items.length === 0) {
        return "Empty";
    }

    if (isPrimitiveArray(items)) {
        return summarisePrimitiveArray(items);
    }

    if (isObjectArray(items)) {
        return summariseObjectArray(items);
    }

    return `${items.length} items`;
}

function sortColumns(columns: string[]): string[] {
    return [...columns].sort(compareColumns);
}

function prioritizePrimaryIdField(columns: string[], primaryIdField?: string): string[] {
    if (!primaryIdField) {
        return columns;
    }

    const remaining = columns.filter((column) => column !== primaryIdField);

    return columns.includes(primaryIdField)
        ? [primaryIdField, ...remaining]
        : columns;
}

function compareColumns(left: string, right: string): number {
    const rankCompare = getColumnRank(left) - getColumnRank(right);

    if (rankCompare !== 0) {
        return rankCompare;
    }

    return left.localeCompare(right);
}

function getColumnRank(column: string): number {
    if (column.includes(".")) {
        return 5;
    }

    if (isSystemColumn(column)) {
        return 30;
    }

    if (isLookupColumn(column)) {
        return 20;
    }

    return 10;
}

function isFormattedValueAnnotationKey(key: string): boolean {
    return key.includes("@OData.Community.Display.V1.FormattedValue");
}

function shouldKeepFlattenedChildField(childKey: string): boolean {
    const leafKey = childKey.includes(".")
        ? childKey.slice(childKey.lastIndexOf(".") + 1)
        : childKey;

    if (leafKey.startsWith("@odata.")) {
        return false;
    }

    if (isFormattedValueAnnotationKey(childKey) || isFormattedValueAnnotationKey(leafKey)) {
        return false;
    }

    if (leafKey.startsWith("_") && leafKey.endsWith("_value")) {
        return false;
    }

    return true;
}

function deriveEntitySetName(queryPath: string): string | undefined {
    const trimmed = queryPath.trim();
    if (!trimmed) {
        return undefined;
    }

    const beforeQuery = trimmed.split("?")[0] ?? "";
    const beforeRecord = beforeQuery.split("(")[0] ?? "";
    const normalized = beforeRecord.replace(/^\/+/, "").trim();

    return normalized || undefined;
}

function buildFieldMap(fields?: FieldDef[]): Map<string, FieldDef> {
    return new Map((fields ?? [])
        .filter((field) => !!field.logicalName)
        .map((field) => [field.logicalName.toLowerCase(), field]));
}

function resolveFieldForColumn(column: string, fieldMap: Map<string, FieldDef>): FieldDef | undefined {
    const direct = fieldMap.get(column.toLowerCase());
    if (direct) {
        return direct;
    }

    if (isLookupColumn(column)) {
        const baseFieldName = column.slice(1, -"_value".length).toLowerCase();
        return fieldMap.get(baseFieldName);
    }

    return undefined;
}

function resolveDisplayValue(
    row: Record<string, unknown> | undefined,
    rowValue: unknown,
    column: string,
    fieldMap: Map<string, FieldDef>,
    choiceMetadata: ChoiceMetadataDef[]
): string {
    const formattedAnnotationKey = `${column}@OData.Community.Display.V1.FormattedValue`;
    const formattedAnnotationValue = row ? row[formattedAnnotationKey] : undefined;
    const formattedDisplay = toDisplayCell(formattedAnnotationValue);
    if (formattedDisplay) {
        return formattedDisplay;
    }

    const rawDisplay = toDisplayCell(rowValue);
    if (!rawDisplay) {
        return rawDisplay;
    }

    const field = fieldMap.get(column.toLowerCase());
    if (!field || !isChoiceAttributeType(field.attributeType)) {
        return rawDisplay;
    }

    const resolved = resolveChoiceValueFromMetadata(choiceMetadata, field.logicalName, rawDisplay);
    return resolved?.option?.label ?? rawDisplay;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldFlattenExpandedArray(value: unknown): value is Record<string, unknown>[] {
    return (
        Array.isArray(value) &&
        value.length === 1 &&
        isPlainObject(value[0])
    );
}

function shouldFlattenExpandedObject(value: unknown): value is Record<string, unknown> {
    return isPlainObject(value);
}

function buildRelationshipAlias(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .toLowerCase();
}

function buildRelationshipAliasMap(columns: string[]): Map<string, string> {
    const aliasMap = new Map<string, string>();
    const usedAliases = new Set<string>();

    columns.forEach((column) => {
        const parts = column.split(".");
        if (parts.length <= 1) {
            return;
        }

        const relationshipParts = parts.slice(0, -1);

        relationshipParts.forEach((part) => {
            if (aliasMap.has(part)) {
                return;
            }

            const baseAlias = buildRelationshipAlias(part) || "rel";
            let alias = baseAlias;
            let counter = 2;

            while (usedAliases.has(alias)) {
                alias = `${baseAlias}${counter}`;
                counter++;
            }

            aliasMap.set(part, alias);
            usedAliases.add(alias);
        });
    });

    return aliasMap;
}

function applyColumnAliases(columns: string[], aliasMap: Map<string, string>): string[] {
    return columns.map((column) => {
        const parts = column.split(".");
        if (parts.length <= 1) {
            return column;
        }

        const leaf = parts[parts.length - 1];
        const relationshipParts = parts.slice(0, -1);

        const aliasedPrefix = relationshipParts
            .map((part) => aliasMap.get(part) ?? part)
            .join(".");

        return `${aliasedPrefix}.${leaf}`;
    });
}

function collectFlattenedColumnsFromRow(
    row: Record<string, unknown>,
    columnSet: Set<string>,
    depth = 0,
    maxDepth = RESULT_VIEWER_MAX_FLATTEN_DEPTH,
    prefix = ""
): void {
    Object.entries(row).forEach(([key, value]) => {
        if (key.includes("@odata.")) {
            return;
        }

        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (shouldFlattenExpandedArray(value) && depth < maxDepth) {
            collectFlattenedColumnsFromRow(value[0], columnSet, depth + 1, maxDepth, fullKey);
            return;
        }

        if (shouldFlattenExpandedObject(value) && depth < maxDepth) {
            collectFlattenedColumnsFromRow(value, columnSet, depth + 1, maxDepth, fullKey);
            return;
        }

        if (shouldKeepFlattenedChildField(fullKey)) {
            columnSet.add(fullKey);
        }
    });
}

function flattenExpandedRow(
    row: Record<string, unknown>,
    depth = 0,
    maxDepth = RESULT_VIEWER_MAX_FLATTEN_DEPTH
): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    Object.entries(row).forEach(([key, value]) => {
        if (shouldFlattenExpandedArray(value) && depth < maxDepth) {
            const child = value[0];
            const flattenedChild = flattenExpandedRow(child, depth + 1, maxDepth);

            Object.entries(flattenedChild).forEach(([childKey, childValue]) => {
                if (!shouldKeepFlattenedChildField(childKey)) {
                    return;
                }

                flattened[`${key}.${childKey}`] = childValue;
            });

            return;
        }

        if (shouldFlattenExpandedObject(value) && depth < maxDepth) {
            const flattenedChild = flattenExpandedRow(value, depth + 1, maxDepth);

            Object.entries(flattenedChild).forEach(([childKey, childValue]) => {
                if (!shouldKeepFlattenedChildField(childKey)) {
                    return;
                }

                flattened[`${key}.${childKey}`] = childValue;
            });

            return;
        }

        flattened[key] = value;
    });

    return flattened;
}


function detectResultViewerQueryMode(query: string): ResultViewerQueryMode {
    return /(?:^|[?&])fetchXml=/i.test(query) ? "fetchxml" : "odata";
}

function classifyCellValueType(value: unknown): ResultViewerCellValueType {
    if (value === null || value === undefined) {
        return "empty";
    }

    if (Array.isArray(value)) {
        return "array";
    }

    if (typeof value === "object") {
        return "object";
    }

    return "scalar";
}

function buildCell(
    row: Record<string, unknown> | undefined,
    rowValue: unknown,
    column: string,
    rowPrimaryIdValue: unknown,
    queryPath: string,
    options: ResultViewerBuildOptions,
    fieldMap: Map<string, FieldDef>,
    choiceMetadata: ChoiceMetadataDef[]
): ResultViewerCell {
    const rawValue = rowValue;
    const valueType = classifyCellValueType(rowValue);
    const displayValue = resolveDisplayValue(row, rowValue, column, fieldMap, choiceMetadata);
    const copyValue = toCopyCell(rowValue);
    const isTruncated = isLargeScalarValue(rowValue);

    const isNullValue = rowValue === null;
    const shouldResolveActions =
        rowValue !== undefined &&
        !isTruncated &&
        !Array.isArray(rowValue) &&
        (rowValue === null || typeof rowValue !== "object");

    const actionRawValue = shouldResolveActions && !isNullValue ? truncateResultViewerText(String(rowValue), RESULT_VIEWER_MAX_ACTION_VALUE_LENGTH) : "";
    const actionGuid = shouldResolveActions && options.primaryIdField
        ? toDisplayCell(column === options.primaryIdField ? rowValue : rowPrimaryIdValue)
        : "";

    const field = resolveFieldForColumn(column, fieldMap);

    const actions = shouldResolveActions
        ? resolveResultViewerActions({
            guid: actionGuid,
            entitySetName: options.entitySetName,
            entityLogicalName: options.entityLogicalName,
            primaryIdField: options.primaryIdField,
            fieldLogicalName: field?.logicalName,
            fieldAttributeType: field?.attributeType,
            queryMode: detectResultViewerQueryMode(queryPath),
            columnName: column,
            rawValue: actionRawValue,
            displayValue,
            isNullValue,
            sourceDocumentUri: options.sourceTarget?.sourceDocumentUri,
            sourceRangeStartLine: options.sourceTarget?.sourceRangeStartLine,
            sourceRangeStartCharacter: options.sourceTarget?.sourceRangeStartCharacter,
            sourceRangeEndLine: options.sourceTarget?.sourceRangeEndLine,
            sourceRangeEndCharacter: options.sourceTarget?.sourceRangeEndCharacter,
            traversal: options.traversalContext
                ? {
                    traversalSessionId: options.traversalContext.traversalSessionId,
                    legIndex: options.traversalContext.legIndex,
                    hasNextLeg: options.traversalContext.hasNextLeg,
                    nextLegLabel: options.traversalContext.nextLegLabel,
                    nextLegEntityName: options.traversalContext.nextLegEntityName,
                    requiredCarryField: options.traversalContext.requiredCarryField,
                    isFinalLeg: options.traversalContext.isFinalLeg,
                    canSiblingExpand: options.traversalContext.canSiblingExpand
                }
                : undefined
        })
        : undefined;

    const primaryActions = actions?.filter((action) => action.placement === "primary");
    const overflowActions = actions?.filter((action) => action.placement === "overflow");

    // Keep rawValue and drawerPayload exact. Several Result Viewer invariants depend on
    // object/array cells remaining drawer-routed and export-faithful. Large-result
    // stability is handled by session-backed chunk transport, not by replacing raw
    // payloads with display summaries inside the view-model builder.
    const exportValue = Array.isArray(rawValue) || (typeof rawValue === "object" && rawValue !== null)
        ? JSON.stringify(rawValue)
        : copyValue;

    const drawerPayload = valueType === "array" || valueType === "object"
        ? {
            column,
            payload: rawValue
        }
        : undefined;

    return {
        value: displayValue,
        rawValue,
        isTruncated: isTruncated || undefined,
        largeValueHint: isTruncated ? "Value truncated in Result Viewer. Use Save JSON for the full payload." : undefined,
        copyValue,
        exportValue,
        valueType,
        originalColumnName: column,
        primaryActions: primaryActions?.length ? primaryActions : undefined,
        overflowActions: overflowActions?.length ? overflowActions : undefined,
        drawerPayload,
        actions: actions?.length ? actions : undefined
    };
}


function toRelationshipActionTitle(field: FieldDef | undefined, sourceColumn: string): string {
    const display = String(field?.displayName ?? "").trim();
    const logical = String(field?.logicalName ?? sourceColumn).trim();
    const base = display || logical.replace(/^_+|_value$/g, "");
    const words = base.replace(/_/g, " ").trim();
    const titled = words.replace(/\b\w/g, (c) => c.toUpperCase());
    return `Expand ${titled}`;
}

function buildHiddenRelationshipActions(
    sourceRow: Record<string, unknown>,
    options: ResultViewerBuildOptions | undefined,
    primaryIdField: string | undefined,
    fieldMap: Map<string, FieldDef>,
    queryMode: ResultViewerQueryMode
): ResultViewerResolvedAction[] {
    if (!primaryIdField || queryMode !== "odata") {
        return [];
    }

    const actions: ResultViewerResolvedAction[] = [];
    const seen = new Set<string>();

    Object.keys(sourceRow).forEach((key) => {
        if (!(key.startsWith("_") && key.endsWith("_value"))) {
            return;
        }

        const raw = sourceRow[key];
        if (raw === undefined || raw === null || String(raw).trim() === "") {
            return;
        }

        const field = resolveFieldForColumn(key, fieldMap);
        if (!field || !isLookupLikeAttributeType(field.attributeType)) {
            return;
        }

        const logicalName = String(field.logicalName ?? "").trim();
        if (!logicalName || seen.has(logicalName.toLowerCase())) {
            return;
        }
        seen.add(logicalName.toLowerCase());

        actions.push({
            id: "preview-expand-relationship",
            title: toRelationshipActionTitle(field, key),
            icon: "↘",
            placement: "overflow",
            group: "dice",
            kind: "preview",
            payload: {
                entitySetName: options?.entitySetName,
                entityLogicalName: options?.entityLogicalName,
                primaryIdField,
                fieldLogicalName: logicalName,
                fieldAttributeType: field.attributeType,
                columnName: primaryIdField,
                rawValue: String(sourceRow[primaryIdField] ?? ""),
                sourceDocumentUri: options?.sourceTarget?.sourceDocumentUri,
                sourceRangeStartLine: options?.sourceTarget?.sourceRangeStartLine,
                sourceRangeStartCharacter: options?.sourceTarget?.sourceRangeStartCharacter,
                sourceRangeEndLine: options?.sourceTarget?.sourceRangeEndLine,
                sourceRangeEndCharacter: options?.sourceTarget?.sourceRangeEndCharacter
            },
            isEnabled: true
        });
    });

    return actions;
}

function appendHiddenRelationshipActionsToPrimaryCell(
    rowModel: Record<string, ResultViewerCell>,
    sourceRow: Record<string, unknown>,
    options: ResultViewerBuildOptions | undefined,
    primaryIdField: string | undefined,
    fieldMap: Map<string, FieldDef>,
    queryMode: ResultViewerQueryMode
): void {
    if (!primaryIdField) {
        return;
    }

    const primaryCell = rowModel[primaryIdField];
    if (!primaryCell) {
        return;
    }

    const relationshipActions = buildHiddenRelationshipActions(sourceRow, options, primaryIdField, fieldMap, queryMode);
    if (!relationshipActions.length) {
        return;
    }

    const existingActions = primaryCell.actions ?? [];
    const dedup = new Set(existingActions.map((action) => `${action.id}:${String(action.payload?.fieldLogicalName ?? "").toLowerCase()}`));
    const merged = existingActions.slice();

    relationshipActions.forEach((action) => {
        const key = `${action.id}:${String(action.payload?.fieldLogicalName ?? "").toLowerCase()}`;
        if (!dedup.has(key)) {
            merged.push(action);
            dedup.add(key);
        }
    });

    primaryCell.actions = merged;
    primaryCell.primaryActions = merged.filter((action) => action.placement === "primary");
    primaryCell.overflowActions = merged.filter((action) => action.placement === "overflow");
}

function buildRowActions(row: Record<string, ResultViewerCell>, primaryIdField?: string): ResultViewerResolvedAction[] {
    const priority = [
        "investigate-record",
        "open-in-dataverse-ui",
        "continue-traversal",
        "copy-record-url"
        ];
    const byId = new Map<string, ResultViewerResolvedAction>();

    Object.values(row).forEach((cell) => {
        (cell.actions ?? []).forEach((action) => {
            const isPrimaryInspectionAction = action.group === "investigate" || action.group === "metadata"
                ? action.payload.columnName === primaryIdField
                : true;

            if (!isPrimaryInspectionAction) {
                return;
            }

            if (!byId.has(action.id)) {
                byId.set(action.id, action);
            }
        });
    });

    return priority
        .map((id) => byId.get(id))
        .filter((action): action is ResultViewerResolvedAction => !!action);
}

export function buildResultViewerModel(
    result: unknown,
    query: string,
    options?: ResultViewerBuildOptions
): ResultViewerModel {
    const rawJson = options?.suppressRawJson ? "" : JSON.stringify(result, null, 2);
    const entitySetName = options?.entitySetName ?? deriveEntitySetName(query);
    const entityLogicalName = options?.entityLogicalName;
    const primaryIdField = options?.primaryIdField;
    const environment = options?.environment;
    const traversalContext = options?.traversalContext;
    const traversal = traversalContext?.showBanner === false
        ? undefined
        : traversalContext
            ? {
                title: traversalContext.bannerTitle
                    ?? (traversalContext.isFinalLeg
                        ? "Guided Traversal complete • "
                        : `Guided Traversal: leg ${traversalContext.legIndex + 1} of ${traversalContext.legCount} • `),
                subtitle: traversalContext.bannerSubtitle
                    ?? (traversalContext.isFinalLeg
                        ? (traversalContext.currentEntityName
                            ? `Reached: ${traversalContext.currentEntityName}`
                            : "Reached destination")
                        : traversalContext.nextLegLabel
                            ? `Next: ${traversalContext.nextLegLabel}`
                            : "Select a row to continue"),
                traversalSessionId: traversalContext.traversalSessionId,
                canSiblingExpand: traversalContext.canSiblingExpand,
                canRunBatch: traversalContext.canRunBatch,
                canRunOptimizedBatch: traversalContext.canRunOptimizedBatch,
                requiredCarryField: traversalContext.requiredCarryField
            }
            : undefined;

    const emptyState = traversalContext
        ? (traversalContext.isFinalLeg
            ? {
                title: "Traversal finished",
                message: "This route reached the destination, but no usable rows were returned."
            }
            : {
                title: "No results for this path",
                message: "This route is structurally valid, but valid routes do not guarantee matching data. Try another variant."
            })
        : {
            title: "No results found."
        };

    const fieldMap = buildFieldMap(options?.fields);
    const choiceMetadata = options?.choiceMetadata ?? [];

    if (
        typeof result === "object" &&
        result !== null &&
        "value" in result &&
        Array.isArray((result as { value?: unknown[] }).value)
    ) {
        const rows = (result as { value: unknown[] }).value;

        const columnSet = new Set<string>();

        rows.forEach((row) => {
            if (isPlainObject(row)) {
                collectFlattenedColumnsFromRow(row, columnSet);
            }
        });

        const sourceColumns = prioritizePrimaryIdField(
            sortColumns(Array.from(columnSet).filter((column) => shouldKeepFlattenedChildField(column))),
            primaryIdField
        );
        const queryShape = getParsedQueryShape(query);
        const shouldUseSafeDisplayColumns = !queryShape.hasSelect && sourceColumns.length > RESULT_VIEWER_SAFE_MODE_COLUMN_LIMIT;
        const columns = shouldUseSafeDisplayColumns
            ? sourceColumns.slice(0, RESULT_VIEWER_SAFE_MODE_COLUMN_LIMIT)
            : sourceColumns;

        const relationshipAliasMap = buildRelationshipAliasMap(columns);
        const displayColumns = applyColumnAliases(columns, relationshipAliasMap);

        const displayToSourceColumn = new Map<string, string>();
        displayColumns.forEach((displayColumn, index) => {
            displayToSourceColumn.set(displayColumn, columns[index]);
        });

        const queryMode = detectResultViewerQueryMode(query);
        const rowWindowOffset = Math.max(0, options?.rowWindow?.offset ?? 0);
        const rowWindowLimit = Math.max(1, options?.rowWindow?.limit ?? rows.length);
        const windowedRows = rows
            .slice(rowWindowOffset, rowWindowOffset + rowWindowLimit)
            .map((row) => isPlainObject(row) ? flattenExpandedRow(row) : row);

        const mappedRows = windowedRows.map((row): Record<string, ResultViewerCell> => {
            const mapped: Record<string, ResultViewerCell> = {};

            displayColumns.forEach((displayColumn) => {
                const sourceColumn = displayToSourceColumn.get(displayColumn) ?? displayColumn;

                const rowValue =
                    isPlainObject(row)
                        ? row[sourceColumn]
                        : undefined;

                const rowPrimaryIdValue = isPlainObject(row) && primaryIdField
                    ? row[primaryIdField]
                    : undefined;

                mapped[displayColumn] = buildCell(isPlainObject(row) ? row : undefined, rowValue, sourceColumn, rowPrimaryIdValue, query, {
                    ...options,
                    entitySetName,
                    entityLogicalName,
                    primaryIdField,
                    environment
                }, fieldMap, choiceMetadata);
            });

            if (isPlainObject(row)) {
                appendHiddenRelationshipActionsToPrimaryCell(mapped, row, {
                    ...options,
                    entitySetName,
                    entityLogicalName,
                    primaryIdField,
                    environment
                }, primaryIdField, fieldMap, queryMode);
            }

            return mapped;
        });

        const rowActions = mappedRows
            .map((row, rowIndex) => ({ rowIndex, actions: buildRowActions(row, primaryIdField) }))
            .filter((item) => item.actions.length > 0);

        return {
            title: `Query Result (${rows.length} rows)`,
            mode: "collection",
            columns: displayColumns,
            rows: mappedRows,
            legend: Array.from(relationshipAliasMap.entries()).map(([fullName, alias]) => ({
                alias,
                fullName
            })),
            rawJson,
            rowCount: rows.length,
            queryPath: query,
            entitySetName,
            entityLogicalName,
            primaryIdField,
            traversal,
            binderSuggestion: buildResultViewerBinderSuggestion({
                queryPath: query,
                rowCount: rows.length,
                columnCount: sourceColumns.length,
                traversalContext,
                executionContext: options?.executionContext
            }),
            insightSuggestions: buildResultViewerInsightSuggestions({
                queryPath: query,
                rowCount: rows.length,
                columnCount: sourceColumns.length,
                result,
                fields: options?.fields,
                traversalContext,
                executionContext: options?.executionContext
            }),
            environment,
            emptyState,
            rowActions: rowActions.length ? rowActions : undefined,
            paging: options?.paging,
            sourceTarget: options?.sourceTarget,
            session: options?.sessionId
                ? {
                    id: options.sessionId,
                    rowOffset: rowWindowOffset,
                    chunkSize: rowWindowLimit,
                    totalRows: rows.length,
                    hasMoreRows: rowWindowOffset + mappedRows.length < rows.length
                }
                : undefined,
            executionContext: options?.executionContext
        };
    }

    if (typeof result === "object" && result !== null) {
        const columns = prioritizePrimaryIdField(
            sortColumns(Object.keys(result as Record<string, unknown>).filter((column) => shouldKeepFlattenedChildField(column))),
            primaryIdField
        );

        const mapped: Record<string, ResultViewerCell> = {};

        columns.forEach((column) => {
            const rowPrimaryIdValue = primaryIdField
                ? (result as Record<string, unknown>)[primaryIdField]
                : undefined;

            mapped[column] = buildCell(result as Record<string, unknown>, (result as Record<string, unknown>)[column], column, rowPrimaryIdValue, query, {
                ...options,
                entitySetName,
                entityLogicalName,
                primaryIdField,
                environment
            }, fieldMap, choiceMetadata);
        });

        appendHiddenRelationshipActionsToPrimaryCell(mapped, result as Record<string, unknown>, {
            ...options,
            entitySetName,
            entityLogicalName,
            primaryIdField,
            environment
        }, primaryIdField, fieldMap, detectResultViewerQueryMode(query));

        const recordRowActions = [{ rowIndex: 0, actions: buildRowActions(mapped, primaryIdField) }].filter((item) => item.actions.length > 0);

        return {
            title: "Record Result",
            mode: "record",
            columns,
            rows: [mapped],
            rawJson,
            rowCount: 1,
            queryPath: query,
            entitySetName,
            entityLogicalName,
            primaryIdField,
            traversal,
            binderSuggestion: buildResultViewerBinderSuggestion({
                queryPath: query,
                rowCount: 1,
                columnCount: columns.length,
                traversalContext,
                executionContext: options?.executionContext
            }),
            insightSuggestions: buildResultViewerInsightSuggestions({
                queryPath: query,
                rowCount: 1,
                columnCount: columns.length,
                result,
                fields: options?.fields,
                traversalContext,
                executionContext: options?.executionContext
            }),
            environment,
            emptyState,
            rowActions: recordRowActions.length ? recordRowActions : undefined,
            paging: options?.paging,
            sourceTarget: options?.sourceTarget,
            executionContext: options?.executionContext
        };
    }

    return {
        title: "Raw Result",
        mode: "raw",
        columns: [],
        rows: [],
        rawJson,
        rowCount: 0,
        queryPath: query,
        entitySetName,
        entityLogicalName,
        primaryIdField,
        traversal,
        binderSuggestion: buildResultViewerBinderSuggestion({
            queryPath: query,
            rowCount: 0,
            columnCount: 0,
            traversalContext,
            executionContext: options?.executionContext
        }),
        insightSuggestions: buildResultViewerInsightSuggestions({
            queryPath: query,
            rowCount: 0,
            columnCount: 0,
            result,
            fields: options?.fields,
            traversalContext,
            executionContext: options?.executionContext
        }),
        environment,
        paging: options?.paging,
        sourceTarget: options?.sourceTarget,
        executionContext: options?.executionContext
    };
}
