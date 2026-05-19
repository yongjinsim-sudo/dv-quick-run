import assert from "node:assert/strict";
import { suite, test } from "mocha";
import { buildCustomApiExecutionPreview, buildCustomApiExecutionPreviewSurfaceSections } from "../../customApi/execution/customApiExecutionPreviewBuilder.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";

function buildDefinition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_TestOperation",
    displayName: "Test Operation",
    description: "Test operation description",
    operationKind: "Action",
    bindingKind: "Unbound",
    requestParameters: [],
    responseProperties: [],
    executionReadinessLabel: "Preview-ready",
    executionReadinessReason: "All parameters are preview-ready.",
    ...overrides
  };
}

suite("customApiExecutionPreviewBuilder", () => {
  test("builds an unbound action preview with a POST body", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      requestParameters: [
        {
          uniqueName: "Name",
          type: "10",
          typeLabel: "String",
          executionSupport: "preview-ready",
          isOptional: false
        },
        {
          uniqueName: "Active",
          type: "0",
          typeLabel: "Boolean",
          executionSupport: "preview-ready",
          isOptional: true
        }
      ]
    }), { environmentUrl: "https://example.crm.dynamics.com" });

    assert.equal(preview.method, "POST");
    assert.equal(preview.requestUrlTemplate, "https://example.crm.dynamics.com/api/data/v9.2/Microsoft.Dynamics.CRM.new_TestOperation");
    assert.deepEqual(preview.requestBody, {
      Name: "<Name>",
      Active: false
    });
  });

  test("builds a bound function preview with a contextual placeholder", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_GetStatus",
      operationKind: "Function",
      bindingKind: "Bound",
      boundEntityLogicalName: "account",
      requestParameters: [
        {
          uniqueName: "CorrelationId",
          type: "12",
          typeLabel: "Guid",
          executionSupport: "preview-ready",
          isOptional: false
        }
      ]
    }));

    assert.equal(preview.method, "GET");
    assert.equal(preview.pathTemplate, "/<entity-set-unresolved>({record-id})/new_GetStatus(CorrelationId=@CorrelationId)?@CorrelationId='00000000-0000-0000-0000-000000000000'");
    assert.equal(preview.queryParameterTemplate, "");
    assert.equal(preview.requestBody, undefined);
  });


  test("builds an unbound function preview using executable function request shape", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_TestFunction",
      operationKind: "Function",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataInvocationName: "new_TestFunction"
      }
    }), { environmentUrl: "https://example.crm.dynamics.com" });

    assert.equal(preview.method, "GET");
    assert.equal(preview.requestUrlTemplate, "https://example.crm.dynamics.com/api/data/v9.2/new_TestFunction()");
    assert.equal(preview.pathTemplate, "/new_TestFunction()");
  });

  test("builds an unbound function preview using OData alias parameter shape", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_Search",
      operationKind: "Function",
      requestParameters: [
        { uniqueName: "Text", type: "10", typeLabel: "String", executionSupport: "preview-ready", isOptional: false },
        { uniqueName: "IncludeInactive", type: "0", typeLabel: "Boolean", executionSupport: "preview-ready", isOptional: true }
      ],
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataInvocationName: "new_Search"
      }
    }));

    assert.equal(preview.pathTemplate, "/new_Search(Text=@Text,IncludeInactive=@IncludeInactive)?@Text='<Text>'&@IncludeInactive=false");
    assert.equal(preview.queryParameterTemplate, "");
  });

  test("builds a bound action preview using metadata-derived entity set route", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_BoundAccountAction",
      operationKind: "Action",
      bindingKind: "Bound",
      boundEntityLogicalName: "account",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Bound target required.",
        odataInvocationName: "Microsoft.Dynamics.CRM.new_BoundAccountAction",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts",
        odataBindingParameterName: "entity"
      }
    }), { environmentUrl: "https://example.crm.dynamics.com" });

    assert.equal(preview.method, "POST");
    assert.equal(preview.boundEntitySetName, "accounts");
    assert.equal(preview.bindingParameterName, "entity");
    assert.equal(preview.pathTemplate, "/accounts({record-id})/Microsoft.Dynamics.CRM.new_BoundAccountAction");
    assert.equal(preview.requestUrlTemplate, "https://example.crm.dynamics.com/api/data/v9.2/accounts({record-id})/Microsoft.Dynamics.CRM.new_BoundAccountAction");
  });


  test("builds a collection-bound action preview without an entity record placeholder", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_CollectionAction",
      operationKind: "Action",
      bindingKind: "Bound",
      boundTargetKind: "collection",
      boundEntityLogicalName: "account",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Preview-ready — collection-bound Action",
        reason: "Collection-bound Action execution is deferred.",
        odataInvocationName: "Microsoft.Dynamics.CRM.new_CollectionAction",
        odataBoundTargetKind: "collection",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts",
        odataBindingParameterName: "entityset"
      }
    }), { environmentUrl: "https://example.crm.dynamics.com" });

    assert.equal(preview.method, "POST");
    assert.equal(preview.boundEntitySetName, "accounts");
    assert.equal(preview.bindingParameterName, "entityset");
    assert.equal(preview.pathTemplate, "/accounts/Microsoft.Dynamics.CRM.new_CollectionAction");
    assert.equal(preview.requestUrlTemplate, "https://example.crm.dynamics.com/api/data/v9.2/accounts/Microsoft.Dynamics.CRM.new_CollectionAction");
  });



  test("uses explicit entity-bound target row id in the preview route", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_BoundAccountAction",
      operationKind: "Action",
      bindingKind: "Bound",
      boundTargetKind: "entity",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Bound target required.",
        odataInvocationName: "Microsoft.Dynamics.CRM.new_BoundAccountAction",
        odataBoundTargetKind: "entity",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts",
        odataBindingParameterName: "entity"
      }
    }), {
      environmentUrl: "https://example.crm.dynamics.com",
      boundTargetRowId: "11111111-2222-3333-4444-555555555555"
    });

    assert.equal(preview.pathTemplate, "/accounts(11111111-2222-3333-4444-555555555555)/Microsoft.Dynamics.CRM.new_BoundAccountAction");
    assert.equal(preview.requestUrlTemplate, "https://example.crm.dynamics.com/api/data/v9.2/accounts(11111111-2222-3333-4444-555555555555)/Microsoft.Dynamics.CRM.new_BoundAccountAction");
    assert.deepEqual(preview.boundTargetContext, {
      entityLogicalName: "account",
      entitySetName: "accounts",
      rowId: "11111111-2222-3333-4444-555555555555",
      source: "manualInput"
    });
  });

  test("renders explicit entity-bound target context in preview sections", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_BoundAccountAction",
      operationKind: "Action",
      bindingKind: "Bound",
      boundTargetKind: "entity",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Bound target required.",
        odataInvocationName: "Microsoft.Dynamics.CRM.new_BoundAccountAction",
        odataBoundTargetKind: "entity",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts",
        odataBindingParameterName: "entity"
      }
    }), { boundTargetRowId: "11111111-2222-3333-4444-555555555555" });
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);
    const joined = sections.map((section) => `${section.title}\n${section.content}`).join("\n");

    assert.match(joined, /Target input source: manualInput/);
    assert.match(joined, /Target entity: account/);
    assert.match(joined, /Target row id: 11111111-2222-3333-4444-555555555555/);
    assert.match(joined, /Execution available after explicit confirmation/);
  });


  test("keeps inspect-only parameters visible in the preview", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      requestParameters: [
        {
          uniqueName: "Target",
          type: "3",
          typeLabel: "Entity",
          executionSupport: "inspect-only",
          executionSupportReason: "Entity payloads need explicit shaping.",
          isOptional: false
        }
      ]
    }));

    assert.equal(preview.unsupportedParameters.length, 1);
    assert.deepEqual(preview.requestBody, {
      Target: "<inspect-only: Entity>"
    });
  });

  test("builds preview-surface sections as preview-only", () => {
    const sections = buildCustomApiExecutionPreviewSurfaceSections(buildCustomApiExecutionPreview(buildDefinition()));

    assert.deepEqual(sections.map((section) => section.title), [
      "Summary",
      "Parameters",
      "Operation metadata",
      "Action execution trust",
      "Request preview",
      "Preview payload state",
      "Execution confirmation shell",
      "Request body template",
      "Execution policy",
      "Parameter input guidance",
      "Notes"
    ]);
    assert.match(sections[0].content, /Execution: Preview-only; no Dataverse operation will be executed from this surface/);
    assert.match(sections[0].content, /Environment authority: No executable authority is created by this preview/);
    assert.match(sections[4].content, /POST .*Microsoft\.Dynamics\.CRM\.new_TestOperation/);
  });

  test("describes unbound Action previews as POST-ready without executable authority", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      operationKind: "Action",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataInvocationName: "new_TestOperation"
      },
      executionCapability: {
        mode: "preview-only",
        state: "preview-ready",
        label: "Action execution eligible",
        reason: "This unbound public Action is preview-ready and matched an ActionImport in the active environment.",
        canPreview: true,
        canExecute: false,
        executionMethod: "POST",
        operationKind: "Action",
        bindingKind: "Unbound"
      }
    }));
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);

    assert.match(sections[0].content, /Execution: Execution available after explicit confirmation/);
    assert.match(sections[0].content, /Environment authority: Execution is restricted to the active environment that generated this preview/);
    assert.match(sections[2].content, /Capability: Action execution eligible/);
  });

  test("uses supplied Action preview parameter values in the POST body", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      requestParameters: [
        { uniqueName: "Text", type: "10", typeLabel: "String", executionSupport: "preview-ready", isOptional: false },
        { uniqueName: "Urgent", type: "0", typeLabel: "Boolean", executionSupport: "preview-ready", isOptional: true },
        { uniqueName: "Target", type: "3", typeLabel: "Entity", executionSupport: "inspect-only", isOptional: false }
      ]
    }), {
      parameterValues: {
        Text: "hello",
        Urgent: true,
        Target: { ignored: true }
      }
    });

    assert.deepEqual(preview.requestBody, {
      Text: "hello",
      Urgent: true,
      Target: "<inspect-only: Entity>"
    });
    assert.equal(preview.parameters[0]?.valueSource, "user-supplied");
    assert.equal(preview.parameters[1]?.valueSource, "user-supplied");
    assert.equal(preview.parameters[2]?.valueSource, "inspect-only");
  });

  test("renders parameter input guidance for supplied and inspect-only values", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      requestParameters: [
        { uniqueName: "Text", type: "10", typeLabel: "String", executionSupport: "preview-ready", isOptional: false },
        { uniqueName: "Target", type: "3", typeLabel: "Entity", executionSupport: "inspect-only", isOptional: false }
      ]
    }), { parameterValues: { Text: "hello" } });
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);
    const guidance = sections.find((section) => section.title === "Parameter input guidance");

    assert.ok(guidance);
    assert.match(guidance.content, /User-supplied preview values: 1/);
    assert.match(guidance.content, /Inspect-only placeholders: 1/);
  });




  test("excludes bound binding parameter from preview body and user-shaped payload", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_BoundAction",
      bindingKind: "Bound",
      boundTargetKind: "entity",
      boundEntityLogicalName: "account",
      boundEntitySetName: "accounts",
      bindingParameterName: "entity",
      requestParameters: [
        { uniqueName: "entity", type: "mscrm.account", typeLabel: "Entity", executionSupport: "preview-ready", isOptional: false },
        { uniqueName: "Name", type: "10", typeLabel: "String", executionSupport: "preview-ready", isOptional: false }
      ]
    }), {
      boundTargetRowId: "11111111-1111-1111-1111-111111111111",
      parameterValues: {
        entity: { shouldBeIgnored: true },
        Name: "Preview name"
      }
    });

    assert.deepEqual(preview.requestBody, { Name: "Preview name" });
    assert.equal(preview.omittedBindingParameterCount, 1);
    assert.equal(preview.parameters.some((parameter) => parameter.name === "entity"), false);
    assert.equal(preview.parameters[0]?.valueSource, "user-supplied");
  });


  test("renders dedicated bound Action preview context and entity-bound wording", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_BoundAccountAction",
      operationKind: "Action",
      bindingKind: "Bound",
      boundTargetKind: "entity",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Bound target required.",
        odataInvocationName: "Microsoft.Dynamics.CRM.new_BoundAccountAction",
        odataBoundTargetKind: "entity",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts",
        odataBindingParameterName: "entity"
      }
    }), { boundTargetRowId: "11111111-2222-3333-4444-555555555555" });
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);
    const context = sections.find((section) => section.title === "Bound Action preview context");
    const notes = sections.find((section) => section.title === "Notes");

    assert.ok(context);
    assert.match(context.content, /Operation type: Bound Action/);
    assert.match(context.content, /Binding kind: entity/);
    assert.match(context.content, /Metadata-derived route: \/accounts\(11111111-2222-3333-4444-555555555555\)\/Microsoft\.Dynamics\.CRM\.new_BoundAccountAction/);
    assert.match(context.content, /Preview authority: This preview is scoped to this operation, route, captured input, and active environment only\./);
    assert.ok(notes);
    assert.match(notes.content, /This operation is entity-bound\. The target row is represented by the metadata-derived route, not by a JSON body field\./);
  });

  test("renders collection-bound wording without selected-record guidance", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "new_CollectionAction",
      operationKind: "Action",
      bindingKind: "Bound",
      boundTargetKind: "collection",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Preview-ready — collection-bound Action",
        reason: "Collection-bound Action execution is deferred.",
        odataInvocationName: "Microsoft.Dynamics.CRM.new_CollectionAction",
        odataBoundTargetKind: "collection",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts",
        odataBindingParameterName: "entityset"
      }
    }));
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);
    const context = sections.find((section) => section.title === "Bound Action preview context");
    const notes = sections.find((section) => section.title === "Notes");

    assert.ok(context);
    assert.match(context.content, /Binding kind: collection/);
    assert.match(context.content, /Target: Collection scope; no row id is required or accepted/);
    assert.ok(notes);
    assert.match(notes.content, /This operation is collection-bound\. The collection route is metadata-derived; no target row id is required or accepted\./);
    assert.doesNotMatch(notes.content, /selected record id/);
  });

  test("renders AI execution policy block in preview sections", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "AIReply",
      displayName: "AIReply",
      operationKind: "Action",
      executionCapability: {
        mode: "preview-only",
        state: "denied",
        label: "AI execution blocked by policy",
        reason: "This operation is classified as AI-related. DV Quick Run blocks AI execution by default.",
        canPreview: true,
        canExecute: false,
        operationKind: "Action",
        bindingKind: "Unbound",
        executionPolicy: {
          policyKind: "aiExecution",
          classification: "ai-related",
          allowed: false,
          severity: "blocked",
          reason: "This operation is classified as AI-related. DV Quick Run blocks AI execution by default."
        }
      }
    }));
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);

    assert.match(sections.map((section) => section.content).join("\n"), /AI execution blocked by policy/);
    assert.match(sections.map((section) => section.content).join("\n"), /Policy: AI execution/);
    assert.match(sections.map((section) => section.content).join("\n"), /Decision: Blocked/);
  });

  test("renders AI advisory when execution is explicitly allowed", () => {
    const preview = buildCustomApiExecutionPreview(buildDefinition({
      uniqueName: "AIReply",
      displayName: "AIReply",
      operationKind: "Action",
      executionCapability: {
        mode: "executable",
        state: "executable",
        label: "Ready to run",
        reason: "This unbound public Action is preview-ready.",
        canPreview: true,
        canExecute: true,
        executionMethod: "POST",
        operationKind: "Action",
        bindingKind: "Unbound",
        executionPolicy: {
          policyKind: "aiExecution",
          classification: "ai-related",
          allowed: true,
          severity: "warning",
          reason: "This operation is classified as AI-related, and AI execution is explicitly allowed by policy.",
          trustModel: "probabilistic-generated-content",
          humanReviewRecommended: true,
          generatedContentWarning: true,
          externalProcessingPossible: true
        }
      }
    }));
    const sections = buildCustomApiExecutionPreviewSurfaceSections(preview);
    const joined = sections.map((section) => `${section.title}\n${section.content}`).join("\n");

    assert.match(joined, /AI-generated content advisory/);
    assert.match(joined, /Trust model: Probabilistic \/ generated content/);
    assert.match(joined, /Generated responses may be inaccurate/);
    assert.match(joined, /Human review: Recommended/);
  });

});
