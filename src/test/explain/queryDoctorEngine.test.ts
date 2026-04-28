import * as assert from "assert";
import { runDiagnostics } from "../../commands/router/actions/shared/diagnostics/diagnosticRuleEngine.js";
import type { ParsedDataverseQuery } from "../../commands/router/actions/explain/explainQueryTypes.js";

const baseParsed: ParsedDataverseQuery = {
  raw: "contacts?$filter=fullname eq 'A'",
  normalized: "contacts?$filter=fullname eq 'A'",
  pathPart: "contacts",
  queryPart: "$filter=fullname eq 'A'",
  entitySetName: "contacts",
  isSingleRecord: false,
  isCollection: true,
  params: [],
  select: [],
  filter: "fullname eq 'A'",
  orderBy: [],
  expand: [],
  unknownParams: []
};

suite("queryDoctorEngine", () => {
  test("runs level 1 diagnostics for free capability", async () => {
    const result = await runDiagnostics(
      { parsed: baseParsed },
      { insightLevel: 1, canApplyFix: false }
    );

    assert.strictEqual(result.findings.length, 2);
    assert.ok(result.findings.some((finding) => finding.message.includes("$select")));
    assert.ok(result.findings.some((finding) => finding.message.includes("$top")));
  });



  test("prefers business-facing narrowing dimensions over sparse lookup backing fields", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "bu_tasks?$select=bu_status,bu_intent,_bu_taskrequesterpractitioner_value&$top=5000",
          normalized: "bu_tasks?$select=bu_status,bu_intent,_bu_taskrequesterpractitioner_value&$top=5000",
          pathPart: "bu_tasks",
          queryPart: "$select=bu_status,bu_intent,_bu_taskrequesterpractitioner_value&$top=5000",
          entitySetName: "bu_tasks",
          select: ["bu_status", "bu_intent", "_bu_taskrequesterpractitioner_value"],
          top: 5000,
          params: [
            { key: "$select", value: "bu_status,bu_intent,_bu_taskrequesterpractitioner_value" },
            { key: "$top", value: "5000" }
          ]
        },
        entityLogicalName: "bu_task",
        loadFieldsForEntity: async () => ([
          { logicalName: "bu_status", attributeType: "Picklist", displayName: "Status", isValidForAdvancedFind: true },
          { logicalName: "bu_intent", attributeType: "Picklist", displayName: "Intent", isValidForAdvancedFind: true },
          { logicalName: "bu_taskrequesterpractitioner", attributeType: "Lookup", displayName: "Requester Practitioner", isValidForAdvancedFind: true }
        ] as any),
        executionEvidence: {
          querySignature: "bu_tasks?$select=bu_status,bu_intent,_bu_taskrequesterpractitioner_value&$top=5000",
          entitySetName: "bu_tasks",
          executionTimeMs: 3578,
          returnedRowCount: 5000,
          requestedTop: 5000,
          returnedFullPage: true,
          selectedColumnCount: 3,
          hasExpand: false,
          filterFieldNames: [],
          fieldObservations: [
            {
              field: "bu_status",
              nonNullCount: 5000,
              nullCount: 0,
              distinctCount: 4,
              mostCommonCount: 1800,
              kind: "categorical",
              topValues: [{ value: "Active", count: 1800 }, { value: "Completed", count: 1500 }, { value: "Cancelled", count: 900 }]
            },
            {
              field: "bu_intent",
              nonNullCount: 4700,
              nullCount: 300,
              distinctCount: 3,
              mostCommonCount: 2000,
              kind: "categorical",
              topValues: [{ value: "Review", count: 2000 }, { value: "Follow up", count: 1600 }, { value: "Escalation", count: 1100 }]
            },
            {
              field: "_bu_taskrequesterpractitioner_value",
              nonNullCount: 16,
              nullCount: 4984,
              distinctCount: 16,
              mostCommonCount: 1,
              kind: "presence",
              topValues: []
            }
          ],
          observedAt: Date.now()
        }
      },
      { insightLevel: 1, canApplyFix: false }
    );

    const finding = result.findings.find((item) => item.narrowingSuggestions?.length);
    assert.ok(finding);
    assert.strictEqual(finding?.narrowingSuggestions?.[0]?.field, "bu_status");
    assert.ok((finding?.narrowingSuggestions?.length ?? 0) <= 3);
    assert.strictEqual(
      finding?.narrowingSuggestions?.some((suggestion) => suggestion.field === "_bu_taskrequesterpractitioner_value"),
      false
    );
  });


  test("promotes dominant business picklists even when their distribution is skewed", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "bu_tasks?$select=bu_status,bu_intent,bu_priority,bu_timingperiod,bu_timingperiodunit",
          normalized: "bu_tasks?$select=bu_status,bu_intent,bu_priority,bu_timingperiod,bu_timingperiodunit",
          pathPart: "bu_tasks",
          queryPart: "$select=bu_status,bu_intent,bu_priority,bu_timingperiod,bu_timingperiodunit",
          entitySetName: "bu_tasks",
          select: ["bu_status", "bu_intent", "bu_priority", "bu_timingperiod", "bu_timingperiodunit"],
          params: [{ key: "$select", value: "bu_status,bu_intent,bu_priority,bu_timingperiod,bu_timingperiodunit" }]
        },
        entityLogicalName: "bu_task",
        loadFieldsForEntity: async () => ([
          { logicalName: "bu_status", attributeType: "Picklist", displayName: "Status", isValidForAdvancedFind: true },
          { logicalName: "bu_intent", attributeType: "Picklist", displayName: "Intent", isValidForAdvancedFind: true },
          { logicalName: "bu_priority", attributeType: "Picklist", displayName: "Priority", isValidForAdvancedFind: true },
          { logicalName: "bu_timingperiod", attributeType: "Integer", displayName: "Timing Period", isValidForAdvancedFind: true },
          { logicalName: "bu_timingperiodunit", attributeType: "Picklist", displayName: "Timing Period Unit", isValidForAdvancedFind: true }
        ] as any),
        executionEvidence: {
          querySignature: "bu_tasks?$select=bu_status,bu_intent,bu_priority,bu_timingperiod,bu_timingperiodunit",
          entitySetName: "bu_tasks",
          executionTimeMs: 638,
          returnedRowCount: 5000,
          requestedTop: undefined,
          returnedFullPage: true,
          selectedColumnCount: 5,
          hasExpand: false,
          filterFieldNames: [],
          fieldObservations: [
            { field: "bu_status", nonNullCount: 5000, nullCount: 0, distinctCount: 5, mostCommonCount: 4923, kind: "categorical", topValues: [{ value: "In progress", count: 4923 }, { value: "Open", count: 30 }, { value: "Complete", count: 30 }] },
            { field: "bu_intent", nonNullCount: 5000, nullCount: 0, distinctCount: 4, mostCommonCount: 4985, kind: "categorical", topValues: [{ value: "Default", count: 4985 }, { value: "Reminder", count: 8 }, { value: "Follow-up", count: 6 }] },
            { field: "bu_priority", nonNullCount: 15, nullCount: 4985, distinctCount: 2, mostCommonCount: 8, kind: "presence", topValues: [] },
            { field: "bu_timingperiod", nonNullCount: 3585, nullCount: 1415, distinctCount: 6, mostCommonCount: 1278, kind: "categorical", topValues: [{ value: "12", count: 1278 }, { value: "24", count: 1121 }, { value: "6", count: 732 }] },
            { field: "bu_timingperiodunit", nonNullCount: 3585, nullCount: 1415, distinctCount: 1, mostCommonCount: 3585, kind: "presence", topValues: [] }
          ],
          observedAt: Date.now()
        }
      },
      { insightLevel: 1, canApplyFix: false }
    );

    const finding = result.findings.find((item) => item.narrowingSuggestions?.length);
    assert.ok(finding);
    const fields = finding?.narrowingSuggestions?.map((s) => s.field) ?? [];
    assert.ok(fields.includes("bu_status"));
    assert.ok(fields.includes("bu_intent"));
    assert.strictEqual(fields[0], "bu_status");
    assert.strictEqual(fields[1], "bu_intent");
  });

  test("surfaces structured narrowing guidance when evidence shows candidate fields", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$select=fullname,statecode,statuscode&$top=50",
          normalized: "contacts?$select=fullname,statecode,statuscode&$top=50",
          queryPart: "$select=fullname,statecode,statuscode&$top=50",
          select: ["fullname", "statecode", "statuscode"],
          top: 50,
          params: [
            { key: "$select", value: "fullname,statecode,statuscode" },
            { key: "$top", value: "50" }
          ]
        },
        executionEvidence: {
          querySignature: "contacts?$select=fullname,statecode,statuscode&$top=50",
          executionTimeMs: 180,
          returnedRowCount: 50,
          requestedTop: 50,
          returnedFullPage: true,
          selectedColumnCount: 3,
          hasExpand: false,
          filterFieldNames: [],
          fieldObservations: [
            {
              field: "statecode",
              nonNullCount: 50,
              nullCount: 0,
              distinctCount: 2,
              mostCommonCount: 30,
              kind: "categorical",
              topValues: [{ value: "Active", count: 30 }, { value: "Inactive", count: 20 }]
            },
            {
              field: "prioritycode",
              nonNullCount: 12,
              nullCount: 38,
              distinctCount: 1,
              mostCommonCount: 12,
              kind: "presence",
              topValues: []
            }
          ],
          observedAt: Date.now()
        }
      },
      { insightLevel: 1, canApplyFix: false }
    );

    const finding = result.findings.find((item) => item.narrowingSuggestions?.length);
    assert.ok(finding);
    assert.ok(finding?.observedDetails?.some((detail) => detail.includes("statecode")));
    assert.ok(finding?.narrowingSuggestions?.some((suggestion) => suggestion.field === "statecode"));
  });

  test("does not warn about $select or $top when already present", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$select=fullname&$top=10",
          normalized: "contacts?$select=fullname&$top=10",
          queryPart: "$select=fullname&$top=10",
          select: ["fullname"],
          top: 10
        }
      },
      { insightLevel: 1, canApplyFix: false }
    );

    assert.strictEqual(result.findings.length, 0);
  });

  test("surfaces unknown query options and duplicate select fields", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$select=fullname,fullname&foo=bar",
          normalized: "contacts?$select=fullname,fullname&foo=bar",
          queryPart: "$select=fullname,fullname&foo=bar",
          select: ["fullname", "fullname"],
          unknownParams: [{ key: "$foo", value: "bar" }]
        }
      },
      { insightLevel: 1, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("unrecognised option")));
    assert.ok(result.findings.some((finding) => finding.message.includes("duplicate $select")));
  });

  test("promotes non-field validation issues into level 2 diagnostics", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$select=fullname&$top=10",
          normalized: "contacts?$select=fullname&$top=10",
          queryPart: "$select=fullname&$top=10",
          select: ["fullname"],
          top: 10
        },
        validationIssues: [{
          severity: "warning",
          message: "Operator usage may be ambiguous.",
          suggestion: "Review the filter clause."
        }]
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].message, "Operator usage may be ambiguous.");
    assert.strictEqual(result.findings[0].suggestion, "Review the filter clause.");
  });

  test("does not run metadata-aware filterability diagnostics for free capability", async () => {
    const result = await runDiagnostics(
      {
        parsed: baseParsed,
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "fullname", isValidForAdvancedFind: false }] as any)
      },
      { insightLevel: 1, canApplyFix: false }
    );

    assert.ok(!result.findings.some((finding) => finding.message.includes("may not be filterable")));
  });

  test("surfaces metadata-aware filterability diagnostics for pro capability", async () => {
    const result = await runDiagnostics(
      {
        parsed: baseParsed,
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "fullname", isValidForAdvancedFind: false }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("may not be filterable")));
  });

  test("surfaces advisory diagnostic for unknown filter fields in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=bogusfield eq 'A'",
          normalized: "contacts?$filter=bogusfield eq 'A'",
          queryPart: "$filter=bogusfield eq 'A'",
          filter: "bogusfield eq 'A'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "fullname", isValidForAdvancedFind: true }] as any),
        validationIssues: [{
          severity: "error",
          message: "Field `bogusfield` in $filter was not found on `contact`.",
          suggestion: "Did you mean `fullname`?"
        }]
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("not recognised as a standard attribute")));
    assert.ok(!result.findings.some((finding) => finding.message.includes("was not found on")));
  });

  test("surfaces advisory diagnostic for non-attribute-like filter fields in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "emails?$filter=to eq 'abc'",
          normalized: "emails?$filter=to eq 'abc'",
          pathPart: "emails",
          entitySetName: "emails",
          queryPart: "$filter=to eq 'abc'",
          filter: "to eq 'abc'"
        },
        entityLogicalName: "email",
        loadFieldsForEntity: async () => ([{ logicalName: "subject", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("does not appear to be a standard scalar attribute")));
  });


  test("surfaces advisory diagnostic for date/time literal mismatch in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=createdon eq 'abc'",
          normalized: "accounts?$filter=createdon eq 'abc'",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=createdon eq 'abc'",
          filter: "createdon eq 'abc'"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "createdon", attributeType: "DateTime", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("date/time field")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("ISO-style date or datetime")));
  });

  test("surfaces advisory diagnostic for boolean literal mismatch in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=donotemail eq 'abc'",
          normalized: "contacts?$filter=donotemail eq 'abc'",
          pathPart: "contacts",
          entitySetName: "contacts",
          queryPart: "$filter=donotemail eq 'abc'",
          filter: "donotemail eq 'abc'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "donotemail", attributeType: "Boolean", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("boolean field")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("true or false")));
  });

  test("surfaces advisory diagnostic for numeric literal mismatch in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=numberofemployees eq 'hello'",
          normalized: "accounts?$filter=numberofemployees eq 'hello'",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=numberofemployees eq 'hello'",
          filter: "numberofemployees eq 'hello'"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "numberofemployees", attributeType: "Integer", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("numeric field")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("numeric literal")));
  });
  test("surfaces advisory diagnostic for special non-attribute-like fields even when metadata contains the field", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "emails?$filter=to eq 'abc'",
          normalized: "emails?$filter=to eq 'abc'",
          pathPart: "emails",
          entitySetName: "emails",
          queryPart: "$filter=to eq 'abc'",
          filter: "to eq 'abc'"
        },
        entityLogicalName: "email",
        loadFieldsForEntity: async () => ([
          { logicalName: "to", isValidForAdvancedFind: true },
          { logicalName: "subject", isValidForAdvancedFind: true }
        ] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("does not appear to be a standard scalar attribute")));
    assert.ok(!result.findings.some((finding) => finding.message.includes("may not be filterable")));
  });


  test("surfaces semantic operator diagnostic for text fields with range operators in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=name gt 'abc'",
          normalized: "accounts?$filter=name gt 'abc'",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=name gt 'abc'",
          filter: "name gt 'abc'"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "name", attributeType: "String", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("text field")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("supported text function")));
  });

  test("surfaces semantic operator diagnostic for choice-like fields with range operators in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=statecode gt 0",
          normalized: "contacts?$filter=statecode gt 0",
          pathPart: "contacts",
          entitySetName: "contacts",
          queryPart: "$filter=statecode gt 0",
          filter: "statecode gt 0"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "statecode", attributeType: "State", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("choice-like field")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("Prefer eq/ne")));
  });

  test("does not surface semantic operator diagnostic for numeric range comparison in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=numberofemployees gt 10",
          normalized: "accounts?$filter=numberofemployees gt 10",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=numberofemployees gt 10",
          filter: "numberofemployees gt 10"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "numberofemployees", attributeType: "Integer", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(!result.findings.some((finding) => finding.message.includes("text field")));
    assert.ok(!result.findings.some((finding) => finding.message.includes("choice-like field")));
  });

  test("surfaces null/operator guidance for range comparison against null in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=name gt null",
          normalized: "accounts?$filter=name gt null",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=name gt null",
          filter: "name gt null"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "name", attributeType: "String", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("compared to null with operator `gt`")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("eq null or ne null")));
  });

  test("surfaces quoted-null guidance for non-text fields in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=createdon eq 'null'",
          normalized: "accounts?$filter=createdon eq 'null'",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=createdon eq 'null'",
          filter: "createdon eq 'null'"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "createdon", attributeType: "DateTime", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.some((finding) => finding.message.includes("quoted literal `")));
    assert.ok(result.findings.some((finding) => finding.suggestion?.includes("Use unquoted null")));
  });

  test("does not surface null/operator guidance for eq null checks in pro", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "accounts?$filter=numberofemployees eq null",
          normalized: "accounts?$filter=numberofemployees eq null",
          pathPart: "accounts",
          entitySetName: "accounts",
          queryPart: "$filter=numberofemployees eq null",
          filter: "numberofemployees eq null"
        },
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "numberofemployees", attributeType: "Integer", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(!result.findings.some((finding) => finding.message.includes("compared to null with operator")));
    assert.ok(!result.findings.some((finding) => finding.message.includes("quoted literal")));
  });

  test("adds suggested fix for missing $select and $top", async () => {
    const result = await runDiagnostics(
      {
        parsed: baseParsed
      },
      { insightLevel: 1, canApplyFix: false }
    );

    const selectFinding = result.findings.find((finding) => finding.message.includes("$select"));
    const topFinding = result.findings.find((finding) => finding.message.includes("$top"));

    assert.ok(selectFinding?.suggestedFix);
    assert.strictEqual(selectFinding?.actionability, "none");
    assert.strictEqual(selectFinding?.suggestedQuery, undefined);
    assert.ok(topFinding?.suggestedFix);
    assert.strictEqual(topFinding?.suggestedQuery?.query, "contacts?$top=20&$filter=fullname eq 'A'");
  });

  test("surfaces speculative boolean suggested fix when field cannot be resolved", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=msemr_active eq 'true'",
          normalized: "contacts?$filter=msemr_active eq 'true'",
          queryPart: "$filter=msemr_active eq 'true'",
          filter: "msemr_active eq 'true'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "fullname", isValidForAdvancedFind: true }] as any),
        validationIssues: [{
          severity: "error",
          message: "Field `msemr_active` in $filter was not found on `contact`.",
          suggestion: "Check the logical name."
        }]
      },
      { insightLevel: 2, canApplyFix: false }
    );

    const finding = result.findings.find((item) => item.message.includes("not recognised as a standard attribute"));
    assert.ok(finding);
    assert.strictEqual(finding?.suggestedFix?.label, "Use true or false without quotes");
    assert.strictEqual(finding?.suggestedFix?.isSpeculative, true);
    assert.strictEqual(finding?.suggestedFix?.example, "msemr_active eq true");
  });

  test("surfaces speculative quoted-null suggested fix when field cannot be resolved", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=parentcustomerid eq 'null'",
          normalized: "contacts?$filter=parentcustomerid eq 'null'",
          queryPart: "$filter=parentcustomerid eq 'null'",
          filter: "parentcustomerid eq 'null'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "fullname", isValidForAdvancedFind: true }] as any),
        validationIssues: [{
          severity: "error",
          message: "Field `parentcustomerid` in $filter was not found on `contact`.",
          suggestion: "Check the logical name."
        }]
      },
      { insightLevel: 2, canApplyFix: false }
    );

    const finding = result.findings.find((item) => item.message.includes("not recognised as a standard attribute"));
    assert.ok(finding?.suggestedFix);
    assert.strictEqual(finding?.suggestedFix?.label, "Use null without quotes");
    assert.strictEqual(finding?.suggestedFix?.example, "parentcustomerid eq null");
  });

  test("surfaces review-path suggestion for related field style filters", async () => {
    const result = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=parentcustomerid/name eq 'Acme'",
          normalized: "contacts?$filter=parentcustomerid/name eq 'Acme'",
          queryPart: "$filter=parentcustomerid/name eq 'Acme'",
          filter: "parentcustomerid/name eq 'Acme'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "parentcustomerid", attributeType: "Lookup", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    const finding = result.findings.find((item) => item.message.includes("does not appear to be a standard scalar attribute"));
    assert.ok(finding?.suggestedFix);
    assert.strictEqual(finding?.suggestedFix?.label, "Review the related-field path");
    assert.strictEqual(finding?.suggestedFix?.isSpeculative, true);
  });

  test("surfaces numeric and equality-style suggestions for choice-like filters", async () => {
    const operatorResult = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=statecode like '0'",
          normalized: "contacts?$filter=statecode like '0'",
          queryPart: "$filter=statecode like '0'",
          filter: "statecode like '0'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "statecode", attributeType: "State", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    const semanticFinding = operatorResult.findings.find((item) => item.message.includes("choice-like or boolean field"));
    assert.ok(semanticFinding?.suggestedFix);
    assert.strictEqual(semanticFinding?.suggestedFix?.example, "statecode eq 0");

    const numericResult = await runDiagnostics(
      {
        parsed: {
          ...baseParsed,
          raw: "contacts?$filter=statecode eq 'abc'",
          normalized: "contacts?$filter=statecode eq 'abc'",
          queryPart: "$filter=statecode eq 'abc'",
          filter: "statecode eq 'abc'"
        },
        entityLogicalName: "contact",
        loadFieldsForEntity: async () => ([{ logicalName: "statecode", attributeType: "State", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    const typeFinding = numericResult.findings.find((item) => item.message.includes("literal `'abc'` is not numeric"));
    assert.ok(typeFinding?.suggestedFix);
    assert.strictEqual(typeFinding?.suggestedFix?.example, "statecode eq 0");
  });

});