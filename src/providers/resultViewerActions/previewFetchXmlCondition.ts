import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { applyEditorQueryUpdate } from "../../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";

export interface FetchXmlConditionPreviewResult {
    originalQuery: string;
    proposedCondition: string;
    previewQuery: string;
    target: EditorQueryTarget;
}

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export async function previewAndApplyFetchXmlCondition(columnName: string, rawValue: string): Promise<void> {
    const resolved = resolveBestFetchXmlEditorTarget();
    if (!resolved) {
        await fallbackToCopiedFetchXmlCondition(columnName, rawValue);
        return;
    }

    const preview = buildFetchXmlConditionPreviewFromTarget(resolved.target, columnName, rawValue);

    await openOrReuseQueryPreviewDocument(buildPreviewDocumentContent(preview));

    const choice = await vscode.window.showWarningMessage(
        "DV Quick Run: Preview is ready. Apply it to the detected FetchXML query?",
        { modal: true },
        "Apply Preview"
    );

    if (choice !== "Apply Preview") {
        void vscode.window.showInformationMessage(
            "DV Quick Run: Preview cancelled. The detected FetchXML query was not changed."
        );
        return;
    }

    await applyEditorQueryUpdate(preview.target, preview.previewQuery);

    await vscode.window.showTextDocument(preview.target.editor.document, {
        viewColumn: preview.target.editor.viewColumn,
        preserveFocus: false,
        preview: false
    });

    void vscode.window.showInformationMessage("DV Quick Run: Preview applied to FetchXML query.");
}

export function buildFetchXmlConditionPreview(columnName: string, rawValue: string): FetchXmlConditionPreviewResult {
    const resolved = resolveBestFetchXmlEditorTarget();
    if (!resolved) {
        throw new Error("Preview FetchXML condition requires a visible FetchXML query in the editor.");
    }

    return buildFetchXmlConditionPreviewFromTarget(resolved.target, columnName, rawValue);
}

export function buildFetchXmlConditionPreviewFromTarget(
    target: EditorQueryTarget,
    columnName: string,
    rawValue: string
): FetchXmlConditionPreviewResult {
    const rawText = extractFetchXmlText(target.text);

    if (!rawText || !looksLikeFetchXml(rawText)) {
        throw new Error("Preview FetchXML condition requires a visible FetchXML query in the editor.");
    }

    const proposedCondition = buildFetchXmlCondition(columnName, rawValue);
    const previewQuery = injectFetchXmlCondition(rawText, proposedCondition);

    return {
        originalQuery: rawText,
        proposedCondition,
        previewQuery,
        target: {
            ...target,
            text: rawText
        }
    };
}

