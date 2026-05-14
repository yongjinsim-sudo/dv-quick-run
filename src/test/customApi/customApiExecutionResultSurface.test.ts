import assert from "node:assert/strict";
import { suite, test } from "mocha";
import {
  buildCustomApiExecutionErrorSurfaceSections,
  buildCustomApiExecutionResultSurfaceSections
} from "../../customApi/execution/customApiExecutionResultSurface.js";
import type { CustomApiFunctionExecutionPlan } from "../../customApi/execution/customApiFunctionExecution.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import type { DataverseGetResult } from "../../services/dataverseClient.js";

function buildDefinition(): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "IsCDS3Ready",
    displayName: "Is CDS3 Ready",
    operationKind: "Function",
    bindingKind: "Unbound",
    requestParameters: [],
    responseProperties: [],
    executionReadiness: "preview-ready",
    executionReadinessLabel: "Preview-ready",
    executionReadinessReason: "All parameters are preview-ready.",
    executionEligibility: {
      state: "executable",
      label: "Executable via OData metadata",
      reason: "Matched in OData metadata.",
      odataName: "Microsoft.Dynamics.CRM.IsCDS3Ready",
      odataInvocationName: "IsCDS3Ready"
    }
  };
}

function buildPlan(): CustomApiFunctionExecutionPlan {
  return {
    path: "/IsCDS3Ready()",
    values: {},
    requestPreview: "GET https://example.crm.dynamics.com/api/data/v9.2/IsCDS3Ready() HTTP/1.1"
  };
}

function buildResult(): DataverseGetResult<unknown> {
  return {
    data: {
      IsReady: false
    },
    executionContext: {
      method: "GET",
      path: "/IsCDS3Ready()",
      url: "https://example.crm.dynamics.com/api/data/v9.2/IsCDS3Ready()",
      statusCode: 200,
      durationMs: 123,
      timestamp: "2026-05-13T00:00:00.000Z",
      requestId: "request-1",
      correlationId: "correlation-1"
    }
  };
}

suite("customApiExecutionResultSurface", () => {
  test("builds a structured success result surface", () => {
    const sections = buildCustomApiExecutionResultSurfaceSections({
      definition: buildDefinition(),
      executionPlan: buildPlan(),
      values: {},
      result: buildResult(),
      environmentName: "SIT"
    });

    assert.deepEqual(sections.map((section) => section.title), [
      "Summary",
      "Operation",
      "Request",
      "Execution values",
      "Response payload",
      "Diagnostics",
      "Capability execution context",
      "Raw execution context"
    ]);
    assert.match(sections[0].content, /Status: Completed/);
    assert.match(sections[0].content, /HTTP status: 200/);
    assert.match(sections[4].content, /"IsReady": false/);
    assert.match(sections[5].content, /validated against the OData \$metadata operation registry/);
    assert.match(sections[6].content, /"kind": "customApiExecution"/);
    assert.match(sections[6].content, /"operationUniqueName": "IsCDS3Ready"/);
  });

  test("builds a structured error result surface", () => {
    const sections = buildCustomApiExecutionErrorSurfaceSections({
      definition: buildDefinition(),
      executionPlan: buildPlan(),
      values: {},
      errorMessage: "Dataverse error 404 for GET https://example: not found",
      environmentName: "SIT"
    });

    assert.deepEqual(sections.map((section) => section.title), [
      "Summary",
      "Operation",
      "Request",
      "Execution values",
      "Error payload",
      "Diagnostics",
      "Capability execution context"
    ]);
    assert.match(sections[0].content, /Status: Failed/);
    assert.match(sections[0].content, /HTTP status: 404/);
    assert.match(sections[4].content, /not found/);
    assert.match(sections[6].content, /"status": "failed"/);
  });
});
