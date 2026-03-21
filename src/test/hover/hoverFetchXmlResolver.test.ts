import * as assert from "assert";
import * as vscode from "vscode";
import { resolveFetchXmlHover } from "../../providers/hover/hoverFetchXmlResolver.js";
import { buildHoverFieldContext } from "../../providers/hoverFieldContextCache.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type { EntityDef } from "../../utils/entitySetCache.js";

function getHoverMarkdown(hover: vscode.Hover): string {
  const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
  return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

async function openDocument(text: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({
    content: text,
    language: "xml"
  });
}

function positionAt(text: string, needle: string, occurrence = 1): vscode.Position {
  let fromIndex = 0;
  let foundIndex = -1;

  for (let i = 0; i < occurrence; i++) {
    foundIndex = text.indexOf(needle, fromIndex);
    if (foundIndex < 0) {
      throw new Error(`Needle '${needle}' not found`);
    }

    fromIndex = foundIndex + needle.length;
  }

  const before = text.slice(0, foundIndex);
  const lines = before.split("\n");
  const line = lines.length - 1;
  const character = lines[lines.length - 1].length;

  return new vscode.Position(line, character);
}

suite("hoverFetchXmlResolver", () => {
  test("returns entity hover for fetchxml entity name", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "contact"),
      requestContext: {
        getEntityByLogicalName: async (_logicalName: string) =>
          ({
            logicalName: "contact",
            entitySetName: "contacts"
          }) as EntityDef
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Entity Set: `contact`**"));
    assert.ok(markdown.includes("Logical name: `contact`"));
    assert.ok(markdown.includes("Entity set: `contacts`"));
  });

  test("returns field hover for fetchxml attribute name", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const fields: FieldDef[] = [
      {
        logicalName: "fullname",
        attributeType: "String",
        isValidForRead: true
      } as FieldDef
    ];

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "fullname"),
      requestContext: {
        getFieldContext: async (_logicalName: string) => buildHoverFieldContext(fields)
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Field: `fullname`**"));
    assert.ok(markdown.includes("Type: `String`"));
  });

  test("returns undefined when hovered token is not the entity name value", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "entity"),
      requestContext: {
        getEntityByLogicalName: async (_logicalName: string) =>
          ({
            logicalName: "contact",
            entitySetName: "contacts"
          }) as EntityDef
      } as any
    });

    assert.strictEqual(hover, undefined);
  });

  test("returns undefined when hovered token is not the attribute name value", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "attribute"),
      requestContext: {
        getFieldContext: async (_logicalName: string) => buildHoverFieldContext([])
      } as any
    });

    assert.strictEqual(hover, undefined);
  });

  test("returns undefined when fetchxml attribute field is not found in metadata", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <attribute name="fullname" />`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "fullname"),
      requestContext: {
        getFieldContext: async (_logicalName: string) => buildHoverFieldContext([])
      } as any
    });

    assert.strictEqual(hover, undefined);
  });

  test("returns undefined when root entity cannot be resolved from fetchxml", async () => {
    const text = `<attribute name="fullname" />`;

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "fullname"),
      requestContext: {
        getFieldContext: async (_logicalName: string) => buildHoverFieldContext([])
      } as any
    });

    assert.strictEqual(hover, undefined);
  });
});