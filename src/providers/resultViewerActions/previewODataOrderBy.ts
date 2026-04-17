import * as vscode from "vscode";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { applyEditorQueryUpdate } from "../../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export interface ODataOrderByPreviewResult {
  originalQuery: string;
  proposedClause: string;
  previewQuery: string;
  target: EditorQueryTarget;
}

export async function previewAndApplyRootODataOrderBy(columnName: string, direction: "asc" | "desc" = "asc"): Promise<void> {
  const resolved = resolveBestODataEditorTarget();
  if (!resolved) {
    throw new Error("Filter by this value requires a visible OData query in the editor.");
  }

  const preview = buildODataOrderByPreviewFromTarget(resolved.target, columnName, direction);

  await openOrReuseQueryPreviewDocument(buildPreviewDocumentContent(preview));

  const choice = await vscode.window.showWarningMessage(
    "DV Quick Run: Preview is ready. Apply it to the detected query?",
    { modal: true },
    "Apply Preview"
  );

  if (choice !== "Apply Preview") {
    void vscode.window.showInformationMessage("DV Quick Run: Preview cancelled. The detected query was not changed.");
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

async function openOrReuseQueryPreviewDocument(content: string): Promise<void> {
  const existing = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === QUERY_PREVIEW_URI.toString());
  const document = existing ?? await vscode.workspace.openTextDocument(QUERY_PREVIEW_URI);
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: true,
    preview: false
  });

  await editor.edit((editBuilder) => {
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    editBuilder.replace(fullRange, content);
  });
}

function buildPreviewDocumentContent(preview: ODataOrderByPreviewResult): string {
  return [
    "DV Quick Run - Query Preview",
    "============================",
    "",
    "Preview Root OData Order By",
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
