import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../services/entityFieldMetadataService.js";
import {
    resolveResultViewerActions
} from "../providers/resultViewerActions/registry.js";
import type {
    ResultViewerResolvedAction
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

export interface ResultViewerCell {
    value: string;
    rawValue: string;
    actions?: ResultViewerResolvedAction[];
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
    environment?: ResultViewerEnvironmentInfo;
}

export interface ResultViewerBuildOptions {
    entitySetName?: string;
    entityLogicalName?: string;
    primaryIdField?: string;
    environment?: ResultViewerEnvironmentInfo;
    fields?: FieldDef[];
    choiceMetadata?: ChoiceMetadataDef[];
}

function toDisplayCell(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return "[Array]";
        }

        return "[Object]";
    }

    return String(value);
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
    if (isSystemColumn(column)) {
        return 30;
    }

    if (isLookupColumn(column)) {
        return 20;
    }

    return 10;
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
    rowValue: unknown,
    column: string,
    fieldMap: Map<string, FieldDef>,
    choiceMetadata: ChoiceMetadataDef[]
): string {
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

function buildCell(
    rowValue: unknown,
    column: string,
    options: ResultViewerBuildOptions,
    fieldMap: Map<string, FieldDef>,
    choiceMetadata: ChoiceMetadataDef[]
): ResultViewerCell {
    const rawValue = toDisplayCell(rowValue);
    const displayValue = resolveDisplayValue(rowValue, column, fieldMap, choiceMetadata);
    const actions = rawValue
        ? resolveResultViewerActions({
            guid: options.primaryIdField && column === options.primaryIdField ? rawValue : undefined,
            entitySetName: options.entitySetName,
            entityLogicalName: options.entityLogicalName,
            primaryIdField: options.primaryIdField,
            columnName: column,
            rawValue
        })
        : undefined;

    return {
        value: displayValue,
        rawValue,
        actions: actions?.length ? actions : undefined
    };
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
    const fieldMap = buildFieldMap(options?.fields);
    const choiceMetadata = options?.choiceMetadata ?? [];

    if (
        typeof result === "object" &&
        result !== null &&
        "value" in result &&
        Array.isArray((result as { value?: unknown[] }).value)
    ) {
        const rows = (result as { value: unknown[] }).value;

        const columns = rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null
            ? prioritizePrimaryIdField(
                sortColumns(Object.keys(rows[0] as Record<string, unknown>)),
                primaryIdField
            )
            : [];

        const mappedRows = rows.map((row): Record<string, ResultViewerCell> => {
            const mapped: Record<string, ResultViewerCell> = {};

            columns.forEach((column) => {
                const rowValue =
                    typeof row === "object" && row !== null
                        ? (row as Record<string, unknown>)[column]
                        : undefined;

                mapped[column] = buildCell(rowValue, column, {
                    ...options,
                    entitySetName,
                    entityLogicalName,
                    primaryIdField,
                    environment
                }, fieldMap, choiceMetadata);
            });

            return mapped;
        });

        return {
            title: `Query Result (${mappedRows.length} rows)`,
            mode: "collection",
            columns,
            rows: mappedRows,
            rawJson,
            rowCount: mappedRows.length,
            queryPath: query,
            entitySetName,
            entityLogicalName,
            primaryIdField,
            environment
        };
    }

    if (typeof result === "object" && result !== null) {
        const columns = prioritizePrimaryIdField(
            sortColumns(Object.keys(result as Record<string, unknown>)),
            primaryIdField
        );

        const mapped: Record<string, ResultViewerCell> = {};

        columns.forEach((column) => {
            mapped[column] = buildCell((result as Record<string, unknown>)[column], column, {
                ...options,
                entitySetName,
                entityLogicalName,
                primaryIdField,
                environment
            }, fieldMap, choiceMetadata);
        });

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
            environment
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
        environment
    };
}
