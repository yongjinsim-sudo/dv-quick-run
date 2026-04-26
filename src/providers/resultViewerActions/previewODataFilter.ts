import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { previewAndApplyMutationResult, type MutationResult } from "../../refinement/queryPreview.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { isGuidValue } from "./columnIntelligence.js";

export interface ODataFilterPreviewResult {
    originalQuery: string;
    proposedClause: string;
    previewQuery: string;
    target: EditorQueryTarget;
}

export async function previewAndApplyODataFilter(columnName: string, rawValue: string | null): Promise<void> {
    const resolved = resolveBestODataEditorTarget();
    if (!resolved) {
        await fallbackToCopiedODataFilter(columnName, rawValue);
        return;
    }

    const preview = buildODataFilterPreviewFromTarget(resolved.target, columnName, rawValue);
    const result: MutationResult = {
        originalQuery: preview.originalQuery,
        updatedQuery: preview.previewQuery
    };

    await previewAndApplyMutationResult(preview.target, result, {
        heading: "Preview OData Filter",
        sections: [
            {
                label: "Proposed clause",
                value: preview.proposedClause
            }
        ]
    });
}

export function buildODataFilterPreview(columnName: string, rawValue: string | null): ODataFilterPreviewResult {
    const resolved = resolveBestODataEditorTarget();
    if (!resolved) {
        throw new Error("Preview OData filter requires a visible OData query in the editor.");
    }

    return buildODataFilterPreviewFromTarget(resolved.target, columnName, rawValue);
}

export function buildODataFilterPreviewFromTarget(
    target: EditorQueryTarget,
    columnName: string,
    rawValue: string | null
): ODataFilterPreviewResult {
    const rawText = extractODataQueryText(target.text);

    if (!rawText || rawText.startsWith("<")) {
        throw new Error("Preview OData filter requires a visible OData query in the editor.");
    }

    const parsed = parseEditorQuery(rawText);
    if (!parsed.entityPath) {
        throw new Error("Could not resolve an OData query target from the editor.");
    }

    const proposedClause = buildODataFilter(columnName, rawValue);
    const existingFilter = (parsed.queryOptions.get("$filter") ?? "").trim();
    const mergedFilter = mergeODataFilter(existingFilter, proposedClause, { replaceSameColumn: true });

    parsed.queryOptions.delete("$filter");
    parsed.queryOptions.set("$filter", mergedFilter);

    return {
        originalQuery: rawText,
        proposedClause,
        previewQuery: buildEditorQuery(parsed),
        target: {
            ...target,
            text: rawText
        }
    };
}

export interface MergeODataFilterOptions {
    replaceSameColumn?: boolean;
}

export function mergeODataFilter(
    existingFilter: string,
    proposedClause: string,
    options: MergeODataFilterOptions = {}
): string {
    const existingClauses = flattenAndClauses(existingFilter);
    const proposed = stripOuterParentheses(proposedClause.trim());
    const proposedColumn = getSimpleFilterColumn(proposed);
    const clauses: string[] = [];
    const seen = new Set<string>();

    for (const clause of existingClauses) {
        const normalized = normalizeFilterClause(clause);
        if (!normalized || seen.has(normalized)) {
            continue;
        }

        if (options.replaceSameColumn && proposedColumn) {
            const clauseColumn = getSimpleFilterColumn(clause);
            if (clauseColumn && clauseColumn.toLowerCase() === proposedColumn.toLowerCase()) {
                continue;
            }
        }

        seen.add(normalized);
        clauses.push(clause);
    }

    const proposedNormalized = normalizeFilterClause(proposed);
    if (proposedNormalized && !seen.has(proposedNormalized)) {
        clauses.push(proposed);
    }

    if (clauses.length === 0) {
        return proposed;
    }

    return clauses.length === 1
        ? clauses[0]
        : clauses.map((clause) => `(${clause})`).join(" and ");
}

function flattenAndClauses(filter: string): string[] {
    const stripped = stripOuterParentheses(filter.trim());
    if (!stripped) {
        return [];
    }

    const parts = splitTopLevelAnd(stripped)
        .map((clause) => stripOuterParentheses(clause.trim()))
        .filter(Boolean);

    if (parts.length <= 1) {
        return parts;
    }

    return parts.flatMap((part) => flattenAndClauses(part));
}

