import {
    buildResultViewerModel,
    type ResultViewerBuildOptions,
    type ResultViewerCell,
    type ResultViewerModel
} from "../services/resultViewModelBuilder.js";

const DEFAULT_CHUNK_SIZE = 100;
const MAX_ACTIVE_SESSIONS = 3;

export interface ResultViewerSessionChunk {
    sessionId: string;
    offset: number;
    limit: number;
    totalRows: number;
    rows: Array<Record<string, ResultViewerCell>>;
    rowActions?: ResultViewerModel["rowActions"];
    hasMoreRows: boolean;
    sourceRowIndexes?: number[];
}

export interface ResultViewerSessionSearchResult {
    sessionId: string;
    searchText: string;
    totalRows: number;
    matchingRowIndexes: number[];
    matchCount: number;
    firstMatchIndex?: number;
    rows: Array<Record<string, ResultViewerCell>>;
    rowActions?: ResultViewerModel["rowActions"];
    sourceRowIndexes: number[];
}

interface ResultViewerSessionEntry {
    id: string;
    createdAt: number;
    lastAccessedAt: number;
    result: unknown;
    query: string;
    options: ResultViewerBuildOptions;
}

function createSessionId(): string {
    return `rv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCollectionRows(result: unknown): unknown[] {
    if (
        typeof result === "object" &&
        result !== null &&
        !Array.isArray(result) &&
        Array.isArray((result as { value?: unknown[] }).value)
    ) {
        return (result as { value: unknown[] }).value;
    }

    return [];
}

function toJsonText(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function getCollectionResult(result: unknown): Record<string, unknown> | undefined {
    if (typeof result === "object" && result !== null && !Array.isArray(result)) {
        return result as Record<string, unknown>;
    }

    return undefined;
}

function isFormattedValueColumn(columnName: string): boolean {
    return columnName.includes("@OData.Community.Display.V1.FormattedValue");
}

function collectRawCsvColumns(rows: unknown[]): string[] {
    const columns: string[] = [];
    const seen = new Set<string>();

    rows.forEach((row) => {
        if (typeof row !== "object" || row === null || Array.isArray(row)) {
            return;
        }

        Object.keys(row as Record<string, unknown>).forEach((column) => {
            if (isFormattedValueColumn(column) || seen.has(column)) {
                return;
            }

            seen.add(column);
            columns.push(column);
        });
    });

    return columns;
}

function getCsvCellValue(row: unknown, column: string): unknown {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
        return "";
    }

    const record = row as Record<string, unknown>;
    const formattedColumn = `${column}@OData.Community.Display.V1.FormattedValue`;
    if (formattedColumn in record) {
        return record[formattedColumn];
    }

    return record[column] ?? "";
}

function valueContainsText(value: unknown, searchText: string): boolean {
    if (value === null || value === undefined) {
        return false;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value).toLowerCase().includes(searchText);
    }

    try {
        return JSON.stringify(value).toLowerCase().includes(searchText);
    } catch {
        return String(value).toLowerCase().includes(searchText);
    }
}

function csvEscape(value: unknown): string {
    const text = value === null || value === undefined
        ? ""
        : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);

    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

export class ResultViewerSessionStore {
    private static sessions = new Map<string, ResultViewerSessionEntry>();

    public static createInitialModel(
        result: unknown,
        query: string,
        options: ResultViewerBuildOptions,
        chunkSize = DEFAULT_CHUNK_SIZE
    ): ResultViewerModel {
        const id = createSessionId();
        const now = Date.now();

        ResultViewerSessionStore.sessions.set(id, {
            id,
            createdAt: now,
            lastAccessedAt: now,
            result,
            query,
            options
        });

        ResultViewerSessionStore.evictOldSessions(id);

        return buildResultViewerModel(result, query, {
            ...options,
            suppressRawJson: true,
            sessionId: id,
            rowWindow: {
                offset: 0,
                limit: chunkSize
            }
        });
    }

    public static getRows(sessionId: string, offset: number, limit = DEFAULT_CHUNK_SIZE): ResultViewerSessionChunk | undefined {
        const session = ResultViewerSessionStore.touch(sessionId);
        if (!session) {
            return undefined;
        }

        const safeOffset = Math.max(0, Math.floor(offset));
        const safeLimit = Math.max(1, Math.floor(limit));
        const model = buildResultViewerModel(session.result, session.query, {
            ...session.options,
            suppressRawJson: true,
            sessionId: session.id,
            rowWindow: {
                offset: safeOffset,
                limit: safeLimit
            }
        });

        return {
            sessionId,
            offset: safeOffset,
            limit: safeLimit,
            totalRows: model.rowCount,
            rows: model.rows,
            rowActions: model.rowActions,
            hasMoreRows: safeOffset + model.rows.length < model.rowCount
        };
    }

    public static getRawJson(sessionId: string): string | undefined {
        const session = ResultViewerSessionStore.touch(sessionId);
        return session ? toJsonText(session.result) : undefined;
    }

    public static searchRows(sessionId: string, searchText: string): ResultViewerSessionSearchResult | undefined {
        const session = ResultViewerSessionStore.touch(sessionId);
        if (!session) {
            return undefined;
        }

        const normalized = String(searchText ?? "").trim().toLowerCase();
        const rows = getCollectionRows(session.result);
        if (!normalized) {
            return {
                sessionId,
                searchText,
                totalRows: rows.length,
                matchingRowIndexes: [],
                matchCount: 0,
                rows: [],
                sourceRowIndexes: []
            };
        }

        const matchingRowIndexes: number[] = [];
        rows.forEach((row, index) => {
            if (valueContainsText(row, normalized)) {
                matchingRowIndexes.push(index);
            }
        });

        const matchingRows = matchingRowIndexes.map((index) => rows[index]);
        const syntheticResult = typeof session.result === "object" && session.result !== null && !Array.isArray(session.result)
            ? {
                ...(session.result as Record<string, unknown>),
                value: matchingRows
            }
            : { value: matchingRows };

        const model = buildResultViewerModel(syntheticResult, session.query, {
            ...session.options,
            suppressRawJson: true,
            sessionId: session.id,
            rowWindow: {
                offset: 0,
                limit: Math.max(1, matchingRows.length)
            }
        });

        return {
            sessionId,
            searchText,
            totalRows: rows.length,
            matchingRowIndexes,
            matchCount: matchingRowIndexes.length,
            firstMatchIndex: matchingRowIndexes[0],
            rows: model.rows,
            rowActions: model.rowActions,
            sourceRowIndexes: matchingRowIndexes
        };
    }

    public static getRowJson(sessionId: string, rowIndex: number): string | undefined {
        const session = ResultViewerSessionStore.touch(sessionId);
        if (!session) {
            return undefined;
        }

        const rows = getCollectionRows(session.result);
        const row = rows[rowIndex];
        if (row === undefined) {
            return undefined;
        }

        return toJsonText(row);
    }

    public static buildCsv(sessionId: string): string | undefined {
        const session = ResultViewerSessionStore.touch(sessionId);
        if (!session) {
            return undefined;
        }

        // Export is intentionally session-backed and raw-row driven.
        // Do not rebuild the full Result Viewer model here: model building can trigger
        // table/action work that is unnecessary and fragile for very large or wide payloads
        // such as plugintracelogs.
        const rows = getCollectionRows(session.result);
        const columns = collectRawCsvColumns(rows);

        if (columns.length === 0) {
            const result = getCollectionResult(session.result);
            if (!result) {
                return undefined;
            }

            return Object.entries(result)
                .map(([key, value]) => `${csvEscape(key)},${csvEscape(value)}`)
                .join("\n");
        }

        const lines = [columns.map(csvEscape).join(",")];
        rows.forEach((row) => {
            lines.push(columns.map((column) => csvEscape(getCsvCellValue(row, column))).join(","));
        });

        return lines.join("\n");
    }

    public static dispose(sessionId: string): void {
        ResultViewerSessionStore.sessions.delete(sessionId);
    }

    private static touch(sessionId: string): ResultViewerSessionEntry | undefined {
        const session = ResultViewerSessionStore.sessions.get(sessionId);
        if (session) {
            session.lastAccessedAt = Date.now();
        }

        return session;
    }

    private static evictOldSessions(activeSessionId: string): void {
        if (ResultViewerSessionStore.sessions.size <= MAX_ACTIVE_SESSIONS) {
            return;
        }

        const candidates = Array.from(ResultViewerSessionStore.sessions.values())
            .filter((session) => session.id !== activeSessionId)
            .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);

        while (ResultViewerSessionStore.sessions.size > MAX_ACTIVE_SESSIONS && candidates.length > 0) {
            const next = candidates.shift();
            if (next) {
                ResultViewerSessionStore.sessions.delete(next.id);
            }
        }
    }
}
