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

  const text = editor.document.getText(sourceRange).trim();
  if (!text) {
    throw new Error("The source query could not be resolved from the explain document state.");
  }

  return {
    editor,
    range: sourceRange,
    text,
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
    ? explainState.diagnostics.findings.find((item) => (item.suggestedQuery?.query ?? item.suggestedFix?.example)?.trim() === explicitPreviewQuery)
    : explainState.diagnostics.findings.find((item) => item.narrowingSuggestions?.length);

  if (!finding) {
    void vscode.window.showInformationMessage("DV Quick Run: No applicable preview is available for this explanation.");
    return;
  }

  const previewQuery = explicitPreviewQuery ?? finding.suggestedQuery?.query?.trim() ?? finding.suggestedFix?.example?.trim();
  if (!previewQuery) {
    void vscode.window.showInformationMessage("DV Quick Run: No preview query is available for this explanation.");
    return;
  }

  const target = await resolveSourceTarget(explainState.source.uri, explainState.source.range);
  let updatedQuery = previewQuery;

  if (previewQuery.startsWith("$filter=")) {
    const parsed = parseEditorQuery(target.text);
    parsed.queryOptions.set("$filter", previewQuery.slice("$filter=".length));
    updatedQuery = buildEditorQuery(parsed);
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
      },
      {
        label: "Preview query",
        value: updatedQuery
      }
    ]
  }, {
    mode: "apply",
    applyButtonLabel: "Apply Preview"
  });
}

export function registerApplyRecommendedNextStepFromExplainCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.applyRecommendedNextStepFromExplain", applyRecommendedNextStepFromExplain, ctx);
}