function splitTopLevelAnd(filter: string): string[] {
    const text = filter.trim();
    if (!text) {
        return [];
    }

    const clauses: string[] = [];
    let depth = 0;
    let inString = false;
    let start = 0;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (character === "'") {
            if (inString && text[index + 1] === "'") {
                index++;
                continue;
            }

            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (character === "(") {
            depth++;
            continue;
        }

        if (character === ")" && depth > 0) {
            depth--;
            continue;
        }

        if (depth === 0 && text.slice(index, index + 5).toLowerCase() === " and ") {
            clauses.push(text.slice(start, index).trim());
            start = index + 5;
            index += 4;
        }
    }

    clauses.push(text.slice(start).trim());
    return clauses.filter(Boolean);
}

function stripOuterParentheses(value: string): string {
    let text = value.trim();

    while (text.startsWith("(") && text.endsWith(")") && outerParenthesesWrapWholeExpression(text)) {
        text = text.slice(1, -1).trim();
    }

    return text;
}

function outerParenthesesWrapWholeExpression(text: string): boolean {
    let depth = 0;
    let inString = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (character === "'") {
            if (inString && text[index + 1] === "'") {
                index++;
                continue;
            }

            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (character === "(") {
            depth++;
        } else if (character === ")") {
            depth--;
            if (depth === 0 && index < text.length - 1) {
                return false;
            }
        }
    }

    return depth === 0;
}

function normalizeFilterClause(clause: string): string {
    return stripOuterParentheses(clause)
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getSimpleFilterColumn(clause: string): string | undefined {
    const normalized = stripOuterParentheses(clause).trim();
    const match = /^([A-Za-z_][A-Za-z0-9_./]*)\s+(?:eq|ne|lt|le|gt|ge)\s+/i.exec(normalized);
    return match?.[1];
}


export function buildODataFilter(columnName: string, rawValue: string | null): string {
    return `${columnName} eq ${formatODataValue(rawValue)}`;
}

function tryResolveODataTargetFromEditor(editor: vscode.TextEditor | undefined) {
    if (!editor) {
        return undefined;
    }

    try {
        const selectionText = editor.document.getText(editor.selection).trim();

        const target: EditorQueryTarget = selectionText
            ? {
                editor,
                range: editor.selection,
                text: selectionText,
                source: "selection"
            }
            : (() => {
                const line = editor.document.lineAt(editor.selection.active.line);
                const text = line.text.trim();

                if (!text) {
                    throw new Error("Current line is empty.");
                }

                return {
                    editor,
                    range: line.range,
                    text,
                    source: "line" as const
                };
            })();

        const rawText = extractODataQueryText(target.text);
        if (!rawText || rawText.startsWith("<")) {
            return undefined;
        }

        const parsed = parseEditorQuery(rawText);
        if (!parsed.entityPath) {
            return undefined;
        }

        return {
            editor,
            target: {
                ...target,
                text: rawText
            },
            parsed
        };
    } catch {
        return undefined;
    }
}

function resolveBestODataEditorTarget() {
    const active = tryResolveODataTargetFromEditor(vscode.window.activeTextEditor);
    if (active) {
        return active;
    }

    for (const editor of vscode.window.visibleTextEditors) {
        const resolved = tryResolveODataTargetFromEditor(editor);
        if (resolved) {
            return resolved;
        }
    }

    return undefined;
}

async function fallbackToCopiedODataFilter(columnName: string, rawValue: string | null): Promise<void> {
    const filter = buildODataFilter(columnName, rawValue);
    await vscode.env.clipboard.writeText(filter);

    void vscode.window.showWarningMessage(
        "DV Quick Run: No visible OData query editor was detected. Falling back to copied OData filter."
    );
}

function extractODataQueryText(rawText: string): string {
    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return "";
    }

    const queryLine = [...lines].reverse().find(looksLikeODataQueryLine);
    return queryLine ?? rawText.trim();
}

function looksLikeODataQueryLine(line: string): boolean {
    return /^\/?[A-Za-z_][A-Za-z0-9_]*(\([^)]*\))?(\?.*)?$/.test(line);
}

function formatODataValue(rawValue: string | null): string {
    if (rawValue === null) {
        return "null";
    }

    const value = rawValue.trim();

    if (!value) {
        return "''";
    }

    if (isGuidValue(value)) {
        return `'${value}'`;
    }

    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return value;
    }

    const lowered = value.toLowerCase();
    if (lowered === "true" || lowered === "false") {
        return lowered;
    }

    return `'${value.replace(/'/g, "''")}'`;
}
