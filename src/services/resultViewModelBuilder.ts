import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../services/entityFieldMetadataService.js";
import {
    resolveResultViewerActions
} from "../providers/resultViewerActions/registry.js";
import type {
    ResultViewerQueryMode,
    ResultViewerResolvedAction,
    ResultViewerTraversalActionContext
} from "../providers/resultViewerActions/types.js";
import { isChoiceAttributeType } from "../metadata/metadataModel.js";
import {
    isLookupColumn,
    isSystemColumn
} from "../providers/resultViewerActions/columnIntelligence.js";
import { resolveChoiceValueFromMetadata } from "../commands/router/actions/shared/valueAwareness.js";

export interface ResultViewerEnvironmentInfo {
    name: string;
    colorHint: "white" | "amber" | "red";
}

export interface ResultViewerTraversalStatus {
    title: string;
    subtitle?: string;
    traversalSessionId?: string;
    canSiblingExpand?: boolean;
    requiredCarryField?: string;
}

export interface ResultViewerEmptyState {
    title: string;
    message?: string;
}

export interface ResultViewerTraversalContext extends ResultViewerTraversalActionContext {
    legCount: number;
    nextLegLabel?: string;
    nextLegEntityName?: string;
    currentEntityName?: string;
    showBanner?: boolean;
    bannerTitle?: string;
    bannerSubtitle?: string;
}

export type ResultViewerCellValueType = "scalar" | "object" | "array" | "empty";

export interface ResultViewerDrawerPayload {
    column: string;
    payload: unknown;
}

export interface ResultViewerCell {
    value: string;
    rawValue: unknown;
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
    history?: ResultViewerPagingHistoryEntry[];
}

export interface ResultViewerModel {
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
}

export interface ResultViewerLegendItem {
    alias: string;
    fullName: string;
}

// Result viewer detanglement guardrail:
// keep flattening depth intentionally capped so the builder remains the
// single place that defines how nested payloads are interpreted.
export const RESULT_VIEWER_MAX_FLATTEN_DEPTH = 2;

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

    return String(value);
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
    queryPath: string,
    options: ResultViewerBuildOptions,
    fieldMap: Map<string, FieldDef>,
    choiceMetadata: ChoiceMetadataDef[]
): ResultViewerCell {
    const rawValue = rowValue;
    const valueType = classifyCellValueType(rowValue);
    const displayValue = resolveDisplayValue(row, rowValue, column, fieldMap, choiceMetadata);
    const copyValue = toDisplayCell(rowValue);

    const shouldResolveActions =
        !!rawValue &&
        !Array.isArray(rowValue) &&
        typeof rowValue !== "object";

    const actionRawValue = shouldResolveActions ? toDisplayCell(rowValue) : "";
    const actionGuid =
        shouldResolveActions && options.primaryIdField && column === options.primaryIdField
            ? toDisplayCell(rowValue)
            : "";

    const actions = shouldResolveActions
        ? resolveResultViewerActions({
            guid: actionGuid,
            entitySetName: options.entitySetName,
            entityLogicalName: options.entityLogicalName,
            primaryIdField: options.primaryIdField,
            queryMode: detectResultViewerQueryMode(queryPath),
            columnName: column,
            rawValue: actionRawValue,
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

function buildRowActions(row: Record<string, ResultViewerCell>): ResultViewerResolvedAction[] {
    const priority = [
        "continue-traversal",
        "investigate-record",
        "open-in-dataverse-ui",
        "copy-record-url",
        "preview-fetchxml-condition",
        "copy-fetchxml-condition"
        ];
    const byId = new Map<string, ResultViewerResolvedAction>();

    Object.values(row).forEach((cell) => {
        (cell.actions ?? []).forEach((action) => {
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
    const rawJson = JSON.stringify(result, null, 2);
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
        const flattenedRows = rows.map((row) =>
            isPlainObject(row) ? flattenExpandedRow(row) : row
        );

        const columnSet = new Set<string>();

        flattenedRows.forEach((row) => {
            if (isPlainObject(row)) {
                Object.keys(row).forEach((key) => {
                    if (key.includes("@odata.")) {
                        return;
                    }

                    columnSet.add(key);
                });
            }
        });

        const columns = prioritizePrimaryIdField(
            sortColumns(Array.from(columnSet).filter((column) => shouldKeepFlattenedChildField(column))),
            primaryIdField
        );

        const relationshipAliasMap = buildRelationshipAliasMap(columns);
        const displayColumns = applyColumnAliases(columns, relationshipAliasMap);

        const displayToSourceColumn = new Map<string, string>();
        displayColumns.forEach((displayColumn, index) => {
            displayToSourceColumn.set(displayColumn, columns[index]);
        });

        const mappedRows = flattenedRows.map((row): Record<string, ResultViewerCell> => {
            const mapped: Record<string, ResultViewerCell> = {};

            displayColumns.forEach((displayColumn) => {
                const sourceColumn = displayToSourceColumn.get(displayColumn) ?? displayColumn;

                const rowValue =
                    isPlainObject(row)
                        ? row[sourceColumn]
                        : undefined;

                mapped[displayColumn] = buildCell(isPlainObject(row) ? row : undefined, rowValue, sourceColumn, query, {
                    ...options,
                    entitySetName,
                    entityLogicalName,
                    primaryIdField,
                    environment
                }, fieldMap, choiceMetadata);
            });

            return mapped;
        });

        const rowActions = mappedRows
            .map((row, rowIndex) => ({ rowIndex, actions: buildRowActions(row) }))
            .filter((item) => item.actions.length > 0);

        return {
            title: `Query Result (${mappedRows.length} rows)`,
            mode: "collection",
            columns: displayColumns,
            rows: mappedRows,
            legend: Array.from(relationshipAliasMap.entries()).map(([fullName, alias]) => ({
                alias,
                fullName
            })),
            rawJson,
            rowCount: mappedRows.length,
            queryPath: query,
            entitySetName,
            entityLogicalName,
            primaryIdField,
            traversal,
            environment,
            emptyState,
            rowActions: rowActions.length ? rowActions : undefined,
            paging: options?.paging
        };
    }

    if (typeof result === "object" && result !== null) {
        const columns = prioritizePrimaryIdField(
            sortColumns(Object.keys(result as Record<string, unknown>).filter((column) => shouldKeepFlattenedChildField(column))),
            primaryIdField
        );

        const mapped: Record<string, ResultViewerCell> = {};

        columns.forEach((column) => {
            mapped[column] = buildCell(result as Record<string, unknown>, (result as Record<string, unknown>)[column], column, query, {
                ...options,
                entitySetName,
                entityLogicalName,
                primaryIdField,
                environment
            }, fieldMap, choiceMetadata);
        });

        const recordRowActions = [{ rowIndex: 0, actions: buildRowActions(mapped) }].filter((item) => item.actions.length > 0);

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
            environment,
            emptyState,
            rowActions: recordRowActions.length ? recordRowActions : undefined,
            paging: options?.paging
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
        environment,
        paging: options?.paging
    };
}
