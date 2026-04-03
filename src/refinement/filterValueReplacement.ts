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

  const match = findDeterministicEqComparison(filter, fieldLogicalName, oldValue);
  if (!match) {
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
  const filter = parsed.queryOptions.get("$filter");

  if (!filter) {
    throw new Error("Replace Filter Value requires an existing $filter clause.");
  }

  const confirmedIntent = resolveDeterministicReplaceFilterValueIntent(
    parsed,
    intent.fieldLogicalName,
    intent.oldValue,
    intent.newValue
  );

  if (!confirmedIntent) {
    throw new Error("Replace Filter Value requires a deterministic eq filter match.");
  }

  const match = findDeterministicEqComparison(filter, confirmedIntent.fieldLogicalName, confirmedIntent.oldValue);
  if (!match) {
    throw new Error("Replace Filter Value could not resolve the exact comparison to replace.");
  }

  const replacement = `${confirmedIntent.fieldLogicalName} eq ${formatReplacementValue(match.rawValue, confirmedIntent.newValue)}`;
  const nextFilter = filter.slice(0, match.start) + replacement + filter.slice(match.end);

  const updated = new URLSearchParams(parsed.queryOptions.toString());
  updated.set("$filter", nextFilter);
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
      value: String(opt.value), 
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



type DeterministicEqComparisonMatch = {
  start: number;
  end: number;
  rawValue: string;
};

function findDeterministicEqComparison(
  filter: string,
  fieldLogicalName: string,
  oldValue: string
): DeterministicEqComparisonMatch | undefined {
  const regex = /\b([A-Za-z_][A-Za-z0-9_]*)\s+eq\s+((?:true|false|-?\d+(?:\.\d+)?)|'(?:[^']|'')*')/gi;
  const matches: DeterministicEqComparisonMatch[] = [];

  for (const match of filter.matchAll(regex)) {
    const [fullMatch, matchedField, matchedRawValue] = match;
    if (!fullMatch || matchedField === undefined || matchedRawValue === undefined || match.index === undefined) {
      continue;
    }

    if (matchedField.trim().toLowerCase() !== fieldLogicalName.trim().toLowerCase()) {
      continue;
    }

    if (normalizeScalarToken(matchedRawValue) !== normalizeScalarToken(oldValue)) {
      continue;
    }

    matches.push({
      start: match.index,
      end: match.index + fullMatch.length,
      rawValue: matchedRawValue
    });
  }

  if (matches.length !== 1) {
    return undefined;
  }

  return matches[0];
}

function formatReplacementValue(previousRawValue: string, newValue: string): string {
  const trimmedPrevious = previousRawValue.trim();
  if (trimmedPrevious.startsWith("'") && trimmedPrevious.endsWith("'")) {
    const escaped = newValue.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  return newValue;
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