export function buildFetchXmlCondition(columnName: string, rawValue: string): string {
    return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="${escapeXmlAttribute(rawValue)}" />`;
}

function tryResolveFetchXmlTargetFromEditor(editor: vscode.TextEditor | undefined) {
    if (!editor) {
        return undefined;
    }

    try {
        const selectedText = editor.document.getText(editor.selection).trim();
        if (selectedText && looksLikeFetchXml(selectedText)) {
            return {
                target: {
                    editor,
                    range: editor.selection,
                    text: selectedText,
                    source: "selection" as const
                }
            };
        }

        const document = editor.document;
        const activeLine = editor.selection.active.line;
        const block = resolveFetchXmlBlock(document, activeLine);
        if (!block) {
            return undefined;
        }

        return {
            target: {
                editor,
                range: new vscode.Range(
                    document.lineAt(block.startLine).range.start,
                    document.lineAt(block.endLine).range.end
                ),
                text: block.text,
                source: "line" as const
            }
        };
    } catch {
        return undefined;
    }
}

function resolveBestFetchXmlEditorTarget() {
    const active = tryResolveFetchXmlTargetFromEditor(vscode.window.activeTextEditor);
    if (active) {
        return active;
    }

    for (const editor of vscode.window.visibleTextEditors) {
        const resolved = tryResolveFetchXmlTargetFromEditor(editor);
        if (resolved) {
            return resolved;
        }
    }

    return undefined;
}

function resolveFetchXmlBlock(document: vscode.TextDocument, activeLine: number): { startLine: number; endLine: number; text: string } | undefined {
    let startLine = -1;

    for (let line = activeLine; line >= 0; line--) {
        const text = document.lineAt(line).text;
        if (looksLikeFetchXmlStartLine(text)) {
            startLine = line;
            break;
        }
    }

    if (startLine < 0) {
        return undefined;
    }

    let endLine = -1;
    for (let line = startLine; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        if (looksLikeFetchXmlEndLine(text)) {
            endLine = line;
            break;
        }
    }

    if (endLine < 0) {
        return undefined;
    }

    const lines: string[] = [];
    for (let line = startLine; line <= endLine; line++) {
        lines.push(document.lineAt(line).text);
    }

    return {
        startLine,
        endLine,
        text: lines.join("\n").trim()
    };
}

async function openOrReuseQueryPreviewDocument(content: string): Promise<vscode.TextEditor> {
    const document = await vscode.workspace.openTextDocument(QUERY_PREVIEW_URI);

    const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false,
        viewColumn: vscode.ViewColumn.Beside
    });

    const fullText = document.getText();
    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));

    await editor.edit((editBuilder) => {
        if (fullText.length === 0) {
            editBuilder.insert(new vscode.Position(0, 0), content);
        } else {
            editBuilder.replace(fullRange, content);
        }
    });

    return editor;
}

async function fallbackToCopiedFetchXmlCondition(columnName: string, rawValue: string): Promise<void> {
    const condition = buildFetchXmlCondition(columnName, rawValue);
    await vscode.env.clipboard.writeText(condition);

    void vscode.window.showWarningMessage(
        "DV Quick Run: No visible FetchXML query editor was detected. Falling back to copied FetchXML condition."
    );
}

function buildPreviewDocumentContent(preview: FetchXmlConditionPreviewResult): string {
    return [
        "DV Quick Run – Query Preview",
        "============================",
        "",
        "Preview FetchXML Condition",
        "",
        "This preview document is reused by DV Quick Run and will be overwritten by the next preview action.",
        "",
        "Original query:",
        preview.originalQuery,
        "",
        "Proposed condition:",
        preview.proposedCondition,
        "",
        "Preview query:",
        preview.previewQuery,
        "",
        "Use the confirmation dialog to apply this preview.",
        "Dismissing the dialog leaves the detected query unchanged."
    ].join("\n");
}

function extractFetchXmlText(rawText: string): string {
    return rawText.trim();
}

function injectFetchXmlCondition(fetchXml: string, condition: string): string {
    const filterOpenMatch = fetchXml.match(/<filter\b[^>]*>/i);
    if (filterOpenMatch?.index !== undefined) {
        const filterCloseIndex = fetchXml.indexOf("</filter>", filterOpenMatch.index + filterOpenMatch[0].length);
        if (filterCloseIndex >= 0) {
            return `${fetchXml.slice(0, filterCloseIndex)}\n    ${condition}\n${fetchXml.slice(filterCloseIndex)}`;
        }
    }

    const entityCloseIndex = fetchXml.lastIndexOf("</entity>");
    if (entityCloseIndex < 0) {
        throw new Error("Could not find a safe FetchXML insertion point.");
    }

    const newFilter = [
        "",
        "  <filter type=\"and\">",
        `    ${condition}`,
        "  </filter>"
    ].join("\n");

    return `${fetchXml.slice(0, entityCloseIndex)}${newFilter}\n${fetchXml.slice(entityCloseIndex)}`;
}

function looksLikeFetchXml(text: string): boolean {
    const trimmed = text.trim();
    return /<fetch[\s>]/i.test(trimmed) && /<\/fetch\s*>/i.test(trimmed);
}

function looksLikeFetchXmlStartLine(text: string): boolean {
    const line = text.trim();
    if (!line) {
        return false;
    }

    if (line.startsWith("<?xml")) {
        return /<fetch[\s>]/i.test(line);
    }

    return /<fetch[\s>]/i.test(line);
}

function looksLikeFetchXmlEndLine(text: string): boolean {
    return /<\/fetch\s*>/i.test(text.trim());
}

function escapeXmlAttribute(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&apos;");
}
