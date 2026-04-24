import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { previewAndApplyMutationResult, type MutationResult } from "../../refinement/queryPreview.js";
import { isGuidValue } from "./columnIntelligence.js";

export type ResultViewerSliceOperation =
  | "equalsCurrent"
  | "isNull"
  | "isNotNull"
  | "isTrue"
  | "isFalse"
  | "beforeCurrent"
  | "afterCurrent";

export interface ResultViewerSliceDefinition {
  operation: ResultViewerSliceOperation;
  title: string;
  summary: string;
}

export interface ResultViewerSlicePreviewResult {
  originalQuery: string;
  proposedClause: string;
  previewQuery: string;
  target: EditorQueryTarget;
}

export function getSupportedSliceDefinitions(
  fieldAttributeType: string | undefined,
  rawValue: string
): ResultViewerSliceDefinition[] {
  const normalizedRawValue = String(rawValue ?? "").trim();
  if (!normalizedRawValue) {
    return [];
  }

  if (isBooleanLike(fieldAttributeType, normalizedRawValue)) {
    return [
      { operation: "isTrue", title: "Slice: true", summary: "Filter rows where this field is true" },
      { operation: "isFalse", title: "Slice: false", summary: "Filter rows where this field is false" },
      { operation: "isNotNull", title: "Slice: field is not null", summary: "Filter rows where this field has a value" }
    ];
  }

  const definitions: ResultViewerSliceDefinition[] = [
    { operation: "equalsCurrent", title: "Slice: equals this value", summary: "Filter rows matching this value" },
    { operation: "isNull", title: "Slice: field is null", summary: "Filter rows where this field is null" },
    { operation: "isNotNull", title: "Slice: field is not null", summary: "Filter rows where this field has a value" }
  ];

  if (isDateLike(fieldAttributeType, normalizedRawValue)) {
    definitions.push(
      { operation: "beforeCurrent", title: "Slice: before this value", summary: "Filter rows before this date/time" },
      { operation: "afterCurrent", title: "Slice: after this value", summary: "Filter rows after this date/time" }
    );
  }

  return definitions;
}

export async function previewAndApplyODataSlice(
  columnName: string,
  rawValue: string,
  operation: ResultViewerSliceOperation
): Promise<void> {
  const resolved = resolveBestODataEditorTarget();
  if (!resolved) {
    await fallbackToCopiedClause(buildODataSliceClause(columnName, rawValue, operation), "OData");
    return;
  }

  const preview = buildODataSlicePreviewFromTarget(resolved.target, columnName, rawValue, operation);
  const result: MutationResult = {
    originalQuery: preview.originalQuery,
    updatedQuery: preview.previewQuery
  };

  await previewAndApplyMutationResult(preview.target, result, {
    heading: "Preview Result Viewer Slice",
    sections: [{ label: "Proposed clause", value: preview.proposedClause }]
  });
}

export function buildODataSlicePreviewFromTarget(
  target: EditorQueryTarget,
  columnName: string,
  rawValue: string,
  operation: ResultViewerSliceOperation
): ResultViewerSlicePreviewResult {
  const rawText = extractODataQueryText(target.text);

  if (!rawText || rawText.startsWith("<")) {
    throw new Error("Preview Result Viewer slice requires a visible OData query in the editor.");
  }

  const parsed = parseEditorQuery(rawText);
  if (!parsed.entityPath) {
    throw new Error("Could not resolve an OData query target from the editor.");
  }

  const proposedClause = buildODataSliceClause(columnName, rawValue, operation);
  const existingFilter = (parsed.queryOptions.get("$filter") ?? "").trim();
  const mergedFilter = existingFilter ? `(${existingFilter}) and (${proposedClause})` : proposedClause;

  parsed.queryOptions.delete("$filter");
  parsed.queryOptions.set("$filter", mergedFilter);

  return {
    originalQuery: rawText,
    proposedClause,
    previewQuery: buildEditorQuery(parsed),
    target: { ...target, text: rawText }
  };
}

export async function previewAndApplyFetchXmlSlice(
  columnName: string,
  rawValue: string,
  operation: ResultViewerSliceOperation
): Promise<void> {
  const resolved = resolveBestFetchXmlEditorTarget();
  if (!resolved) {
    await fallbackToCopiedClause(buildFetchXmlSliceCondition(columnName, rawValue, operation), "FetchXML");
    return;
  }

  const preview = buildFetchXmlSlicePreviewFromTarget(resolved.target, columnName, rawValue, operation);
  const result: MutationResult = {
    originalQuery: preview.originalQuery,
    updatedQuery: preview.previewQuery
  };

  await previewAndApplyMutationResult(preview.target, result, {
    heading: "Preview Result Viewer Slice",
    sections: [{ label: "Proposed condition", value: preview.proposedClause }]
  });
}

