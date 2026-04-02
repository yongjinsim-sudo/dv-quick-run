import * as vscode from "vscode";
import { applyEditorQueryUpdate } from "../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import { buildEditorQuery, parseEditorQuery, type ParsedEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { type EditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { parseSimpleFilterComparisons } from "../providers/hover/hoverFilterAnalysis.js";

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export interface ReplaceFilterValueIntent {
  type: "replaceFilterValue";
  fieldLogicalName: string;
  oldValue: string;
  newValue: string;
}

export interface ChoiceRefinementOption {
  label: string;
  value: string;
  commandUri: string;
}

export function resolveDeterministicReplaceFilterValueIntent(
  parsed: ReturnType<typeof parseEditorQuery>,
  fieldLogicalName: string,
  oldValue: string,
  newValue: string
): ReplaceFilterValueIntent | undefined {

  const filter = parsed.queryOptions.get("$filter");
  if (!filter) {
    return undefined;
  }

  const normalized = filter.trim().toLowerCase();

  if (normalized.includes(" and ") || normalized.includes(" or ")) {
    return undefined;
  }

  const match = filter.match(/^\s*([\w\d_]+)\s+eq\s+(.+?)\s*$/i);
  if (!match) {
    return undefined;
  }

  const field = match[1];
  const value = match[2].replace(/^'|'$/g, "");

  if (field !== fieldLogicalName) {
    return undefined;
  }

  if (value !== oldValue) {
    return undefined;
  }

  return {
    type: "replaceFilterValue",
    fieldLogicalName,
    oldValue,
    newValue
  };
}

export function buildFilterReplacementPreviewQuery(
  queryText: string,
  intent: ReplaceFilterValueIntent
): string {
  const parsed = parseEditorQuery(queryText);

  const confirmedIntent = resolveDeterministicReplaceFilterValueIntent(
    parsed,
    intent.fieldLogicalName,
    intent.oldValue,
    intent.newValue
  );

  if (!confirmedIntent) {
    throw new Error("Replace Filter Value requires a deterministic single eq filter match.");
  }

  const updated = new URLSearchParams(parsed.queryOptions.toString());
  updated.set("$filter", `${confirmedIntent.fieldLogicalName} eq ${confirmedIntent.newValue}`);
  parsed.queryOptions = updated;

  return buildEditorQuery(parsed);
}

export function buildChoiceRefinementOptions(args: {
  parsed: ReturnType<typeof parseEditorQuery>;
  hoveredWord: string;
  fieldLogicalName: string;
  options: { label: string; value: unknown }[];
  documentUri: vscode.Uri;
  lineNumber: number;
}) {

  const { parsed, hoveredWord, fieldLogicalName, options, documentUri, lineNumber } = args;

  if (!options || options.length === 0) {
    return undefined;
  }

  const results: any[] = [];

  for (const opt of options) {

    const newValue = String(opt.value);

    if (newValue === hoveredWord) {
      continue;
    }

    const intent = resolveDeterministicReplaceFilterValueIntent(
      parsed,
      fieldLogicalName,
      hoveredWord,
      newValue
    );

    if (!intent) {
      continue;
    }

    const commandUri = vscode.Uri.parse(
      `command:dvQuickRun.previewReplaceFilterValueAtLine?${encodeURIComponent(
        JSON.stringify([
          documentUri,
          lineNumber,
          fieldLogicalName,
          hoveredWord,
          newValue
        ])
      )}`
    );

    results.push({
      label: opt.label,
      commandUri: commandUri.toString()
    });
  }

  return results.length ? results : undefined;
}

export async function previewAndApplyReplaceFilterValueAtLine(args: {
  documentUri: vscode.Uri;
  lineNumber: number;
  fieldLogicalName: string;
  oldValue: string;
  newValue: string;
}): Promise<void> {
  const target = await resolveLineTarget(args.documentUri, args.lineNumber);
  const previewQuery = buildFilterReplacementPreviewQuery(target.text, {
    type: "replaceFilterValue",
    fieldLogicalName: args.fieldLogicalName,
    oldValue: args.oldValue,
    newValue: args.newValue
  });

  await openOrReuseQueryPreviewDocument(buildPreviewDocumentContent({
    originalQuery: target.text,
    previewQuery,
    fieldLogicalName: args.fieldLogicalName,
    oldValue: args.oldValue,
    newValue: args.newValue
  }));

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

  await applyEditorQueryUpdate(target, previewQuery);
  await vscode.window.showTextDocument(target.editor.document, {
    viewColumn: target.editor.viewColumn,
    preserveFocus: false,
    preview: false
  });

  void vscode.window.showInformationMessage("DV Quick Run: Preview applied to query.");
}

function buildReplaceFilterValueCommandUri(args: {
  documentUri: vscode.Uri;
  lineNumber: number;
  fieldLogicalName: string;
  oldValue: string;
  newValue: string;
}): string {
  const payload = [
    args.documentUri,
    args.lineNumber,
    args.fieldLogicalName,
    args.oldValue,
    args.newValue
  ];

  return `command:dvQuickRun.previewReplaceFilterValueAtLine?${encodeURIComponent(JSON.stringify(payload))}`;
}

function getSingleEqComparison(parsed: ParsedEditorQuery) {
  const filterValue = (parsed.queryOptions.get("$filter") ?? "").trim();
  if (!filterValue) {
    return undefined;
  }

  const comparisons = parseSimpleFilterComparisons(filterValue);
  if (comparisons.length !== 1) {
    return undefined;
  }

  const [comparison] = comparisons;
  if (!comparison || comparison.operator !== "eq") {
    return undefined;
  }

  const canonical = `${comparison.fieldLogicalName} eq ${comparison.rawValue}`.replace(/\s+/g, " ").trim();
  const normalizedFilter = filterValue.replace(/\s+/g, " ").trim();
  if (canonical !== normalizedFilter) {
    return undefined;
  }

  return comparison;
}

function normalizeScalarToken(value: string): string {
  return value.trim().replace(/^'+|'+$/g, "").toLowerCase();
}

async function resolveLineTarget(documentUri: vscode.Uri, lineNumber: number): Promise<EditorQueryTarget> {
  const document = await vscode.workspace.openTextDocument(documentUri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false
  });
  const position = new vscode.Position(lineNumber, 0);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

  const line = editor.document.lineAt(lineNumber);
  const text = line.text.trim();
  if (!text) {
    throw new Error("Current line is empty.");
  }

  return {
    editor,
    range: line.range,
    text,
    source: "line"
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

function buildPreviewDocumentContent(args: {
  originalQuery: string;
  previewQuery: string;
  fieldLogicalName: string;
  oldValue: string;
  newValue: string;
}): string {
  return [
    "DV Quick Run – Query Preview",
    "============================",
    "",
    "Replace Filter Value",
    "",
    "This preview document is reused by DV Quick Run and will be overwritten by the next preview action.",
    "",
    "Original query:",
    args.originalQuery,
    "",
    "Proposed replacement:",
    `${args.fieldLogicalName}: ${args.oldValue} → ${args.newValue}`,
    "",
    "Preview query:",
    args.previewQuery,
    "",
    "Use the confirmation dialog to apply this preview.",
    "Dismissing the dialog leaves the detected query unchanged."
  ].join("\n");
}
