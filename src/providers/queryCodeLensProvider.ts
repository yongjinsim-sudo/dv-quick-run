import * as vscode from "vscode";
import { looksLikeDataverseQuery } from "../shared/editorIntelligence/queryDetection.js";

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

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber);
      const raw = line.text;
      const text = raw.trim();

      if (!text.includes("?") && !text.includes("(") && text.length < 4) {
        continue;
      }

      if (!looksLikeDataverseQuery(text)) {
        continue;
      }

      const range = new vscode.Range(lineNumber, 0, lineNumber, line.text.length);

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