export function buildFetchXmlSlicePreviewFromTarget(
  target: EditorQueryTarget,
  columnName: string,
  rawValue: string,
  operation: ResultViewerSliceOperation
): ResultViewerSlicePreviewResult {
  const rawText = extractFetchXmlText(target.text);

  if (!rawText || !looksLikeFetchXml(rawText)) {
    throw new Error("Preview Result Viewer slice requires a visible FetchXML query in the editor.");
  }

  const proposedClause = buildFetchXmlSliceCondition(columnName, rawValue, operation);
  const previewQuery = injectFetchXmlCondition(rawText, proposedClause);

  return {
    originalQuery: rawText,
    proposedClause,
    previewQuery,
    target: { ...target, text: rawText }
  };
}

export function buildODataSliceClause(
  columnName: string,
  rawValue: string,
  operation: ResultViewerSliceOperation
): string {
  switch (operation) {
    case "equalsCurrent":
      return `${columnName} eq ${formatODataValue(rawValue)}`;
    case "isNull":
      return `${columnName} eq null`;
    case "isNotNull":
      return `${columnName} ne null`;
    case "isTrue":
      return `${columnName} eq true`;
    case "isFalse":
      return `${columnName} eq false`;
    case "beforeCurrent":
      return `${columnName} lt ${formatODataValue(rawValue)}`;
    case "afterCurrent":
      return `${columnName} gt ${formatODataValue(rawValue)}`;
    default:
      return `${columnName} eq ${formatODataValue(rawValue)}`;
  }
}

export function buildFetchXmlSliceCondition(
  columnName: string,
  rawValue: string,
  operation: ResultViewerSliceOperation
): string {
  switch (operation) {
    case "equalsCurrent":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="${escapeXmlAttribute(rawValue)}" />`;
    case "isNull":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="null" />`;
    case "isNotNull":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="not-null" />`;
    case "isTrue":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="1" />`;
    case "isFalse":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="0" />`;
    case "beforeCurrent":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="before" value="${escapeXmlAttribute(rawValue)}" />`;
    case "afterCurrent":
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="after" value="${escapeXmlAttribute(rawValue)}" />`;
    default:
      return `<condition attribute="${escapeXmlAttribute(columnName)}" operator="eq" value="${escapeXmlAttribute(rawValue)}" />`;
  }
}

function isBooleanLike(fieldAttributeType: string | undefined, rawValue: string): boolean {
  const normalizedType = String(fieldAttributeType ?? "").trim().toLowerCase();
  const normalizedValue = rawValue.trim().toLowerCase();
  return normalizedType === "boolean" || normalizedValue === "true" || normalizedValue === "false";
}

function isDateLike(fieldAttributeType: string | undefined, rawValue: string): boolean {
  const normalizedType = String(fieldAttributeType ?? "").trim().toLowerCase();
  if (normalizedType === "datetime" || normalizedType === "date" || normalizedType === "datetimeoffset") {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}(?:[tT ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(rawValue.trim());
}

function tryResolveODataTargetFromEditor(editor: vscode.TextEditor | undefined) {
  if (!editor) {
    return undefined;
  }

  try {
    const selectionText = editor.document.getText(editor.selection).trim();
    const target: EditorQueryTarget = selectionText
      ? { editor, range: editor.selection, text: selectionText, source: "selection" }
      : (() => {
          const line = editor.document.lineAt(editor.selection.active.line);
          const text = line.text.trim();
          if (!text) {
            throw new Error("Current line is empty.");
          }
          return { editor, range: line.range, text, source: "line" as const };
        })();

    const rawText = extractODataQueryText(target.text);
    if (!rawText || rawText.startsWith("<")) {
      return undefined;
    }

    const parsed = parseEditorQuery(rawText);
    if (!parsed.entityPath) {
      return undefined;
    }

    return { target: { ...target, text: rawText } };
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

function extractODataQueryText(rawText: string): string {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return "";
  }

  const queryLine = [...lines].reverse().find((line) => /^\/?[A-Za-z_][A-Za-z0-9_]*(\([^)]*\))?(\?.*)?$/.test(line));
  return queryLine ?? rawText.trim();
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

function tryResolveFetchXmlTargetFromEditor(editor: vscode.TextEditor | undefined) {
  if (!editor) {
    return undefined;
  }

  try {
    const selectedText = editor.document.getText(editor.selection).trim();
    if (selectedText && looksLikeFetchXml(selectedText)) {
      return {
        target: { editor, range: editor.selection, text: selectedText, source: "selection" as const }
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
        range: new vscode.Range(document.lineAt(block.startLine).range.start, document.lineAt(block.endLine).range.end),
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

function resolveFetchXmlBlock(
  document: vscode.TextDocument,
  activeLine: number
): { startLine: number; endLine: number; text: string } | undefined {
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

  return { startLine, endLine, text: lines.join("\n").trim() };
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

  const newFilter = ["", "  <filter type=\"and\">", `    ${condition}`, "  </filter>"].join("\n");
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

async function fallbackToCopiedClause(clause: string, mode: "OData" | "FetchXML"): Promise<void> {
  await vscode.env.clipboard.writeText(clause);
  void vscode.window.showWarningMessage(`DV Quick Run: No visible ${mode} query editor was detected. Falling back to copied slice clause.`);
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
