import * as vscode from "vscode";

export type EditorQuerySource = "selection" | "line";

export interface EditorQueryTarget {
  editor: vscode.TextEditor;
  range: vscode.Range;
  text: string;
  source: EditorQuerySource;
}

function normalizeLine(text: string): string {
  return text.trim();
}

function isContinuationLine(text: string): boolean {
  return normalizeLine(text).startsWith("&");
}

function looksLikeDataverseRootLine(text: string): boolean {
  const line = normalizeLine(text);
  if (!line) {
    return false;
  }

  return /^\/?[A-Za-z_][A-Za-z0-9_]*([(][^)]*[)])?([?].*)?$/.test(line);
}

function buildLogicalQueryFromLines(lines: string[]): string {
  return lines
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .join("");
}

export function getEditorQueryTarget(): EditorQueryTarget {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor.");
  }

  const selectedText = editor.document.getText(editor.selection);
  if (selectedText.trim()) {
    return {
      editor,
      range: editor.selection,
      text: selectedText.trim(),
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

export function getLogicalEditorQueryTarget(): EditorQueryTarget {
  const target = getEditorQueryTarget();

  if (target.source === "selection") {
    return target;
  }

  const { editor } = target;
  const document = editor.document;
  const currentLine = editor.selection.active.line;
  const currentLineText = document.lineAt(currentLine).text;

  if (looksLikeFetchXmlStartLine(currentLineText)) {
      const lines: string[] = [currentLineText];
      let endLine = currentLine;

      for (let lineNumber = currentLine + 1; lineNumber < document.lineCount; lineNumber++) {
          const lineText = document.lineAt(lineNumber).text;
          lines.push(lineText);
          endLine = lineNumber;

          if (looksLikeFetchXmlEndLine(lineText)) {
              break;
          }
      }

      return {
          editor,
          range: new vscode.Range(
              document.lineAt(currentLine).range.start,
              document.lineAt(endLine).range.end
          ),
          text: lines.join("\n").trim(),
          source: "line"
      };
  }

  if (!normalizeLine(currentLineText)) {
    throw new Error("Current line is empty.");
  }

  let startLine = currentLine;

  if (isContinuationLine(currentLineText)) {
    let probe = currentLine - 1;

    while (probe >= 0) {
      const probeText = normalizeLine(document.lineAt(probe).text);
      if (!probeText) {
        break;
      }

      if (looksLikeDataverseRootLine(probeText)) {
        startLine = probe;
        break;
      }

      if (!isContinuationLine(probeText)) {
        break;
      }

      probe--;
    }
  } else if (!looksLikeDataverseRootLine(currentLineText)) {
    return target;
  }

  const startText = normalizeLine(document.lineAt(startLine).text);
  if (!looksLikeDataverseRootLine(startText)) {
    return target;
  }

  const lines: string[] = [startText];
  let endLine = startLine;

  for (let lineNumber = startLine + 1; lineNumber < document.lineCount; lineNumber++) {
    const lineText = normalizeLine(document.lineAt(lineNumber).text);
    if (!lineText) {
      break;
    }

    if (!isContinuationLine(lineText)) {
      break;
    }

    lines.push(lineText);
    endLine = lineNumber;
  }

  const range = new vscode.Range(
    document.lineAt(startLine).range.start,
    document.lineAt(endLine).range.end
  );

  return {
    editor,
    range,
    text: buildLogicalQueryFromLines(lines),
    source: "line"
  };
}

function looksLikeFetchXmlStartLine(text: string): boolean {
    const line = text.trim();

    if (!line) {
        return false;
    }

    if (line.startsWith("<?xml")) {
        return /<fetch[\s>]/i.test(line);
    }

    return /^<fetch[\s>]/i.test(line);
}

function looksLikeFetchXmlEndLine(text: string): boolean {
    return /<\/fetch\s*>/i.test(text.trim());
}