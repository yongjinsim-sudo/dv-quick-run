import * as assert from "assert";
import * as vscode from "vscode";
import {
  findLogicalEditorQueryTargetBySourceTarget,
  type StoredEditorQuerySourceTarget
} from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

suite("editorQueryTarget - source target", () => {
  async function showDocument(text: string): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({
      content: text,
      language: "plaintext"
    });

    return await vscode.window.showTextDocument(doc);
  }

  test("rebuilds the original query target from stored document uri and range", async () => {
    const text = [
      "contacts?$select=fullname",
      "&$filter=statecode eq 0",
      "&$top=10"
    ].join("\n");

    const editor = await showDocument(text);
    const sourceTarget: StoredEditorQuerySourceTarget = {
      sourceDocumentUri: editor.document.uri.toString(),
      sourceRangeStartLine: 0,
      sourceRangeStartCharacter: 0,
      sourceRangeEndLine: 2,
      sourceRangeEndCharacter: editor.document.lineAt(2).text.length
    };

    const target = await findLogicalEditorQueryTargetBySourceTarget(sourceTarget);

    assert.strictEqual(target.text, text);
    assert.strictEqual(target.range.start.line, 0);
    assert.strictEqual(target.range.end.line, 2);
  });

  test("falls back to query-text lookup if stored range no longer matches", async () => {
    const text = [
      "contacts?$select=fullname",
      "&$filter=statecode eq 0",
      "&$top=10"
    ].join("\n");

    const editor = await showDocument(text);
    const sourceTarget: StoredEditorQuerySourceTarget = {
      sourceDocumentUri: editor.document.uri.toString(),
      sourceRangeStartLine: 0,
      sourceRangeStartCharacter: 0,
      sourceRangeEndLine: 0,
      sourceRangeEndCharacter: editor.document.lineAt(0).text.length
    };

    const target = await findLogicalEditorQueryTargetBySourceTarget(sourceTarget, text);

    assert.strictEqual(
      target.text,
      "contacts?$select=fullname&$filter=statecode eq 0&$top=10"
    );
    assert.strictEqual(target.range.start.line, 0);
    assert.strictEqual(target.range.end.line, 2);
  });
});
