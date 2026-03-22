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

  test("returns operator hover for fetchxml condition operator", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <filter>`,
      `      <condition attribute="fullname" operator="like" value="%john%" />`,
      `    </filter>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "like"),
      requestContext: {} as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Like**"));
    assert.ok(markdown.includes("`like`"));
    assert.ok(markdown.includes("Matches text using wildcard patterns."));
    assert.ok(markdown.includes("**Value**"));
    assert.ok(markdown.includes("`single`"));
    assert.ok(markdown.includes("**Applies to**"));
    assert.ok(markdown.includes("`condition`"));
  });

  test("returns undefined when hovered token is not the operator value", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <filter>`,
      `      <condition attribute="fullname" operator="like" value="%john%" />`,
      `    </filter>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "operator"),
      requestContext: {} as any
    });

    assert.strictEqual(hover, undefined);
  });

  test("returns hover for null operator with no-value contract", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <filter>`,
      `      <condition attribute="emailaddress1" operator="null" />`,
      `    </filter>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "null"),
      requestContext: {} as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Is Null**"));
    assert.ok(markdown.includes("`null`"));
    assert.ok(markdown.includes("**Value**"));
    assert.ok(markdown.includes("`none`"));
  });

  test("returns field hover for root fetchxml condition attribute", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <filter>`,
      `      <condition attribute="fullname" operator="like" value="%john%" />`,
      `    </filter>`,
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

  test("returns field hover for link-entity attribute name", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <attribute name="name" />`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `      <attribute name="name" />`;
    const lineOffset = text.indexOf(targetLine);
    const nameOffsetInLine = targetLine.indexOf(`"name"`) + 1;
    const absoluteOffset = lineOffset + nameOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {
        getFieldContext: async (logicalName: string) => {
          if (logicalName === "account") {
            return buildHoverFieldContext([
              {
                logicalName: "name",
                attributeType: "String",
                isValidForRead: true
              } as FieldDef
            ]);
          }

          return buildHoverFieldContext([]);
        }
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Field: `name`**"));
    assert.ok(markdown.includes("Type: `String`"));
  });

  test("returns field hover for link-entity condition attribute", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <filter>`,
      `        <condition attribute="industrycode" operator="in">`,
      `          <value>1</value>`,
      `        </condition>`,
      `      </filter>`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "industrycode"),
      requestContext: {
        getFieldContext: async (logicalName: string) => {
          if (logicalName === "account") {
            return buildHoverFieldContext([
              {
                logicalName: "industrycode",
                attributeType: "Picklist",
                isValidForRead: true
              } as FieldDef
            ]);
          }

          return buildHoverFieldContext([]);
        },
        getChoiceMetadata: async (logicalName: string) => {
          if (logicalName === "account") {
            return [
              {
                entityLogicalName: "account",
                fieldLogicalName: "industrycode",
                attributeType: "Picklist",
                options: [
                  { value: 1, label: "Accounting", normalizedLabel: "accounting" },
                  { value: 2, label: "Agriculture", normalizedLabel: "agriculture" }
                ]
              } as any
            ];
          }

          return [];
        }
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Field: `industrycode`**"));
    assert.ok(markdown.includes("Type: `Picklist`"));
  });

  test("returns entity hover for link-entity name", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <attribute name="name" />`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "account"),
      requestContext: {
        getEntityByLogicalName: async (_logicalName: string) =>
          ({
            logicalName: "account",
            entitySetName: "accounts"
          }) as EntityDef
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Entity Set: `account`**"));
    assert.ok(markdown.includes("Entity set: `accounts`"));
  });

  test("returns field hover for nested link-entity attribute name", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <link-entity name="systemuser" from="systemuserid" to="ownerid" alias="owner">`,
      `        <attribute name="fullname" />`,
      `      </link-entity>`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const hover = await resolveFetchXmlHover({
      document,
      position: positionAt(text, "fullname"),
      requestContext: {
        getFieldContext: async (logicalName: string) => {
          if (logicalName === "systemuser") {
            return buildHoverFieldContext([
              {
                logicalName: "fullname",
                attributeType: "String",
                isValidForRead: true
              } as FieldDef
            ]);
          }

          return buildHoverFieldContext([]);
        }
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Field: `fullname`**"));
    assert.ok(markdown.includes("Type: `String`"));
  });

  test("returns relationship hover for link-entity from field", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <attribute name="name" />`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`;
    const lineOffset = text.indexOf(targetLine);
    const fromOffsetInLine = targetLine.indexOf(`from="accountid"`) + `from="`.length;
    const absoluteOffset = lineOffset + fromOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {
        getFieldContext: async (logicalName: string) => {
          if (logicalName === "account") {
            return buildHoverFieldContext([
              {
                logicalName: "accountid",
                attributeType: "Uniqueidentifier",
                isValidForRead: true
              } as FieldDef
            ]);
          }

          return buildHoverFieldContext([]);
        }
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Join field (linked entity)**"));
    assert.ok(markdown.includes("`account.accountid`"));
    assert.ok(markdown.includes("**Field: `accountid`**"));
  });

  test("returns relationship hover for link-entity to field", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <attribute name="name" />`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`;
    const lineOffset = text.indexOf(targetLine);
    const toOffsetInLine = targetLine.indexOf(`to="parentcustomerid"`) + `to="`.length;
    const absoluteOffset = lineOffset + toOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {
        getFieldContext: async (logicalName: string) => {
          if (logicalName === "contact") {
            return buildHoverFieldContext([
              {
                logicalName: "parentcustomerid",
                attributeType: "Lookup",
                isValidForRead: true
              } as FieldDef
            ]);
          }

          return buildHoverFieldContext([]);
        }
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Join field (parent scope)**"));
    assert.ok(markdown.includes("`contact.parentcustomerid`"));
    assert.ok(markdown.includes("**Field: `parentcustomerid`**"));
  });

  test("returns alias hover for link-entity alias", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <attribute name="name" />`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`;
    const lineOffset = text.indexOf(targetLine);
    const aliasOffsetInLine = targetLine.indexOf(`alias="acc"`) + `alias="`.length;
    const absoluteOffset = lineOffset + aliasOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {} as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Link alias**"));
    assert.ok(markdown.includes("`acc`"));
    assert.ok(markdown.includes("`account`"));
  });

  test("returns choice literal hover for inline fetchxml condition value", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <filter>`,
      `      <condition attribute="statecode" operator="eq" value="0" />`,
      `    </filter>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `      <condition attribute="statecode" operator="eq" value="0" />`;
    const lineOffset = text.indexOf(targetLine);
    const valueOffsetInLine = targetLine.indexOf(`value="0"`) + `value="`.length;
    const absoluteOffset = lineOffset + valueOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {
        getFieldContext: async (_logicalName: string) =>
          buildHoverFieldContext([
            {
              logicalName: "statecode",
              attributeType: "Picklist",
              isValidForRead: true
            } as FieldDef
          ]),
        getChoiceMetadata: async (_logicalName: string) => [
          {
            entityLogicalName: "contact",
            fieldLogicalName: "statecode",
            attributeType: "Picklist",
            options: [
              { value: 0, label: "Active", normalizedLabel: "active" },
              { value: 1, label: "Inactive", normalizedLabel: "inactive" }
            ]
          } as any
        ]
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Choice value**"));
    assert.ok(markdown.includes("`0` = Active"));
    assert.ok(markdown.includes("Field: `statecode`"));
    assert.ok(markdown.includes("Entity: `contact`"));
  });

  test("returns choice literal hover for fetchxml value element", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <link-entity name="account" from="accountid" to="parentcustomerid" alias="acc">`,
      `      <filter>`,
      `        <condition attribute="industrycode" operator="in">`,
      `          <value>1</value>`,
      `          <value>2</value>`,
      `        </condition>`,
      `      </filter>`,
      `    </link-entity>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `          <value>1</value>`;
    const lineOffset = text.indexOf(targetLine);
    const valueOffsetInLine = targetLine.indexOf(`1`);
    const absoluteOffset = lineOffset + valueOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {
        getFieldContext: async (logicalName: string) => {
          if (logicalName === "account") {
            return buildHoverFieldContext([
              {
                logicalName: "industrycode",
                attributeType: "Picklist",
                isValidForRead: true
              } as FieldDef
            ]);
          }

          return buildHoverFieldContext([]);
        },
        getChoiceMetadata: async (logicalName: string) => {
          if (logicalName === "account") {
            return [
              {
                entityLogicalName: "account",
                fieldLogicalName: "industrycode",
                attributeType: "Picklist",
                options: [
                  { value: 1, label: "Accounting", normalizedLabel: "accounting" },
                  { value: 2, label: "Agriculture", normalizedLabel: "agriculture" }
                ]
              } as any
            ];
          }

          return [];
        }
      } as any
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Choice value**"));
    assert.ok(markdown.includes("`1` = Accounting"));
    assert.ok(markdown.includes("Field: `industrycode`"));
    assert.ok(markdown.includes("Entity: `account`"));
  });

  test("returns undefined for non-choice fetchxml literal value", async () => {
    const text = [
      `<fetch top="5">`,
      `  <entity name="contact">`,
      `    <filter>`,
      `      <condition attribute="createdon" operator="eq" value="2023-01-01" />`,
      `    </filter>`,
      `  </entity>`,
      `</fetch>`
    ].join("\n");

    const document = await openDocument(text);

    const targetLine = `      <condition attribute="createdon" operator="eq" value="2023-01-01" />`;
    const lineOffset = text.indexOf(targetLine);
    const valueOffsetInLine = targetLine.indexOf(`2023-01-01`);
    const absoluteOffset = lineOffset + valueOffsetInLine;

    const hover = await resolveFetchXmlHover({
      document,
      position: document.positionAt(absoluteOffset),
      requestContext: {
        getFieldContext: async (_logicalName: string) =>
          buildHoverFieldContext([
            {
              logicalName: "createdon",
              attributeType: "DateTime",
              isValidForRead: true
            } as FieldDef
          ]),
        getChoiceMetadata: async (_logicalName: string) => []
      } as any
    });

    assert.strictEqual(hover, undefined);
  });
});