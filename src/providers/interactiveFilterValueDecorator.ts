import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import { getEntitySetNameFromEditorQuery, parseEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { detectQueryKind, looksLikeDataverseQuery } from "../shared/editorIntelligence/queryDetection.js";
import { buildChoiceRefinementOptions } from "../refinement/filterValueReplacement.js";
import { isChoiceAttributeType } from "../metadata/metadataModel.js";
import { HoverRequestContext } from "./hover/hoverRequestContext.js";
import { findChoiceMetadataForField, parseSimpleFilterComparisonsWithRanges } from "./hover/hoverFilterAnalysis.js";
import { normalizeWord } from "./hover/hoverCommon.js";

export class InteractiveFilterValueDecorator implements vscode.Disposable {
  private readonly requestContext: HoverRequestContext;
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor(ctx: CommandContext) {
    this.requestContext = new HoverRequestContext(ctx);
    this.decorationType = vscode.window.createTextEditorDecorationType({
      textDecoration: "underline dotted",
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      cursor: "help"
    });
  }

  async refresh(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor || !this.isSupportedEditor(editor)) {
      this.clearAllVisibleEditors();
      return;
    }

    try {
      const decorations = await this.computeDecorations(editor.document);
      editor.setDecorations(this.decorationType, decorations);
    } catch {
      editor.setDecorations(this.decorationType, []);
    }
  }

  dispose(): void {
    this.decorationType.dispose();
  }

  private isSupportedEditor(editor: vscode.TextEditor): boolean {
    const { document } = editor;
    if (document.uri.scheme !== "file" && document.uri.scheme !== "untitled") {
      return false;
    }

    return detectQueryKind(document.getText()) !== "fetchxml";
  }

  private clearAllVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  private async computeDecorations(document: vscode.TextDocument): Promise<vscode.DecorationOptions[]> {
    const decorations: vscode.DecorationOptions[] = [];

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber);
      const trimmed = line.text.trim();
      if (!trimmed || !looksLikeDataverseQuery(trimmed)) {
        continue;
      }

      const parsed = parseEditorQuery(trimmed);
      const filterValue = parsed.queryOptions.get("$filter");
      if (!filterValue) {
        continue;
      }

      const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
      if (!entitySetName) {
        continue;
      }

      const entity = await this.requestContext.getEntityByEntitySetName(entitySetName);
      if (!entity) {
        continue;
      }

      const fieldContext = await this.requestContext.getFieldContext(entity.logicalName);
      const allChoiceMetadata = await this.requestContext.getChoiceMetadata(entity.logicalName);

      const filterOffsetInTrimmed = trimmed.indexOf("$filter=");
      if (filterOffsetInTrimmed < 0) {
        continue;
      }

      const queryStartOffset = line.text.indexOf(trimmed);
      const filterValueOffsetInLine = queryStartOffset + filterOffsetInTrimmed + "$filter=".length;

      for (const comparison of parseSimpleFilterComparisonsWithRanges(filterValue)) {
        const field = fieldContext.fieldByLogicalName.get(normalizeWord(comparison.fieldLogicalName));
        if (!field || !isChoiceAttributeType(field.attributeType)) {
          continue;
        }

        const choiceMetadata = findChoiceMetadataForField(allChoiceMetadata, field.logicalName);
        if (!choiceMetadata) {
          continue;
        }

        const refinementOptions = buildChoiceRefinementOptions({
          parsed,
          hoveredWord: comparison.rawValue,
          fieldLogicalName: field.logicalName,
          options: choiceMetadata.options,
          documentUri: document.uri,
          lineNumber
        });

        if (!refinementOptions || refinementOptions.length === 0) {
          continue;
        }

        const start = filterValueOffsetInLine + comparison.rawValueStart;
        const end = filterValueOffsetInLine + comparison.rawValueEnd;

        decorations.push({
          range: new vscode.Range(lineNumber, start, lineNumber, end),
          hoverMessage: new vscode.MarkdownString("Interactive filter value — hover to refine.")
        });
      }
    }

    return decorations;
  }
}
