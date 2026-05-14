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
    assert.equal(preview.pathTemplate, "/{entity-set-for-account}({record-id})/Microsoft.Dynamics.CRM.new_GetStatus(CorrelationId=@CorrelationId)?@CorrelationId='00000000-0000-0000-0000-000000000000'");
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
      "Parameters",
      "Notes"
    ]);
    assert.match(sections[0].content, /Mode: Preview only/);
    assert.match(sections[0].content, /Execution: preview-only/);
    assert.match(sections[2].content, /POST .*Microsoft\.Dynamics\.CRM\.new_TestOperation/);
  });
});
