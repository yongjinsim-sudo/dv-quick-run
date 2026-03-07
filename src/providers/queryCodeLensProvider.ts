import * as vscode from "vscode";

function looksLikeDataverseQuery(text: string): boolean {
  const line = text.trim();

  if (!line) {
    return false;
  }

  if (line.startsWith("//") || line.startsWith("#")) {
    return false;
  }

  const entityPattern = /^\/?[A-Za-z_][A-Za-z0-9_]*(\([^)]+\))?(\?.+)?$/;

  if (!entityPattern.test(line)) {
    return false;
  }

  if (line.includes("?$")) {
    return true;
  }

  if (/\([0-9a-fA-F-]{8,}\)/.test(line)) {
    return true;
  }

  if (/^\/?[A-Za-z_][A-Za-z0-9_]*$/.test(line) && line.length >= 4) {
    return true;
  }

  if (line.includes("?")) {
    return true;
  }

  return false;
}

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
      const text = line.text.trim();

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