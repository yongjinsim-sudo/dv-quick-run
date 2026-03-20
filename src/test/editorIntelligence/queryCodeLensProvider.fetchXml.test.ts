import * as assert from "assert";
import * as vscode from "vscode";
import { QueryCodeLensProvider } from "../../providers/queryCodeLensProvider.js";

suite("queryCodeLensProvider - fetchxml", () => {
  async function getTitles(text: string, language = "xml"): Promise<string[]> {
    const doc = await vscode.workspace.openTextDocument({
      content: text,
      language
    });

    const provider = new QueryCodeLensProvider();
    const tokenSource = new vscode.CancellationTokenSource();
    const lenses = await provider.provideCodeLenses(doc, tokenSource.token);

    return (lenses ?? []).map((lens) => lens.command?.title ?? "");
  }

  test("fetchxml shows Run FetchXML only", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const titles = await getTitles(text, "xml");

    assert.ok(titles.includes("Run FetchXML"));
    assert.ok(!titles.includes("Run Query"));
    assert.ok(!titles.includes("Explain"));
  });

  test("odata still shows Run Query and Explain", async () => {
    const titles = await getTitles(`contacts?$select=fullname&$top=5`, "plaintext");

    assert.ok(titles.includes("Run Query"));
    assert.ok(titles.includes("Explain"));
  });
});