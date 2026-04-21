import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { previewAndApplyMutationResult, type MutationResult } from "../../refinement/queryPreview.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";

export interface ODataOrderByPreviewResult {
  originalQuery: string;
  proposedClause: string;
  previewQuery: string;
  target: EditorQueryTarget;
}

export async function previewAndApplyRootODataOrderBy(columnName: string, direction: "asc" | "desc" = "asc"): Promise<void> {
  const resolved = resolveBestODataEditorTarget();
  if (!resolved) {
    throw new Error("Root OData order by requires a visible OData query in the editor.");
  }

  const preview = buildODataOrderByPreviewFromTarget(resolved.target, columnName, direction);
  const result: MutationResult = {
    originalQuery: preview.originalQuery,
    updatedQuery: preview.previewQuery
  };

  await previewAndApplyMutationResult(preview.target, result, {
    heading: "Preview Root OData Order By",
    sections: [
      {
        label: "Proposed clause",
        value: preview.proposedClause
      }
    ]
  });
}

export function buildODataOrderByPreviewFromTarget(
  target: EditorQueryTarget,
  columnName: string,
  direction: "asc" | "desc" = "asc"
): ODataOrderByPreviewResult {
  const rawText = extractODataQueryText(target.text);

  if (!rawText || rawText.startsWith("<")) {
    throw new Error("Preview OData order by requires a visible OData query in the editor.");
  }

  const parsed = parseEditorQuery(rawText);
  if (!parsed.entityPath) {
    throw new Error("Could not resolve an OData query target from the editor.");
  }

  const proposedClause = `${columnName} ${direction}`;
  parsed.queryOptions.delete("$orderby");
  parsed.queryOptions.set("$orderby", proposedClause);

  return {
    originalQuery: rawText,
    proposedClause,
    previewQuery: buildEditorQuery(parsed),
    target: { ...target, text: rawText }
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

    const parsed = parseEditorQuery(rawText);
    if (!parsed.entityPath) {
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
