import * as assert from "assert";
import * as vscode from "vscode";
import { getLogicalEditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

suite("editorQueryTarget - fetchxml", () => {
  async function showDocument(text: string): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({
      content: text,
      language: "xml"
    });

    return await vscode.window.showTextDocument(doc);
  }

  test("extracts full fetchxml block when cursor is on fetch start line", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const editor = await showDocument(text);
    editor.selection = new vscode.Selection(0, 0, 0, 0);

    const target = getLogicalEditorQueryTarget();

    assert.strictEqual(target.text, text);
    assert.strictEqual(target.range.start.line, 0);
    assert.strictEqual(target.range.end.line, 4);
    assert.strictEqual(target.source, "line");
  });

  test("cursor inside fetchxml body does not auto-expand block", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const editor = await showDocument(text);
    editor.selection = new vscode.Selection(2, 4, 2, 4);

    const target = getLogicalEditorQueryTarget();

    assert.strictEqual(target.text, `<attribute name="fullname" />`);
    assert.strictEqual(target.range.start.line, 2);
    assert.strictEqual(target.range.end.line, 2);
  });

  test("selection still wins over automatic fetchxml block extraction", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const editor = await showDocument(text);
    editor.selection = new vscode.Selection(1, 2, 2, 34);

    const target = getLogicalEditorQueryTarget();

    assert.strictEqual(
      target.text,
      [
        `<entity name="contact">`,
        `    <attribute name="fullname" />`
      ].join("\n")
    );
    assert.strictEqual(target.source, "selection");
  });

  test("fetchxml extraction stops at closing fetch tag", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`,
      ``,
      `contacts?$top=5`
    ].join("\n");

    const editor = await showDocument(text);
    editor.selection = new vscode.Selection(0, 0, 0, 0);

    const target = getLogicalEditorQueryTarget();

    assert.strictEqual(
      target.text,
      [
        `<fetch top="5">`,
        `  <entity name="contact">`,
        `    <attribute name="fullname" />`,
        `  </entity>`,
        `</fetch>`
      ].join("\n")
    );
    assert.strictEqual(target.range.end.line, 4);
  });
});