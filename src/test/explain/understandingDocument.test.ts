import * as assert from "assert";
import { buildODataQueryUnderstandingDocument } from "../../commands/router/actions/explain/explainQueryUnderstanding.js";
import type { ParsedDataverseQuery } from "../../commands/router/actions/explain/explainQueryTypes.js";
import { runExplainEngine } from "../../product/explainEngine/explainEngine.js";
import { renderUnderstandingDocumentMarkdown } from "../../product/understanding/understandingMarkdownRenderer.js";

const parsed: ParsedDataverseQuery = {
  raw: "accounts?$select=name,accountnumber&$filter=statecode eq 0&$orderby=name asc&$top=10&$expand=primarycontactid($select=fullname,emailaddress1)",
  normalized: "accounts?$select=name,accountnumber&$filter=statecode eq 0&$orderby=name asc&$top=10&$expand=primarycontactid($select=fullname,emailaddress1)",
  pathPart: "accounts",
  queryPart: "$select=name,accountnumber&$filter=statecode eq 0&$orderby=name asc&$top=10&$expand=primarycontactid($select=fullname,emailaddress1)",
  entitySetName: "accounts",
  isSingleRecord: false,
  isCollection: true,
  params: [],
  select: ["name", "accountnumber"],
  filter: "statecode eq 0",
  orderBy: [{ field: "name", direction: "asc" }],
  top: 10,
  expand: [{ navigationProperty: "primarycontactid", nestedSelect: ["fullname", "emailaddress1"], raw: "primarycontactid($select=fullname,emailaddress1)" }],
  unknownParams: []
};

suite("understandingDocument", () => {
  test("preserves narrative and technical breakdown in the same document", async () => {
    const explainResult = await runExplainEngine(
      "DV Quick Run - Explain Query",
      { subjectKind: "odata", sourceText: parsed.normalized, entityLogicalName: "account", entitySetName: "accounts" },
      [
        {
          id: "test.structure",
          title: "Query Structure Analysis",
          run: () => ({
            sections: [
              { heading: "Target", lines: ["- Entity set: `accounts`", "- Logical name: `account`", "- Operation: Retrieve multiple records"], confidence: "high", sourceContributor: "test.structure" },
              { heading: "$select", lines: ["Fields returned:", "- `name`", "- `accountnumber`"], confidence: "high", sourceContributor: "test.structure" }
            ],
            evidence: [{ label: "Parsed query", detail: "Entity set `accounts`, selected columns 2, expands 1.", confidence: "high" }]
          })
        }
      ]
    );

    const document = buildODataQueryUnderstandingDocument(explainResult, parsed, { logicalName: "account" } as any);
    const markdown = renderUnderstandingDocumentMarkdown(document);

    assert.strictEqual(document.engineVersion, "v2.3");
    assert.strictEqual(document.invariant, "Narrative must never replace technical truth.");
    assert.ok(markdown.includes("## Investigation Narrative"));
    assert.ok(markdown.includes("## Query Mechanics"));
    assert.ok(markdown.includes("## Technical Breakdown"));
    assert.ok(markdown.includes("### $select"));
    assert.ok(markdown.includes("## Raw Query Reference"));
  });

  test("surfaces investigation smells without hiding positive findings", async () => {
    const broadParsed: ParsedDataverseQuery = {
      ...parsed,
      raw: "accounts",
      normalized: "accounts",
      queryPart: "",
      select: [],
      filter: undefined,
      orderBy: [],
      top: undefined,
      expand: []
    };

    const explainResult = await runExplainEngine(
      "DV Quick Run - Explain Query",
      { subjectKind: "odata", sourceText: broadParsed.normalized, entityLogicalName: "account", entitySetName: "accounts" },
      []
    );

    const document = buildODataQueryUnderstandingDocument(explainResult, broadParsed, { logicalName: "account" } as any);
    assert.ok(document.signals.some((signal) => signal.title === "Projection not specified"));
    assert.ok(document.signals.some((signal) => signal.title === "Unfiltered collection retrieval"));
  });
});
