import * as vscode from "vscode";
import { buildEditorQuery, parseEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { findLogicalEditorQueryTargetByText } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import type { EditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

import { previewAndApplyMutationResult, type MutationResult } from "./queryPreview.js";

export async function previewAndApplyAddTopInActiveEditor(value: number): Promise<void> {
  const target = resolveActiveLineTarget();
  const previewQuery = buildAddTopPreviewFromTarget(target, value);
  const result: MutationResult = {
    originalQuery: target.text,
    updatedQuery: previewQuery,
    summary: `Add $top=${value}`
  };

  await previewAndApplyMutationResult(target, result, {
    heading: `Add $top=${value}`
  });
}

function resolveActiveLineTarget(): EditorQueryTarget {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor.");
  }

  const selectionText = editor.document.getText(editor.selection).trim();
  if (selectionText) {
    return {
      editor,
      range: editor.selection,
      text: selectionText,
      source: "selection"
    };
  }

  const line = editor.document.lineAt(editor.selection.active.line);
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

export function buildAddTopPreviewFromTarget(
  target: { text?: string; queryText?: string },
  topValue: number
): string {
  const queryText = target.text ?? target.queryText;

  if (!queryText || !queryText.trim()) {
    throw new Error("Target query text is required.");
  }

  const parsed = parseEditorQuery(queryText);

  if (parsed.queryOptions.has("$top")) {
    throw new Error("Query already contains $top.");
  }

  const updated = new URLSearchParams(parsed.queryOptions.toString());
  updated.set("$top", String(topValue));
  parsed.queryOptions = updated;

  return buildEditorQuery(parsed);
}

export async function previewAndApplyAddTopForQueryInEditor(queryText: string, value: number): Promise<void> {
  const target = findLogicalEditorQueryTargetByText(queryText);
  const previewQuery = buildAddTopPreviewFromTarget(target, value);
  const result: MutationResult = {
    originalQuery: target.text,
    updatedQuery: previewQuery,
    summary: `Add $top=${value}`
  };

  await previewAndApplyMutationResult(target, result, {
    heading: `Add $top=${value}`
  });
}
