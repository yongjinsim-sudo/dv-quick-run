import * as vscode from "vscode";
import { buildEditorQuery, parseEditorQuery } from "./parsedEditorQuery.js";

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


function canonicalizeQueryTextForMatch(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  if (looksLikeFetchXmlStartLine(trimmed) || /^<fetch[\s>]/i.test(trimmed) || trimmed.startsWith("<?xml")) {
    return trimmed;
  }

  try {
    const parsed = parseEditorQuery(trimmed);
    const entries = Array.from(parsed.queryOptions.entries())
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .sort((left, right) => {
        const keyCompare = left[0].localeCompare(right[0]);
        return keyCompare !== 0 ? keyCompare : left[1].localeCompare(right[1]);
      });

    parsed.leadingSlash = false;
    parsed.queryOptions = new URLSearchParams();
    for (const [key, value] of entries) {
      parsed.queryOptions.append(key, value);
    }

    return buildEditorQuery(parsed).trim();
  } catch {
    return trimmed.replace(/^\/+/, "");
  }
}

function queryTextsMatch(left: string, right: string): boolean {
  return canonicalizeQueryTextForMatch(left) === canonicalizeQueryTextForMatch(right);
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


export function findLogicalEditorQueryTargetByText(queryText: string): EditorQueryTarget {
  const targetText = queryText.trim();
  if (!targetText) {
    throw new Error("Target query text is required.");
  }

  const editorsToSearch = buildEditorsToSearch();

  for (const editor of editorsToSearch) {
    const selectedText = editor.document.getText(editor.selection).trim();
    if (selectedText && queryTextsMatch(selectedText, targetText)) {
      return {
        editor,
        range: editor.selection,
        text: selectedText,
        source: "selection"
      };
    }

    const document = editor.document;

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
    const lineText = document.lineAt(lineNumber).text;
    const trimmed = normalizeLine(lineText);
    if (!trimmed) {
      continue;
    }

    if (looksLikeFetchXmlStartLine(lineText)) {
      const lines: string[] = [lineText];
      let endLine = lineNumber;

      for (let probe = lineNumber + 1; probe < document.lineCount; probe++) {
        const probeText = document.lineAt(probe).text;
        lines.push(probeText);
        endLine = probe;

        if (looksLikeFetchXmlEndLine(probeText)) {
          break;
        }
      }

      const candidateText = lines.join("\n").trim();
      if (queryTextsMatch(candidateText, targetText)) {
        return {
          editor,
          range: new vscode.Range(document.lineAt(lineNumber).range.start, document.lineAt(endLine).range.end),
          text: candidateText,
          source: "line"
        };
      }

      lineNumber = endLine;
      continue;
    }

    if (!looksLikeDataverseRootLine(trimmed)) {
      if (queryTextsMatch(trimmed, targetText)) {
        return {
          editor,
          range: document.lineAt(lineNumber).range,
          text: trimmed,
          source: "line"
        };
      }
      continue;
    }

    const lines: string[] = [trimmed];
    let endLine = lineNumber;

    for (let probe = lineNumber + 1; probe < document.lineCount; probe++) {
      const probeText = normalizeLine(document.lineAt(probe).text);
      if (!probeText || !isContinuationLine(probeText)) {
        break;
      }
      lines.push(probeText);
      endLine = probe;
    }

    const candidateText = buildLogicalQueryFromLines(lines);
    if (queryTextsMatch(candidateText, targetText)) {
      return {
        editor,
        range: new vscode.Range(document.lineAt(lineNumber).range.start, document.lineAt(endLine).range.end),
        text: candidateText,
        source: "line"
      };
    }

      lineNumber = endLine;
    }
  }

  throw new Error("Could not find the executed query in an open editor.");
}

function buildEditorsToSearch(): vscode.TextEditor[] {
  const editors = new Map<string, vscode.TextEditor>();

  for (const editor of vscode.window.visibleTextEditors) {
    editors.set(editor.document.uri.toString(), editor);
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    editors.set(activeEditor.document.uri.toString(), activeEditor);
  }

  for (const document of vscode.workspace.textDocuments) {
    const key = document.uri.toString();
    if (editors.has(key)) {
      continue;
    }

    if (document.isClosed || document.uri.scheme === "output" || document.uri.scheme === "vscode") {
      continue;
    }

    const editor = createDetachedEditorTarget(document);
    if (editor) {
      editors.set(key, editor);
    }
  }

  return Array.from(editors.values());
}

function createDetachedEditorTarget(document: vscode.TextDocument): vscode.TextEditor | undefined {
  const visibleEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === document.uri.toString());
  if (visibleEditor) {
    return visibleEditor;
  }

  const selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
  return {
    document,
    selection,
    selections: [selection],
    visibleRanges: [],
    options: {},
    viewColumn: undefined,
    edit: async () => false,
    insertSnippet: async () => false,
    setDecorations: () => {},
    revealRange: () => {},
    show: async () => {}
  } as unknown as vscode.TextEditor;
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