export interface ResultViewerCell {
    value: string;
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
    primaryIdField?: string;
}

export interface ResultViewerBuildOptions {
    entitySetName?: string;
    primaryIdField?: string;
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

function compareColumns(left: string, right: string): number {
    const rankCompare = getColumnRank(left) - getColumnRank(right);

    if (rankCompare !== 0) {
        return rankCompare;
    }

    return left.localeCompare(right);
}

function getColumnRank(column: string): number {
    if (column.startsWith("@odata.")) {
        return 30;
    }

    if (column.startsWith("_") && column.endsWith("_value")) {
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

export function buildResultViewerModel(
    result: unknown,
    query: string,
    options?: ResultViewerBuildOptions
): ResultViewerModel {
    const rawJson = JSON.stringify(result, null, 2);
    const entitySetName = options?.entitySetName ?? deriveEntitySetName(query);
    const primaryIdField = options?.primaryIdField;

    if (
        typeof result === "object" &&
        result !== null &&
        "value" in result &&
        Array.isArray((result as { value?: unknown[] }).value)
    ) {
        const rows = (result as { value: unknown[] }).value;

        const columns = rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null
            ? sortColumns(Object.keys(rows[0] as Record<string, unknown>))
            : [];

        const mappedRows = rows.map((row): Record<string, ResultViewerCell> => {
            const mapped: Record<string, ResultViewerCell> = {};

            columns.forEach((column) => {
                const rowValue =
                    typeof row === "object" && row !== null
                        ? (row as Record<string, unknown>)[column]
                        : undefined;

                mapped[column] = {
                    value: toDisplayCell(rowValue)
                };
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
            primaryIdField
        };
    }

    if (typeof result === "object" && result !== null) {
        const columns = sortColumns(Object.keys(result as Record<string, unknown>));

        const mapped: Record<string, ResultViewerCell> = {};

        columns.forEach((column) => {
            mapped[column] = {
                value: toDisplayCell((result as Record<string, unknown>)[column])
            };
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
            primaryIdField
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
        primaryIdField
    };
}