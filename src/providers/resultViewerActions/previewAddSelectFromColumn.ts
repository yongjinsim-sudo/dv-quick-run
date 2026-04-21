import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { previewAndApplyMutationResult, type MutationResult } from "../../refinement/queryPreview.js";
import { buildAddSelectPreviewForScope } from "../../refinement/addSelectPreview.js";

export interface AddSelectFromColumnPreviewResult {
  originalQuery: string;
  previewQuery: string;
  relationshipPath: string[];
  selectToken: string;
  target: EditorQueryTarget;
  wasAlreadySelected: boolean;
}

export async function previewAndApplyAddSelectFromColumn(columnName: string): Promise<void> {
  const resolved = resolveBestODataEditorTarget();
  if (!resolved) {
    throw new Error("Add this column to $select requires a visible OData query in the editor.");
  }

  const preview = buildAddSelectPreviewFromColumnTarget(resolved.target, columnName);
  if (preview.wasAlreadySelected) {
    void vscode.window.showInformationMessage(`DV Quick Run: '${preview.selectToken}' is already present in $select.`);
    return;
  }

  const result: MutationResult = {
    originalQuery: preview.originalQuery,
    updatedQuery: preview.previewQuery,
    summary: preview.relationshipPath.length
      ? `Add $select=${preview.selectToken} to ${preview.relationshipPath.join(" -> ")}`
      : `Add $select=${preview.selectToken}`
  };

  await previewAndApplyMutationResult(preview.target, result, {
    heading: result.summary ?? "Preview Add Select"
  });
}

export function buildAddSelectPreviewFromColumnTarget(
  target: EditorQueryTarget,
  columnName: string
): AddSelectFromColumnPreviewResult {
  const rawText = extractODataQueryText(target.text);
  if (!rawText || rawText.startsWith("<")) {
    throw new Error("Add this column to $select requires a visible OData query in the editor.");
  }

  const pathSegments = columnName.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (!pathSegments.length) {
    throw new Error("A Result Viewer column is required.");
  }

  const selectToken = pathSegments[pathSegments.length - 1] ?? "";
  const relationshipPath = pathSegments.slice(0, -1);
  if (!selectToken) {
    throw new Error("Could not determine a valid $select token from the chosen column.");
  }

  const previewQuery = buildAddSelectPreviewForScope(rawText, [selectToken], relationshipPath);
  return {
    originalQuery: rawText,
    previewQuery,
    relationshipPath,
    selectToken,
    target: { ...target, text: rawText },
    wasAlreadySelected: previewQuery === rawText
  };
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

    return { target };
  } catch {
    return undefined;
  }
}

function resolveBestODataEditorTarget() {
  const candidates = [
    vscode.window.activeTextEditor,
    ...vscode.window.visibleTextEditors
  ];

  for (const editor of candidates) {
    const resolved = tryResolveODataTargetFromEditor(editor);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function extractODataQueryText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^Run Query\s*\|\s*Explain\s*/i, "").trim();
}
