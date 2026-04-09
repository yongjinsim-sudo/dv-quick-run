import * as vscode from "vscode";
import { canApplyQueryDoctorFix } from "../product/capabilities/capabilityResolver.js";
import { getExplainDocumentState } from "../commands/router/actions/explain/explainDocState.js";
import { looksLikeDataverseQuery , detectQueryKind } from "../shared/editorIntelligence/queryDetection.js";

function isCodeLensEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<boolean>("enableCodeLens", true);
}

export class QueryCodeLensProvider implements vscode.CodeLensProvider {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeEmitter.event;

  refresh(): void {
    this.onDidChangeEmitter.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    if (!isCodeLensEnabled()) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    if (document.languageId === "markdown") {
      if (!canApplyQueryDoctorFix()) {
        return [];
      }

      const explainState = getExplainDocumentState(document.uri);
      if (!explainState) {
        return [];
      }

      let inActionableGroup = false;

      for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
        const line = document.lineAt(lineNumber);
        const trimmed = line.text.trim();

        if (trimmed.startsWith("### ")) {
          inActionableGroup = trimmed === "### ⭐ Recommended next step" || trimmed.startsWith("### Advisory:");
          continue;
        }

        if (!inActionableGroup) {
          continue;
        }

        if (trimmed.startsWith("- Preview query:")) {
          lenses.push(
            new vscode.CodeLens(line.range, {
              title: "Apply preview",
              tooltip: "Preview and apply this suggested change to the source query",
              command: "dvQuickRun.applyRecommendedNextStepFromExplain",
              arguments: [document.uri, lineNumber]
            })
          );
        }
      }

      return lenses;
    }

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber);
      const raw = line.text;
      const text = raw.trim();

      const looksPotentiallyInteresting =
        text.includes("?") ||
        text.includes("(") ||
        text.startsWith("<") ||
        text.length >= 4;

      if (!looksPotentiallyInteresting) {
        continue;
      }

      if (!looksLikeDataverseQuery(text)) {
        continue;
      }

      const range = new vscode.Range(lineNumber, 0, lineNumber, line.text.length);

      const kind = detectQueryKind(text);

      if (kind === "fetchxml") {
        lenses.push(
          new vscode.CodeLens(range, {
            title: "Run FetchXML",
            tooltip: "Run this FetchXML query",
            command: "dvQuickRun.runQueryAtLine",
            arguments: [document.uri, lineNumber]
          })
        );

        lenses.push(
          new vscode.CodeLens(range, {
            title: "Explain",
            tooltip: "Explain this FetchXML query",
            command: "dvQuickRun.explainQueryAtLine",
            arguments: [document.uri, lineNumber]
          })
        );

        continue;
      }

      lenses.push(
          new vscode.CodeLens(range, {
              title: "Run Query",
              tooltip: "Run this Dataverse query",
              command: "dvQuickRun.runQueryAtLine",
              arguments: [document.uri, lineNumber]
          })
      );

      lenses.push(
          new vscode.CodeLens(range, {
              title: "Explain",
              tooltip: "Explain this Dataverse query",
              command: "dvQuickRun.explainQueryAtLine",
              arguments: [document.uri, lineNumber]
          })
      );

    }

    return lenses;
  }
}