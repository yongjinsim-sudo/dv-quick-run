import * as assert from "assert";
import {
  buildLookupReferenceText,
  buildLookupUnderstandings,
  buildQueryMetadataContext,
  selectReferencedLookups,
  validateLookupTargetDisplayFields
} from "../../core/metadata/lookupUnderstanding.js";
import { buildQuerySemanticModel } from "../../core/query/querySemanticModel.js";
import {
  buildLookupDiscoveryActions,
  buildLookupDiscoverySuggestions,
  buildMetadataQueryDiagnostics
} from "../../core/queryDoctor/metadataQueryDiagnostics.js";
import { parseDataverseQuery } from "../../commands/router/actions/explain/explainQueryParser.js";
import { buildMetadataQueryRecommendations } from "../../core/recommendations/metadataRecommendationEngine.js";

const fields = [{
  logicalName: "sample_requester",
  displayName: "Requester",
  attributeType: "Lookup",
  lookupTargets: ["account", "contact", "sample_device"]
}];

const relationships = [
  {
    navigationPropertyName: "sample_Requester_account",
    schemaName: "sample_workitem_Requester_account",
    referencingAttribute: "sample_requester",
    referencingEntity: "sample_workitem",
    referencedEntity: "account",
    relationshipType: "ManyToOne"
  },
  {
    navigationPropertyName: "sample_Requester_contact",
    schemaName: "sample_workitem_Requester_contact",
    referencingAttribute: "sample_requester",
    referencingEntity: "sample_workitem",
    referencedEntity: "contact",
    relationshipType: "ManyToOne"
  },
  {
    navigationPropertyName: "sample_Requester_sample_device",
    schemaName: "sample_workitem_Requester_sample_device",
    referencingAttribute: "sample_requester",
    referencingEntity: "sample_workitem",
    referencedEntity: "sample_device",
    relationshipType: "ManyToOne"
  },
  {
    navigationPropertyName: "sample_workitem_children",
    schemaName: "sample_workitem_children",
    referencingAttribute: "sample_parentworkitem",
    referencingEntity: "sample_workitemchild",
    referencedEntity: "sample_workitem",
    relationshipType: "OneToMany"
  }
];

const entities = [
  { logicalName: "account", entitySetName: "accounts", displayName: "Account", primaryNameAttribute: "name" },
  { logicalName: "contact", entitySetName: "contacts", displayName: "Contact", primaryNameAttribute: "fullname" },
  { logicalName: "sample_device", entitySetName: "sample_devices", displayName: "Device", primaryNameAttribute: "sample_name" }
];

const targetFields = new Map([
  ["account", [{ logicalName: "name", isValidForRead: true }]],
  ["contact", [{ logicalName: "fullname", isValidForRead: true }]],
  ["sample_device", [{ logicalName: "sample_name", isValidForRead: true }]]
]);

function withValidatedTargetFields(
  model: ReturnType<typeof buildQuerySemanticModel>,
  context: ReturnType<typeof buildQueryMetadataContext>
) {
  const lookupUnderstandings = context.lookupUnderstandings.map((lookup) =>
    validateLookupTargetDisplayFields(lookup, targetFields)
  );
  return {
    ...context,
    lookupUnderstandings,
    referencedLookups: selectReferencedLookups(model, lookupUnderstandings)
  };
}

function contextFor(source: string) {
  const model = buildQuerySemanticModel(parseDataverseQuery(source));
  const context = buildQueryMetadataContext({
      model,
      environmentLabel: "DVQR Test",
      entityLogicalName: "sample_workitem",
      entitySetName: "sample_workitems",
      fields,
      relationships,
      allNavigationProperties: relationships.map((item) => item.navigationPropertyName),
      entityDefinitions: entities,
      capturedAtIso: "2026-07-20T00:00:00.000Z"
    });
  return { model, context: withValidatedTargetFields(model, context) };
}

