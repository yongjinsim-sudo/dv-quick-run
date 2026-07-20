import * as assert from "assert";
import {
  buildExplainLookupUnderstanding,
  buildLookupUnderstandingLines
} from "../../commands/router/actions/explain/explainLookupUnderstanding.js";
import { toExplainMarkdown } from "../../commands/router/actions/explain/explainQueryMarkdown.js";
import { parseDataverseQuery } from "../../commands/router/actions/explain/explainQueryParser.js";

suite("Explain lookup understanding", () => {
  test("classifies parentcustomerid as polymorphic and exposes target navigation properties", () => {
    const result = buildExplainLookupUnderstanding(
      ["fullname", "_parentcustomerid_value"],
      [{
        logicalName: "parentcustomerid",
        displayName: "Company Name",
        attributeType: "Customer",
        lookupTargets: ["account", "contact"]
      }],
      {
        logicalName: "contact",
        manyToOne: [
          {
            navigationPropertyName: "parentcustomerid_account",
            referencingAttribute: "parentcustomerid",
            referencedEntity: "account"
          },
          {
            navigationPropertyName: "parentcustomerid_contact",
            referencingAttribute: "parentcustomerid",
            referencedEntity: "contact"
          }
        ],
        oneToMany: [],
        manyToMany: []
      }
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, "polymorphic");
    assert.deepStrictEqual(result[0].targets, [
      { logicalName: "account", navigationProperty: "parentcustomerid_account" },
      { logicalName: "contact", navigationProperty: "parentcustomerid_contact" }
    ]);
    assert.strictEqual(
      result[0].logicalNameAnnotation,
      "_parentcustomerid_value@Microsoft.Dynamics.CRM.lookuplogicalname"
    );

    const markdown = buildLookupUnderstandingLines(result).join("\n");
    assert.match(markdown, /^#### Company Name \(parentcustomerid\)$/m);
    assert.match(markdown, /Polymorphic lookup/);
    assert.match(markdown, /parentcustomerid_account/);
    assert.match(markdown, /parentcustomerid_contact/);
  });

  test("classifies primarycontactid as a standard lookup", () => {
    const result = buildExplainLookupUnderstanding(
      ["name", "_primarycontactid_value"],
      [{
        logicalName: "primarycontactid",
        displayName: "Primary Contact",
        attributeType: "Lookup",
        lookupTargets: ["contact"]
      }],
      {
        logicalName: "account",
        manyToOne: [{
          navigationPropertyName: "primarycontactid",
          referencingAttribute: "primarycontactid",
          referencedEntity: "contact"
        }],
        oneToMany: [],
        manyToMany: []
      }
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].kind, "standard");
    assert.deepStrictEqual(result[0].targets, [
      { logicalName: "contact", navigationProperty: "primarycontactid" }
    ]);
  });

  test("does not emit lookup understanding when lookup backing property is not selected", () => {
    const result = buildExplainLookupUnderstanding(
      ["fullname"],
      [{ logicalName: "parentcustomerid", attributeType: "Customer" }],
      {
        logicalName: "contact",
        manyToOne: [{
          navigationPropertyName: "parentcustomerid_account",
          referencingAttribute: "parentcustomerid",
          referencedEntity: "account"
        }],
        oneToMany: [],
        manyToMany: []
      }
    );

    assert.deepStrictEqual(result, []);
  });

  test("renders lookup and diagnostic details beneath their technical sections", async () => {
    const lookupUnderstanding = buildExplainLookupUnderstanding(
      ["fullname", "_parentcustomerid_value"],
      [{
        logicalName: "parentcustomerid",
        displayName: "Company Name",
        attributeType: "Customer",
        lookupTargets: ["account", "contact"]
      }],
      {
        logicalName: "contact",
        manyToOne: [
          {
            navigationPropertyName: "parentcustomerid_account",
            referencingAttribute: "parentcustomerid",
            referencedEntity: "account"
          },
          {
            navigationPropertyName: "parentcustomerid_contact",
            referencingAttribute: "parentcustomerid",
            referencedEntity: "contact"
          }
        ],
        oneToMany: [],
        manyToMany: []
      }
    );
    const parsed = parseDataverseQuery("contacts?$select=fullname,_parentcustomerid_value&$top=10");
    const markdown = await toExplainMarkdown(
      parsed,
      { logicalName: "contact", entitySetName: "contacts" } as any,
      [],
      [],
      {
        findings: [{
          message: "Company Name requires a target-specific navigation property.",
          severity: "info",
          suggestion: "Choose a target only when target fields are needed"
        }]
      },
      undefined,
      [],
      lookupUnderstanding
    );

    assert.match(markdown, /^### Lookup & Relationship Understanding$/m);
    assert.match(markdown, /^#### Company Name \(parentcustomerid\)$/m);
    assert.doesNotMatch(markdown, /^### Company Name \(parentcustomerid\)$/m);
    assert.match(markdown, /^### Diagnostics$/m);
    assert.match(markdown, /^#### Issue: Company Name requires a target-specific navigation property\.$/m);
  });
});
