import * as assert from "assert";
import { buildInvestigationDocument } from "../../commands/router/actions/investigateRecord/investigationDocumentBuilder.js";
import type { InvestigationDocumentModel } from "../../commands/router/actions/investigateRecord/types.js";

suite("investigationDocumentBuilder", () => {
  function createModel(): InvestigationDocumentModel {
    return {
      environmentName: "SIT",
      entityLogicalName: "contact",
      entitySetName: "contacts",
      recordId: "8129eec7-4414-f111-8341-6045bdc42f8b",
      primaryName: "Alice Example",
      uiLink: "https://example.crm.dynamics.com/main.aspx?etn=contact",
      minimalQuery: "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)?$select=contactid,fullname",
      rawQuery: "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)",
      summaryFields: [
        { logicalName: "contactid", label: "Contact", value: "8129eec7-4414-f111-8341-6045bdc42f8b", category: "identity" },
        { logicalName: "modifiedon", label: "Modified On", value: "2026-03-16T00:00:00Z", category: "lifecycle" },
        { logicalName: "_ownerid_value", label: "Owner", value: "System Administrator", category: "ownership" },
        { logicalName: "processtriggerscope", label: "Scope", value: "Form", category: "business" },
        { logicalName: "emailaddress1", label: "Email", value: "alice@example.com", category: "business" }
      ],
      relatedRecords: [
        {
          logicalName: "Company Name",
          targetEntityLogicalName: "Account / Contact",
          recordId: "6d29eec7-4414-f111-8341-6045bdc42f8b",
          targetOptions: [
            { logicalName: "account", entitySetName: "accounts" },
            { logicalName: "contact", entitySetName: "contacts" }
          ]
        }
      ],
      reverseLinks: [
        {
          label: "Annotations",
          sourceEntityLogicalName: "annotation",
          referencingAttribute: "objectid",
          query: "annotations?$filter=_objectid_value eq 8129eec7-4414-f111-8341-6045bdc42f8b"
        }
      ],
      signals: [
        { severity: "info", message: "Record was modified recently (2 hours ago)." }
      ],
      suggestedQueries: [
        "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)",
        "accounts(6d29eec7-4414-f111-8341-6045bdc42f8b)"
      ],
      inferenceNotes: ["Entity resolved from JSON context."],
      selectedCandidateFieldName: "processtriggerformid",
      selectedCandidateConfidence: 72
    };
  }

  test("groups summary into ranked truthfulness buckets", () => {
    const document = buildInvestigationDocument(createModel());

    assert.match(document, /SUMMARY/);
    assert.match(document, /Identity/);
    assert.match(document, /Lifecycle/);
    assert.match(document, /Ownership/);
    assert.match(document, /Business-relevant fields/);
  });

  test("marks polymorphic lookups explicitly in points-to section", () => {
    const document = buildInvestigationDocument(createModel());

    assert.match(document, /POINTS TO/);
    assert.match(document, /Target\s+: Account \/ Contact/);
    assert.match(document, /Polymorphic lookup — multiple valid target entities\./);
    assert.match(document, /accounts\(6d29eec7-4414-f111-8341-6045bdc42f8b\)/);
    assert.match(document, /contacts\(6d29eec7-4414-f111-8341-6045bdc42f8b\)/);
  });

  test("uses careful wording for signals and suggested queries", () => {
    const document = buildInvestigationDocument(createModel());

    assert.match(document, /Heuristic hints only\. These are not root-cause findings/);
    assert.match(document, /These are suggestions, not evidence that related rows currently exist\./);
    assert.match(document, /Suggested next queries only\. These are convenience starting points, not verified findings\./);
    assert.match(document, /Resolution Notes/);
  });
  test("adds an interpretation section with record meaning hints", () => {
    const document = buildInvestigationDocument(createModel());

    assert.match(document, /INTERPRETATION/);
    assert.match(document, /Fast, heuristic meaning layer/);
    assert.match(document, /opened from the `processtriggerformid` field/);
    assert.match(document, /related to contact/);
    assert.match(document, /Context cue: Scope = Form\./);
  });
});