suite("Metadata-aware query intelligence", () => {
  test("builds progressive suggestions for a bare Contact query", () => {
    const parsed = parseDataverseQuery("contacts");
    const model = buildQuerySemanticModel(parsed);
    const context = buildQueryMetadataContext({
      model,
      entityLogicalName: "contact",
      entitySetName: "contacts",
      fields: [{
        logicalName: "parentcustomerid",
        displayName: "Company Name",
        attributeType: "Customer",
        lookupTargets: ["account", "contact"]
      }],
      relationships: [
        {
          navigationPropertyName: "parentcustomerid_account",
          referencingAttribute: "parentcustomerid",
          referencingEntity: "contact",
          referencedEntity: "account"
        },
        {
          navigationPropertyName: "parentcustomerid_contact",
          referencingAttribute: "parentcustomerid",
          referencingEntity: "contact",
          referencedEntity: "contact"
        }
      ],
      entityDefinitions: entities
    });

    assert.deepStrictEqual(context.referencedLookups, []);
    const validatedLookup = validateLookupTargetDisplayFields(context.lookupUnderstandings[0], targetFields);
    const suggestions = buildLookupDiscoverySuggestions("contacts", validatedLookup);

    assert.strictEqual(suggestions.length, 3);
    assert.strictEqual(suggestions[0].query, "contacts?$select=_parentcustomerid_value");
    assert.ok(suggestions.some((item) => item.query === "contacts?$select=_parentcustomerid_value&$expand=parentcustomerid_account($select=name)"));
    assert.ok(suggestions.some((item) => item.query === "contacts?$select=_parentcustomerid_value&$expand=parentcustomerid_contact($select=fullname)"));
  });

  test("does not guess a nested display field for Owner principal navigation", () => {
    const source = "contacts";
    const model = buildQuerySemanticModel(parseDataverseQuery(source));
    const context = buildQueryMetadataContext({
      model,
      entityLogicalName: "contact",
      entitySetName: "contacts",
      fields: [{
        logicalName: "ownerid",
        displayName: "Owner",
        attributeType: "Owner",
        lookupTargets: ["owner"]
      }],
      relationships: [{
        navigationPropertyName: "ownerid",
        referencingAttribute: "ownerid",
        referencingEntity: "contact",
        referencedEntity: "owner"
      }],
      entityDefinitions: [{
        logicalName: "owner",
        entitySetName: "owners",
        displayName: "Owner",
        primaryNameAttribute: "name"
      }]
    });
    const lookup = validateLookupTargetDisplayFields(
      context.lookupUnderstandings[0],
      new Map([["owner", [{ logicalName: "name", isValidForRead: true }]]])
    );
    const suggestions = buildLookupDiscoverySuggestions(source, lookup);

    assert.strictEqual(lookup.kind, "Owner");
    assert.strictEqual(lookup.targetEntities[0].primaryNameAttributeState, "NotApplicable");
    assert.strictEqual(lookup.targetEntities[0].primaryNameAttribute, undefined);
    assert.ok(suggestions.some((item) => item.query === "contacts?$select=_ownerid_value&$expand=ownerid"));
    assert.ok(suggestions.every((item) => !item.query.includes("$select=name")));
    assert.match(buildLookupReferenceText(lookup), /principal abstraction/i);
    assert.match(buildLookupReferenceText(lookup), /Formatted value: _ownerid_value@OData\.Community\.Display\.V1\.FormattedValue/);
  });

  test("copies a metadata-backed lookup reference with validated targets and annotations", () => {
    const { context } = contextFor("sample_workitems");
    const actions = buildLookupDiscoveryActions("sample_workitems", context.lookupUnderstandings[0]);
    const copyAction = actions.find((action) => action.actionType === "copyReference");
    const reference = copyAction?.referenceText ?? "";

    assert.strictEqual(actions.filter((action) => action.actionType === "copyReference").length, 1);
    assert.match(reference, /Value property: _sample_requester_value/);
    assert.match(reference, /Navigation: sample_Requester_account/);
    assert.match(reference, /Validated display field: name/);
    assert.match(reference, /lookuplogicalname/);
    assert.match(reference, /FormattedValue/);
  });

  test("omits an unreadable or unvalidated target primary-name field", () => {
    const { context } = contextFor("sample_workitems");
    const lookup = validateLookupTargetDisplayFields(
      context.lookupUnderstandings[0],
      new Map([
        ["account", [{ logicalName: "name", isValidForRead: false }]],
        ["contact", [{ logicalName: "fullname", isValidForRead: true }]],
        ["sample_device", []]
      ])
    );
    const suggestions = buildLookupDiscoverySuggestions("sample_workitems", lookup);
    const account = suggestions.find((item) => item.targetEntityLogicalName === "account");
    const device = suggestions.find((item) => item.targetEntityLogicalName === "sample_device");

    assert.strictEqual(lookup.targetEntities.find((target) => target.entityLogicalName === "account")?.primaryNameAttributeState, "Unavailable");
    assert.ok(account?.query.includes("$expand=sample_Requester_account"));
    assert.ok(!account?.query.includes("$select=name"));
    assert.ok(device?.query.includes("$expand=sample_Requester_sample_device"));
    assert.ok(!device?.query.includes("$select=sample_name"));
  });

  test("lookup discovery preserves a full URL and unrelated query clauses", () => {
    const { context } = contextFor("sample_workitems");
    const source = "https://org.crm.dynamics.com/api/data/v9.2/sample_workitems?$select=sample_name&$filter=statecode eq 0&$orderby=createdon desc&$top=10";
    const suggestions = buildLookupDiscoverySuggestions(source, context.lookupUnderstandings[0]);

    assert.ok(suggestions.every((item) => item.query.startsWith("https://org.crm.dynamics.com/api/data/v9.2/sample_workitems?")));
    assert.ok(suggestions.every((item) => item.query.includes("$select=sample_name,_sample_requester_value")));
    assert.ok(suggestions.every((item) => item.query.includes("$filter=statecode eq 0")));
    assert.ok(suggestions.every((item) => item.query.includes("$orderby=createdon desc")));
    assert.ok(suggestions.every((item) => item.query.includes("$top=10")));
  });

  test("builds canonical outbound target navigation understanding and excludes inbound relationships", () => {
    const lookups = buildLookupUnderstandings({
      sourceLogicalName: "sample_workitem",
      fields,
      relationships,
      entityDefinitions: entities
    });

    assert.strictEqual(lookups.length, 1);
    assert.strictEqual(lookups[0].kind, "MultiTarget");
    assert.strictEqual(lookups[0].lookupValueProperty, "_sample_requester_value");
    assert.deepStrictEqual(
      lookups[0].targetEntities.map((target) => target.entityLogicalName),
      ["account", "contact", "sample_device"]
    );
    assert.ok(!lookups[0].targetEntities.some((target) => target.navigationProperties.some((nav) => nav.name === "sample_workitem_children")));
  });

  test("diagnoses direct polymorphic expansion and emits one deterministic preview per target", () => {
    const source = "/sample_workitems?$select=sample_name&$filter=statecode eq 0&$orderby=createdon desc&$top=10&$expand=sample_requester";
    const { model, context } = contextFor(source);
    const finding = buildMetadataQueryDiagnostics(model, context)
      .find((item) => item.code === "PolymorphicTargetRequired");

    assert.ok(finding);
    assert.deepStrictEqual(finding?.supportedTargets, ["account", "contact", "sample_device"]);
    assert.strictEqual(finding?.suggestedQueries.length, 3);
    assert.ok(finding?.suggestedQueries.every((item) => item.query.includes("$filter=statecode eq 0")));
    assert.ok(finding?.suggestedQueries.every((item) => item.query.includes("$orderby=createdon desc")));
    assert.ok(finding?.suggestedQueries.every((item) => item.query.includes("$top=10")));
    assert.ok(finding?.suggestedQueries.some((item) => item.query.includes("$expand=sample_Requester_contact($select=fullname)")));
    assert.ok(finding?.suggestedQueries.some((item) => item.query.includes("$expand=sample_Requester_sample_device($select=sample_name)")));
  });

  test("corrects scalar lookup selection and filtering while preserving a full URL", () => {
    const source = "https://org.crm.dynamics.com/api/data/v9.2/sample_workitems?$select=sample_name,sample_requester&$filter=sample_requester eq 00000000-0000-0000-0000-000000000001&$top=5";
    const { model, context } = contextFor(source);
    const findings = buildMetadataQueryDiagnostics(model, context);
    const selectFix = findings.find((item) => item.ruleId === "lookup.use-value-property-in-select")?.suggestedQueries[0]?.query;
    const filterFix = findings.find((item) => item.ruleId === "lookup.filter-on-value-property")?.suggestedQueries[0]?.query;

    assert.ok(selectFix?.startsWith("https://org.crm.dynamics.com/api/data/v9.2/sample_workitems?"));
    assert.ok(selectFix?.includes("$select=sample_name,_sample_requester_value"));
    assert.ok(filterFix?.includes("$filter=_sample_requester_value eq 00000000-0000-0000-0000-000000000001"));
    assert.ok(filterFix?.endsWith("&$top=5"));
  });

  test("explains that a valid target-specific expansion may be null at runtime", () => {
    const { model, context } = contextFor("sample_workitems?$select=sample_name&$expand=sample_Requester_account($select=name)");
    const finding = buildMetadataQueryDiagnostics(model, context)
      .find((item) => item.code === "ValidTargetMayReturnNull");

    assert.ok(finding);
    assert.strictEqual(finding?.severity, "warning");
    assert.match(finding?.message ?? "", /another supported target may return null/i);
  });

  test("flags an unsupported target-like navigation without guessing a property", () => {
    const { model, context } = contextFor("sample_workitems?$expand=sample_Requester_systemuser($select=fullname)");
    const finding = buildMetadataQueryDiagnostics(model, context)
      .find((item) => item.code === "UnsupportedLookupTarget");

    assert.ok(finding);
    assert.ok(finding?.suggestedQueries.every((item) => !item.query.includes("sample_Requester_systemuser")));
  });

  test("uses the one metadata navigation property for a single-target lookup", () => {
    const parsed = parseDataverseQuery("accounts?$expand=primarycontactid");
    const model = buildQuerySemanticModel(parsed);
    const context = buildQueryMetadataContext({
      model,
      entityLogicalName: "account",
      fields: [{ logicalName: "primarycontactid", attributeType: "Lookup", lookupTargets: ["contact"] }],
      relationships: [{
        navigationPropertyName: "primarycontactid",
        referencingAttribute: "primarycontactid",
        referencingEntity: "account",
        referencedEntity: "contact"
      }],
      entityDefinitions: entities
    });
    const lookup = context.lookupUnderstandings[0];

    assert.strictEqual(lookup.kind, "SingleTarget");
    assert.strictEqual(lookup.targetEntities[0].navigationProperties[0].name, "primarycontactid");
    assert.ok(!buildMetadataQueryDiagnostics(model, context).some((item) => item.severity === "error"));
  });

  test("projects metadata diagnostics through the shared deterministic recommendation contract", () => {
    const { model, context } = contextFor("sample_workitems?$select=_sample_requester_value&$expand=sample_requester");
    const diagnostics = buildMetadataQueryDiagnostics(model, context);
    const first = buildMetadataQueryRecommendations(diagnostics);
    const second = buildMetadataQueryRecommendations([...diagnostics, ...diagnostics]);

    assert.deepStrictEqual(second, first);
    assert.strictEqual(first[0].priority, "High");
    assert.strictEqual(first[0].category, "Lookup");
    assert.match(first[0].id, /^metadata-recommendation:/);
    assert.ok(first[0].evidenceRefs.some((item) => item.startsWith("relationship:")));
  });
});
