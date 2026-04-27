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

        const fullModel = buildResultViewerModel(session.result, session.query, {
            ...session.options,
            suppressRawJson: true
        });

        const columns = fullModel.columns;
        const lines = [columns.map(csvEscape).join(",")];

        fullModel.rows.forEach((row) => {
            lines.push(columns.map((column) => csvEscape(row[column]?.exportValue ?? row[column]?.copyValue ?? row[column]?.value ?? "")).join(","));
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
