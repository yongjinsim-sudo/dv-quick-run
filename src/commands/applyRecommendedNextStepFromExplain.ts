import * as vscode from "vscode";
import type { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { getExplainDocumentState } from "./router/actions/explain/explainDocState.js";
import { parseEditorQuery, buildEditorQuery } from "./router/actions/shared/queryMutation/parsedEditorQuery.js";
import { previewMutationResult } from "../refinement/queryPreview.js";
import type { EditorQueryTarget } from "./router/actions/shared/queryMutation/editorQueryTarget.js";
import { canApplyQueryDoctorFix } from "../product/capabilities/capabilityResolver.js";

async function resolveSourceTarget(sourceUri: vscode.Uri, sourceRange: vscode.Range): Promise<EditorQueryTarget> {
  let editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === sourceUri.toString());

  if (!editor) {
    const document = await vscode.workspace.openTextDocument(sourceUri);
    editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
      viewColumn: vscode.ViewColumn.One
    });
  }

  const currentLine = editor.document.lineAt(sourceRange.start.line);
  const currentLineText = currentLine.text.trim();
  if (!currentLineText) {
    throw new Error("The source query could not be resolved from the explain document state.");
  }

  return {
    editor,
    range: currentLine.range,
    text: currentLineText,
    source: "line"
  };
}

async function applyRecommendedNextStepFromExplain(ctx: CommandContext, documentUri?: vscode.Uri, lineNumber?: number): Promise<void> {
  if (!canApplyQueryDoctorFix()) {
    void vscode.window.showInformationMessage("DV Quick Run: Apply is available on Pro only.");
    return;
  }

  const explainEditor = documentUri
    ? vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === documentUri.toString()) ?? vscode.window.activeTextEditor
    : vscode.window.activeTextEditor;
  if (!explainEditor) {
    throw new Error("No active explain document.");
  }

  const explainState = getExplainDocumentState(explainEditor.document.uri);
  if (!explainState) {
    throw new Error("No explain document state found for the active document.");
  }

  const explicitPreviewQuery = typeof lineNumber === "number"
    ? explainEditor.document.lineAt(lineNumber).text.trim().replace(/^- Preview query:\s*/, "")
    : undefined;

  const finding = explicitPreviewQuery
    ? explainState.diagnostics.findings.find((item) => item.suggestedQuery?.query?.trim() === explicitPreviewQuery)
    : explainState.diagnostics.findings.find((item) => item.narrowingSuggestions?.length);

  if (!finding) {
    void vscode.window.showInformationMessage("DV Quick Run: No applicable preview is available for this explanation.");
    return;
  }

  const previewQuery = explicitPreviewQuery ?? finding.suggestedQuery?.query?.trim();
  if (!previewQuery) {
    void vscode.window.showInformationMessage("DV Quick Run: No preview query is available for this explanation.");
    return;
  }

  const target = await resolveSourceTarget(explainState.source.uri, explainState.source.range);
  const explainSourceQuery = explainState.source.text?.trim() || target.text;

  if (!isSameEntityPath(target.text, explainSourceQuery)) {
    void vscode.window.showWarningMessage("DV Quick Run: This Explain preview was generated for a different query target. Re-run Explain Query before applying this preview.");
    return;
  }

  const updatedQuery = buildUpdatedQueryFromPreview(target.text, explainSourceQuery, previewQuery);

  if (isPreviewAlreadyApplied(target.text, explainSourceQuery, updatedQuery)) {
    void vscode.window.showInformationMessage("DV Quick Run: Recommended preview is already applied to the query.");
    return;
  }

  if (!areQueriesEquivalent(target.text, explainSourceQuery)) {
    void vscode.window.showWarningMessage("DV Quick Run: This Explain preview is stale. Re-run Explain Query before applying this preview.");
    return;
  }

  await previewMutationResult(target, {
    originalQuery: target.text,
    updatedQuery,
    summary: "Apply the recommended next step to the source query."
  }, {
    heading: "Preview Apply Recommended Next Step",
    title: "Recommended next step",
    sections: [
      {
        label: "Action",
        value: finding.suggestion ?? finding.suggestedFix?.label ?? "Apply this suggested change"
      }
    ]
  }, {
    mode: "apply",
    applyButtonLabel: "Apply Preview"
  });
}


