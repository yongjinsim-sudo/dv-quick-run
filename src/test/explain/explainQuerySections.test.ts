import * as assert from "assert";
import { buildDesignNotes, buildIntentLines, buildSections, buildSummary, buildValidationLines } from "../../commands/router/actions/explain/explainQuerySections.js";
import type { ParsedDataverseQuery } from "../../commands/router/actions/explain/explainQueryTypes.js";

const parsed: ParsedDataverseQuery = {
  raw: "contacts?$select=fullname&$filter=contains(fullname,'john')&$orderby=createdon desc&$top=5&$expand=parentcustomerid_account($select=name)&$foo=bar",
  normalized: "contacts?$select=fullname&$filter=contains(fullname,'john')&$orderby=createdon desc&$top=5&$expand=parentcustomerid_account($select=name)&$foo=bar",
  pathPart: "contacts",
  queryPart: "$select=fullname&$filter=contains(fullname,'john')&$orderby=createdon desc&$top=5&$expand=parentcustomerid_account($select=name)&$foo=bar",
  entitySetName: "contacts",
  isSingleRecord: false,
  isCollection: true,
  params: [],
  select: ["fullname"],
  filter: "contains(fullname,'john')",
  orderBy: [{ field: "createdon", direction: "desc" }],
  top: 5,
  expand: [{ navigationProperty: "parentcustomerid_account", nestedSelect: ["name"], raw: "parentcustomerid_account($select=name)" }],
  unknownParams: [{ key: "$foo", value: "bar" }]
};

suite("explainQuerySections", () => {
  test("buildSummary includes retrieval, filter, ordering and top hints", () => {
    const summary = buildSummary(parsed, { logicalName: "contact" } as any);
    assert.ok(summary.includes("Retrieves contact records."));
    assert.ok(summary.includes("Filter intent:"));
    assert.ok(summary.includes("Sorts by createdon desc."));
    assert.ok(summary.includes("Limits the result to 5 rows."));
  });

  test("buildSections includes select, filter, expand and other query options sections", () => {
    const sections = buildSections(parsed, { logicalName: "contact" } as any);
    const headings = sections.map((x) => x.heading);
    assert.ok(headings.includes("$select"));
    assert.ok(headings.includes("$filter"));
    assert.ok(headings.includes("$expand"));
    assert.ok(headings.includes("Other query options"));
  });


  test("buildSections enriches simple choice-like filter narration when metadata is available", () => {
    const sections = buildSections(
      {
        ...parsed,
        filter: "statecode eq 0"
      },
      { logicalName: "contact" } as any,
      [{
        fieldLogicalName: "statecode",
        options: [
          { value: 0, label: "Active", normalizedLabel: "active" },
          { value: 1, label: "Inactive", normalizedLabel: "inactive" }
        ]
      } as any]
    );

    const filterSection = sections.find((item) => item.heading === "$filter");
    assert.ok(filterSection?.lines.some((line) => line.includes("Plain English: statecode equals 0 (Active)")));
  });

  test("buildIntentLines and design notes reflect focused query shape", () => {
    const intent = buildIntentLines(parsed).join("\n");
    const notes = buildDesignNotes(parsed).join("\n");
    assert.ok(intent.includes("focused list/search-style query") || intent.includes("filtered list query"));
    assert.ok(notes.length > 0);
  });

  test("buildValidationLines renders warnings and suggestions", () => {
    const lines = buildValidationLines([{ severity: "warning", message: "Careful", suggestion: "Add $top" } as any]);
    assert.deepStrictEqual(lines, ["- Warning: Careful", "  - Suggestion: Add $top"]);
  });
});
