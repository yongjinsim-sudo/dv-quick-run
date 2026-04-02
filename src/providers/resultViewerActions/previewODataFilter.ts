import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { applyEditorQueryUpdate } from "../../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { isGuidValue } from "./columnIntelligence.js";

export interface ODataFilterPreviewResult {
    originalQuery: string;
    proposedClause: string;
    previewQuery: string;
    target: EditorQueryTarget;
}

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export async function previewAndApplyODataFilter(columnName: string, rawValue: string): Promise<void> {
    const resolved = resolveBestODataEditorTarget();
    if (!resolved) {
        await fallbackToCopiedODataFilter(columnName, rawValue);
        return;
    }

    const preview = buildODataFilterPreviewFromTarget(resolved.target, columnName, rawValue);

    await openOrReuseQueryPreviewDocument(buildPreviewDocumentContent(preview));

    const choice = await vscode.window.showWarningMessage(
        "DV Quick Run: Preview is ready. Apply it to the detected query?",
        { modal: true },
        "Apply Preview"
    );

    if (choice !== "Apply Preview") {
        void vscode.window.showInformationMessage(
            "DV Quick Run: Preview cancelled. The detected query was not changed."
        );
        return;
    }

    await applyEditorQueryUpdate(preview.target, preview.previewQuery);

    await vscode.window.showTextDocument(preview.target.editor.document, {
        viewColumn: preview.target.editor.viewColumn,
        preserveFocus: false,
        preview: false
    });

    void vscode.window.showInformationMessage("DV Quick Run: Preview applied to query.");
}

export function buildODataFilterPreview(columnName: string, rawValue: string): ODataFilterPreviewResult {
    const resolved = resolveBestODataEditorTarget();
    if (!resolved) {
        throw new Error("Preview OData filter requires a visible OData query in the editor.");
    }

    return buildODataFilterPreviewFromTarget(resolved.target, columnName, rawValue);
}

export function buildODataFilterPreviewFromTarget(
    target: EditorQueryTarget,
    columnName: string,
    rawValue: string
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
    const mergedFilter = existingFilter
        ? `(${existingFilter}) and (${proposedClause})`
        : proposedClause;

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

export function buildODataFilter(columnName: string, rawValue: string): string {
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

async function openOrReuseQueryPreviewDocument(content: string): Promise<vscode.TextEditor> {
    const document = await vscode.workspace.openTextDocument(QUERY_PREVIEW_URI);

    const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false,
        viewColumn: vscode.ViewColumn.Beside
    });

    const fullText = document.getText();
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(fullText.length)
    );

    await editor.edit((editBuilder) => {
        if (fullText.length === 0) {
            editBuilder.insert(new vscode.Position(0, 0), content);
        } else {
            editBuilder.replace(fullRange, content);
        }
    });

    return editor;
}

async function fallbackToCopiedODataFilter(columnName: string, rawValue: string): Promise<void> {
    const filter = buildODataFilter(columnName, rawValue);
    await vscode.env.clipboard.writeText(filter);

    void vscode.window.showWarningMessage(
        "DV Quick Run: No visible OData query editor was detected. Falling back to copied OData filter."
    );
}

function buildPreviewDocumentContent(preview: ODataFilterPreviewResult): string {
    return [
        "DV Quick Run – Query Preview",
        "============================",
        "",
        "Preview OData Filter",
        "",
        "This preview document is reused by DV Quick Run and will be overwritten by the next preview action.",
        "",
        "Original query:",
        preview.originalQuery,
        "",
        "Proposed clause:",
        preview.proposedClause,
        "",
        "Preview query:",
        preview.previewQuery,
        "",
        "Use the confirmation dialog to apply this preview.",
        "Dismissing the dialog leaves the detected query unchanged."
    ].join("\n");
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

function formatODataValue(rawValue: string): string {
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
