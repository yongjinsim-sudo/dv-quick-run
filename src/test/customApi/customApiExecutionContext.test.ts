import assert from "node:assert/strict";
import { suite, test } from "mocha";
import {
  buildCapabilityExecutionContextFromPreview,
  buildCapabilityExecutionContextFromResult,
  buildCapabilityExecutionInvestigationPatch
} from "../../customApi/execution/customApiExecutionContext.js";
import type { CustomApiFunctionExecutionPlan } from "../../customApi/execution/customApiFunctionExecution.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import type { DataverseGetResult } from "../../services/dataverseClient.js";

function buildDefinition(): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_CalculateScore",
    displayName: "Calculate Score",
    operationKind: "Function",
    bindingKind: "Unbound",
    requestParameters: [
      {
        uniqueName: "ContactId",
        typeLabel: "Guid",
        executionSupport: "preview-ready"
      }
    ],
    responseProperties: [
      {
        uniqueName: "Score",
        typeLabel: "Integer"
      }
    ],
    executionCapability: {
      mode: "executable",
      state: "executable",
      label: "Executable",
      reason: "Matched in OData metadata.",
      canPreview: true,
      canExecute: true,
      executionMethod: "GET",
      operationKind: "Function",
      bindingKind: "Unbound"
    },
    executionEligibility: {
      state: "executable",
      label: "Executable via OData metadata",
      reason: "Matched in OData metadata."
    }
  };
}

function buildPlan(): CustomApiFunctionExecutionPlan {
  return {
    path: "/new_CalculateScore(ContactId=@ContactId)?@ContactId='00000000-0000-0000-0000-000000000000'",
    method: "GET",
    values: {
      ContactId: "00000000-0000-0000-0000-000000000000"
    },
    requestPreview: "GET https://example.crm.dynamics.com/api/data/v9.2/new_CalculateScore(...) HTTP/1.1"
  };
}

suite("customApiExecutionContext", () => {
  test("builds preview context without implying Dataverse execution", () => {
    const context = buildCapabilityExecutionContextFromPreview({
      definition: buildDefinition(),
      executionPlan: buildPlan(),
      values: { ContactId: "00000000-0000-0000-0000-000000000000" },
      environmentName: "DEV",
      now: () => "2026-05-14T00:00:00.000Z"
    });

    assert.equal(context.kind, "customApiExecution");
    assert.equal(context.status, "previewed");
    assert.equal(context.operationUniqueName, "new_CalculateScore");
    assert.equal(context.method, "GET");
    assert.deepEqual(context.parameterNames, ["ContactId"]);
    assert.match(context.notes.join("\n"), /No Dataverse operation was executed/);
  });

  test("builds completed context with execution anchors", () => {
    const result: DataverseGetResult<unknown> = {
      data: { Score: 10 },
      executionContext: {
        method: "GET",
        path: "/new_CalculateScore()",
        url: "https://example.crm.dynamics.com/api/data/v9.2/new_CalculateScore()",
        statusCode: 200,
        durationMs: 321,
        timestamp: "2026-05-14T00:01:00.000Z",
        requestId: "request-1",
        correlationId: "correlation-1",
        operationId: "operation-1"
      }
    };

    const context = buildCapabilityExecutionContextFromResult({
      definition: buildDefinition(),
      executionPlan: buildPlan(),
      values: { ContactId: "00000000-0000-0000-0000-000000000000" },
      result,
      environmentName: "SIT"
    });

    assert.equal(context.status, "completed");
    assert.equal(context.statusCode, 200);
    assert.equal(context.requestId, "request-1");
    assert.equal(context.correlationId, "correlation-1");
    assert.equal(context.operationId, "operation-1");
  });

  test("converts execution context into investigation patch", () => {
    const context = buildCapabilityExecutionContextFromPreview({
      definition: buildDefinition(),
      executionPlan: buildPlan(),
      environmentName: "DEV",
      now: () => "2026-05-14T00:00:00.000Z"
    });

    const patch = buildCapabilityExecutionInvestigationPatch(context, "https://example.crm.dynamics.com");

    assert.equal(patch.source, "capabilityExplorer");
    assert.equal(patch.environmentName, "DEV");
    assert.equal(patch.environmentUrl, "https://example.crm.dynamics.com");
    assert.equal(patch.capabilityExecution?.operationUniqueName, "new_CalculateScore");
    assert.equal(patch.capabilityExecution?.status, "previewed");
    assert.equal(patch.surfaceState?.recoverable, true);
  });
});
