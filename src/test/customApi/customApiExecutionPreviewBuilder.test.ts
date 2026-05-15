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
    assert.equal(preview.pathTemplate, "/{entity-set-for-account}({record-id})/new_GetStatus(CorrelationId=@CorrelationId)?@CorrelationId='00000000-0000-0000-0000-000000000000'");
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
      "Operation",
      "Request preview",
      "Request body template",
      "Execution policy",
      "Parameters",
      "Parameter input guidance",
      "Notes"
    ]);
    assert.match(sections[0].content, /Mode: Preview only/);
    assert.match(sections[0].content, /Execution state: Preview-only; no Dataverse operation will be executed from this surface/);
    assert.match(sections[0].content, /Environment authority: No executable authority is created by this preview/);
    assert.match(sections[2].content, /POST .*Microsoft\.Dynamics\.CRM\.new_TestOperation/);
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

    assert.match(sections[0].content, /Execution state: Action preview-ready; POST execution is not enabled in this workstream/);
    assert.match(sections[0].content, /Environment authority: No executable authority is created by this preview/);
    assert.match(sections[1].content, /Capability: Action execution eligible/);
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
        label: "Preview / run Action",
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
