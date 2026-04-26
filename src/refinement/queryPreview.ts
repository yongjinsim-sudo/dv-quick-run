import * as vscode from "vscode";
import { applyEditorQueryUpdate } from "../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import type { EditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { createPreviewAction, showPreviewSurface } from "../services/previewSurfaceService.js";

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.md");

export interface MutationResult {
  originalQuery: string;
  updatedQuery: string;
  summary?: string;
}

export interface MutationPreviewDetails {
  heading: string;
  title?: string;
  summary?: string;
  sections?: Array<{ label: string; value: string }>;
}

export type MutationPreviewMode = "apply" | "copy" | "applyOrCopy";

export interface MutationPreviewFlowOptions {
  mode?: MutationPreviewMode;
  applyButtonLabel?: string;
  copyButtonLabel?: string;
  cancelledMessage?: string;
}

export interface MutationPreviewOutcome {
  outcome: "applied" | "copied" | "cancelled";
}

export async function previewMutationResult(
  target: EditorQueryTarget,
  result: MutationResult,
  details: MutationPreviewDetails,
  flowOptions?: MutationPreviewFlowOptions
): Promise<MutationPreviewOutcome> {
  const mode = flowOptions?.mode ?? "apply";
  const applyButtonLabel = flowOptions?.applyButtonLabel ?? "Apply Preview";
  const copyButtonLabel = flowOptions?.copyButtonLabel ?? "Copy Preview";
  const secondaryActions = mode === "copy"
    ? [createPreviewAction({ id: "copy", label: copyButtonLabel, kind: "copy" })]
    : mode === "applyOrCopy"
      ? [createPreviewAction({ id: "copy", label: copyButtonLabel, kind: "copy" })]
      : [];
  const primaryAction = mode === "copy"
    ? undefined
    : createPreviewAction({ id: "apply", label: applyButtonLabel, kind: "apply" });

  const previewResult = await showPreviewSurface({
    kind: "query",
    title: details.title ?? "DV Quick Run – Query Preview",
    source: "editor",
    sourceAction: details.heading,
    summary: details.summary ?? result.summary,
    sections: buildMutationPreviewSections(result, details),
    primaryAction,
    secondaryActions: [
      ...secondaryActions,
      createPreviewAction({ id: "cancel", label: "Cancel", kind: "cancel" })
    ]
  });

  if (previewResult.actionKind === "apply") {
    await applyEditorQueryUpdate(target, result.updatedQuery);

    const visibleEditor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === target.editor.document.uri.toString()
    );

    if (visibleEditor) {
      await vscode.window.showTextDocument(visibleEditor.document, {
        viewColumn: visibleEditor.viewColumn,
        preserveFocus: false,
        preview: false
      });
    }

    void vscode.window.showInformationMessage("DV Quick Run: Preview applied to query.");
    return { outcome: "applied" };
  }

  if (previewResult.actionKind === "copy") {
    await copyMutationResultToClipboard(result);
    void vscode.window.showInformationMessage("DV Quick Run: Preview query copied to clipboard.");
    return { outcome: "copied" };
  }

  void vscode.window.showInformationMessage(flowOptions?.cancelledMessage ?? "DV Quick Run: Preview cancelled. The detected query was not changed.");
  return { outcome: "cancelled" };
}

export async function previewAndApplyMutationResult(
  target: EditorQueryTarget,
  result: MutationResult,
  details: MutationPreviewDetails
): Promise<boolean> {
  const previewOutcome = await previewMutationResult(target, result, details, { mode: "apply" });
  return previewOutcome.outcome === "applied";
}

export async function previewAndCopyMutationResult(
  target: EditorQueryTarget,
  result: MutationResult,
  details: MutationPreviewDetails
): Promise<boolean> {
  const previewOutcome = await previewMutationResult(target, result, details, { mode: "copy" });
  return previewOutcome.outcome === "copied";
}

export async function copyMutationResultToClipboard(result: MutationResult): Promise<void> {
  await vscode.env.clipboard.writeText(result.updatedQuery);
}

export async function openOrReuseQueryPreviewDocument(content: string): Promise<vscode.TextEditor> {
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

export async function openOrReuseRenderedMarkdownPreviewDocument(content: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(QUERY_PREVIEW_URI);

  if (document.languageId !== "markdown") {
    await vscode.languages.setTextDocumentLanguage(document, "markdown");
  }

  const fullText = document.getText();
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));
  const workspaceEdit = new vscode.WorkspaceEdit();

  if (fullText.length === 0) {
    workspaceEdit.insert(document.uri, new vscode.Position(0, 0), content);
  } else {
    workspaceEdit.replace(document.uri, fullRange, content);
  }

  const applied = await vscode.workspace.applyEdit(workspaceEdit);
  if (!applied) {
    throw new Error("Failed to update preview document.");
  }

  await vscode.commands.executeCommand("markdown.showPreviewToSide", document.uri);

  return document;
}

export function buildMutationPreviewDocumentContent(
  result: MutationResult,
  details: MutationPreviewDetails,
  flowOptions?: MutationPreviewFlowOptions
): string {
  const lines: string[] = [
    "DV Quick Run – Query Preview",
    "============================",
    "",
    details.heading,
    ""
  ];

  if (details.title) {
    lines.push(details.title, "");
  }

  if (details.summary ?? result.summary) {
    lines.push(`Summary: ${details.summary ?? result.summary ?? ""}`, "");
  }

  lines.push("Original query:", result.originalQuery, "");

  for (const section of details.sections ?? []) {
    lines.push(`${section.label}:`, section.value, "");
  }

  lines.push("Preview query:", result.updatedQuery, "");

  const mode = flowOptions?.mode ?? "apply";
  if (mode === "copy") {
    lines.push(
      "Use the confirmation dialog to copy this preview query to the clipboard.",
      "Dismissing the dialog leaves the detected query unchanged."
    );
  } else if (mode === "applyOrCopy") {
    lines.push(
      "Use the confirmation dialog to apply this preview or copy the preview query.",
      "Dismissing the dialog leaves the detected query unchanged."
    );
  } else {
    lines.push(
      "Use the confirmation dialog to apply this preview.",
      "Dismissing the dialog leaves the detected query unchanged."
    );
  }

  return lines.join("\n");
}

function buildMutationPreviewSections(
  result: MutationResult,
  details: MutationPreviewDetails
): Array<{ title: string; content: string; language?: "text" }> {
  return [
    { title: "Original query", content: result.originalQuery, language: "text" },
    ...(details.sections ?? []).map((section) => ({
      title: section.label,
      content: section.value,
      language: "text" as const
    })),
    { title: "Preview query", content: result.updatedQuery, language: "text" }
  ];
}
