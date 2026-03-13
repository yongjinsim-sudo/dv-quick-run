import * as vscode from "vscode";

export function isInlineHoverEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<boolean>("enableInlineMetadataHover", true);
}

export function getHoverWordRange(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | undefined {
  const line = document.lineAt(position.line).text;

  const isTokenChar = (ch: string): boolean => /[$A-Za-z0-9_]/.test(ch);

  let start = position.character;
  let end = position.character;

  while (start > 0 && isTokenChar(line[start - 1])) {
    start--;
  }

  while (end < line.length && isTokenChar(line[end])) {
    end++;
  }

  if (start === end) {
    return undefined;
  }

  return new vscode.Range(
    new vscode.Position(position.line, start),
    new vscode.Position(position.line, end)
  );
}

export function normalizeWord(text: string): string {
  return text.trim().toLowerCase();
}

export function isScalarValueToken(text: string): boolean {
  const t = text.trim();

  if (!t) {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return true;
  }

  const lowered = t.toLowerCase();
  return lowered === "true" || lowered === "false";
}

export function normalizeScalarToken(text: string): string {
  return text.trim().toLowerCase();
}

export function isHoverCancelled(token: vscode.CancellationToken): boolean {
  return token.isCancellationRequested;
}
