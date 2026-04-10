import * as vscode from "vscode";
import type { BatchExecutionResult } from "../../../../../services/batchExecution.js";

const BATCH_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-batch-preview.txt");
const BATCH_RESULT_URI = vscode.Uri.parse("untitled:dv-quick-run-batch-result.txt");

export async function openBatchPreviewDocument(queries: string[], batchRequestBody: string): Promise<void> {
  const content = [
    "DV Quick Run – Batch Preview",
    "============================",
    "",
    `Queries: ${queries.length}`,
    "Mode: Read-only GET batch",
    "",
    "Included queries:",
    ...queries.map((query, index) => `${index + 1}. ${query}`),
    "",
    "Generated $batch request:",
    batchRequestBody,
    "",
    "Use the confirmation dialog to execute this read-only batch.",
    "Dismissing the dialog leaves the editor and queries unchanged."
  ].join("\n");

  await openOrReuseTextDocument(BATCH_PREVIEW_URI, content, "plaintext");
}

export async function openBatchResultDocument(result: BatchExecutionResult): Promise<void> {
  const lines: string[] = [
    "DV Quick Run – Batch Results",
    "============================",
    "",
    `Requests: ${result.parts.length}`,
    `Succeeded: ${result.parts.filter((part) => part.statusCode > 0 && part.statusCode < 400).length}`,
    `Failed: ${result.parts.filter((part) => part.statusCode >= 400 || part.statusCode === 0).length}`,
    "",
    "Per-request summary:",
    ...result.parts.flatMap((part) => {
      const summary = summarizePart(part);
      return [
        `Request ${part.index + 1}: ${part.queryText}`,
        `  Status: ${part.statusCode} ${part.statusText}`,
        `  Result: ${summary}`,
        part.error ? `  Error: ${part.error}` : ""
      ].filter((line) => line.length > 0);
    }),
    "",
    "Use the Quick Pick shown after execution to inspect an individual result in the Result Viewer."
  ];

  await openOrReuseTextDocument(BATCH_RESULT_URI, lines.join("\n"), "plaintext");
}

function summarizePart(part: BatchExecutionResult["parts"][number]): string {
  if (part.resultType === "collection") {
    const value = part.payload && typeof part.payload === "object" && !Array.isArray(part.payload)
      ? (part.payload as Record<string, unknown>).value
      : undefined;
    return `${Array.isArray(value) ? value.length : 0} row(s)`;
  }

  if (part.resultType === "single") {
    return "Single record";
  }

  if (part.resultType === "empty") {
    return "No content";
  }

  if (part.resultType === "raw") {
    return "Raw response";
  }

  return "Error";
}

async function openOrReuseTextDocument(uri: vscode.Uri, content: string, language: string): Promise<vscode.TextEditor> {
  const existing = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
  const document = existing ?? await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    viewColumn: vscode.ViewColumn.Beside
  });

  await vscode.languages.setTextDocumentLanguage(document, language);

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  await editor.edit((builder: vscode.TextEditorEdit) => {
    if (document.getText().length === 0) {
      builder.insert(new vscode.Position(0, 0), content);
      return;
    }

    builder.replace(fullRange, content);
  });

  return editor;
}
