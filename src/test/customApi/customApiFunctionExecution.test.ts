import assert from "node:assert/strict";
import { suite, test } from "mocha";
import {
  buildCustomApiActionExecutionPath,
  buildCustomApiActionExecutionPlan,
  buildCustomApiFunctionExecutionPath,
  buildCustomApiFunctionExecutionPlan,
  canExecuteCustomApiAction,
  canExecuteCustomApiFunction
} from "../../customApi/execution/customApiFunctionExecution.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";

function buildDefinition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_TestFunction",
    displayName: "Test Function",
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
      odataQualifiedName: "Microsoft.Dynamics.CRM.new_TestFunction",
      odataInvocationName: "new_TestFunction"
    },
    ...overrides
  };
}

suite("customApiFunctionExecution", () => {
  test("allows only preview-ready unbound functions", () => {
    assert.equal(canExecuteCustomApiFunction(buildDefinition()), true);
    assert.equal(canExecuteCustomApiFunction(buildDefinition({ operationKind: "Action" })), false);
    assert.equal(canExecuteCustomApiFunction(buildDefinition({ bindingKind: "Bound", boundEntityLogicalName: "account" })), false);
    assert.equal(canExecuteCustomApiFunction(buildDefinition({ executionReadiness: "partial" })), false);
    assert.equal(canExecuteCustomApiFunction(buildDefinition({
      executionEligibility: {
        state: "preview-only-not-found",
        label: "Preview only — not found in OData metadata",
        reason: "Not found."
      }
    })), false);
    assert.equal(canExecuteCustomApiFunction(buildDefinition({
      requestParameters: [{ uniqueName: "Target", typeLabel: "Entity", executionSupport: "inspect-only" }]
    })), false);
  });

  test("builds an executable unbound function path without parameters", () => {
    assert.equal(
      buildCustomApiFunctionExecutionPath(buildDefinition(), {}),
      "/new_TestFunction()"
    );
  });

  test("builds an executable unbound function path with aliases", () => {
    const definition = buildDefinition({
      requestParameters: [
        { uniqueName: "Text", typeLabel: "String", executionSupport: "preview-ready", isOptional: false },
        { uniqueName: "IncludeDetails", typeLabel: "Boolean", executionSupport: "preview-ready", isOptional: true }
      ]
    });

    assert.equal(
      buildCustomApiFunctionExecutionPath(definition, { Text: "hello world", IncludeDetails: true }),
      "/new_TestFunction(Text=@Text,IncludeDetails=@IncludeDetails)?@Text='hello%20world'&@IncludeDetails=true"
    );
  });

  test("builds a function execution plan with an HTTP preview", () => {
    const plan = buildCustomApiFunctionExecutionPlan(
      buildDefinition(),
      {},
      "https://example.crm.dynamics.com"
    );

    assert.equal(plan.path, "/new_TestFunction()");
    assert.equal(plan.method, "GET");
    assert.match(plan.requestPreview, /^GET https:\/\/example\.crm\.dynamics\.com\/api\/data\/v9\.2\/new_TestFunction\(\) HTTP\/1\.1/);
  });

  test("allows only preview-ready public unbound Actions for POST execution", () => {
    const action = buildDefinition({
      operationKind: "Action",
      uniqueName: "new_TestAction",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataQualifiedName: "Microsoft.Dynamics.CRM.new_TestAction",
        odataInvocationName: "new_TestAction"
      }
    });

    assert.equal(canExecuteCustomApiAction(action), true);
    assert.equal(canExecuteCustomApiAction(buildDefinition({ operationKind: "Action", bindingKind: "Bound", boundEntityLogicalName: "account" })), false);
    assert.equal(canExecuteCustomApiAction(buildDefinition({ operationKind: "Action", isPrivate: true })), false);
    assert.equal(canExecuteCustomApiFunction(action), false);
  });

  test("builds an Action execution plan with POST body", () => {
    const action = buildDefinition({
      operationKind: "Action",
      uniqueName: "new_TestAction",
      requestParameters: [
        { uniqueName: "Text", typeLabel: "String", executionSupport: "preview-ready", isOptional: false }
      ],
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataQualifiedName: "Microsoft.Dynamics.CRM.new_TestAction",
        odataInvocationName: "new_TestAction"
      }
    });

    assert.equal(buildCustomApiActionExecutionPath(action), "/new_TestAction");
    const plan = buildCustomApiActionExecutionPlan(action, { Text: "hello" }, "https://example.crm.dynamics.com");

    assert.equal(plan.path, "/new_TestAction");
    assert.equal(plan.method, "POST");
    assert.deepEqual(plan.body, { Text: "hello" });
    assert.match(plan.requestPreview, /^POST https:\/\/example\.crm\.dynamics\.com\/api\/data\/v9\.2\/new_TestAction HTTP\/1\.1/);
    assert.match(plan.requestPreview, /"Text": "hello"/);
  });
});