function buildUpdatedQueryFromPreview(currentQuery: string, sourceQuery: string, previewQuery: string): string {
  const source = parseEditorQuery(sourceQuery);
  const preview = parsePreviewQueryAgainstSource(source, previewQuery);
  const current = parseEditorQuery(currentQuery);

  if (normalizeValue(current.entityPath) !== normalizeValue(source.entityPath)) {
    return previewQuery.trim();
  }

  if (normalizeValue(preview.entityPath) && normalizeValue(preview.entityPath) !== normalizeValue(source.entityPath)) {
    return previewQuery.trim();
  }

  const changedKeys = getChangedQueryOptionKeys(source, preview);
  if (!changedKeys.length) {
    return previewQuery.trim();
  }

  for (const key of changedKeys) {
    const value = preview.queryOptions.get(key);
    if (value === null) {
      current.queryOptions.delete(key);
    } else {
      current.queryOptions.set(key, value);
    }
  }

  return buildEditorQuery(current);
}

function parsePreviewQueryAgainstSource(source: ReturnType<typeof parseEditorQuery>, previewQuery: string): ReturnType<typeof parseEditorQuery> {
  const trimmed = previewQuery.trim();
  const fragment = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;

  if (fragment.startsWith("$")) {
    const parsed = parseEditorQuery(source.raw);
    const fragmentOptions = new URLSearchParams(fragment);
    fragmentOptions.forEach((value, key) => {
      parsed.queryOptions.set(key, value);
    });
    return parsed;
  }

  return parseEditorQuery(trimmed);
}

function isSameEntityPath(left: string, right: string): boolean {
  return normalizeValue(parseEditorQuery(left).entityPath) === normalizeValue(parseEditorQuery(right).entityPath);
}

function isPreviewAlreadyApplied(currentQuery: string, sourceQuery: string, updatedQuery: string): boolean {
  if (areQueriesEquivalent(currentQuery, updatedQuery)) {
    return true;
  }

  const source = parseEditorQuery(sourceQuery);
  const current = parseEditorQuery(currentQuery);
  const updated = parseEditorQuery(updatedQuery);

  if (normalizeValue(current.entityPath) !== normalizeValue(updated.entityPath)) {
    return false;
  }

  const changedKeys = getChangedQueryOptionKeys(source, updated);
  if (!changedKeys.length) {
    return false;
  }

  return changedKeys.every((key) => isQueryOptionAlreadyApplied(key, current.queryOptions.get(key), updated.queryOptions.get(key)));
}

function getChangedQueryOptionKeys(source: ReturnType<typeof parseEditorQuery>, updated: ReturnType<typeof parseEditorQuery>): string[] {
  const keys = new Set<string>();
  source.queryOptions.forEach((_value, key) => {
    keys.add(key);
  });
  updated.queryOptions.forEach((_value, key) => {
    keys.add(key);
  });

  return Array.from(keys).filter((key) => normalizeValue(source.queryOptions.get(key) ?? "") !== normalizeValue(updated.queryOptions.get(key) ?? ""));
}

function isQueryOptionAlreadyApplied(key: string, currentValue: string | null, updatedValue: string | null): boolean {
  if (updatedValue === null) {
    return true;
  }

  if (currentValue === null) {
    return false;
  }

  if (key === "$select") {
    const currentFields = splitCsv(currentValue);
    const updatedFields = splitCsv(updatedValue);
    return updatedFields.every((field) => currentFields.includes(field));
  }

  return normalizeValue(currentValue) === normalizeValue(updatedValue);
}

function areQueriesEquivalent(left: string, right: string): boolean {
  return normalizeQuery(left) === normalizeQuery(right);
}

function normalizeQuery(query: string): string {
  const parsed = parseEditorQuery(query);
  const pairs: Array<readonly [string, string]> = [];
  parsed.queryOptions.forEach((value, key) => {
    pairs.push([normalizeValue(key), normalizeValue(value)] as const);
  });
  pairs.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return `${normalizeValue(parsed.entityPath)}?${pairs.map(([key, value]) => `${key}=${value}`).join("&")}`;
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => normalizeValue(item))
    .filter((item) => item.length > 0);
}

export function registerApplyRecommendedNextStepFromExplainCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.applyRecommendedNextStepFromExplain", applyRecommendedNextStepFromExplain, ctx);
}
