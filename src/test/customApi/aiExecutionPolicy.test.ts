import assert from "node:assert/strict";
import { suite, test } from "mocha";
import { isAiRelatedCustomApiOperation } from "../../customApi/execution/aiOperationClassifier.js";
import { evaluateAiExecutionPolicy, normalizeAiExecutionPolicy } from "../../customApi/execution/aiExecutionPolicy.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";

function buildDefinition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_TestAction",
    displayName: "Test Action",
    operationKind: "Action",
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
      odataQualifiedName: "Microsoft.Dynamics.CRM.new_TestAction",
      odataInvocationName: "new_TestAction"
    },
    ...overrides
  };
}

suite("aiExecutionPolicy", () => {
  test("classifies known AI operations deterministically", () => {
    assert.equal(isAiRelatedCustomApiOperation(buildDefinition({ uniqueName: "AIReply" })), true);
    assert.equal(isAiRelatedCustomApiOperation(buildDefinition({ displayName: "Summarize with Copilot" })), true);
    assert.equal(isAiRelatedCustomApiOperation(buildDefinition({ description: "Generate response using GPT" })), true);
    assert.equal(isAiRelatedCustomApiOperation(buildDefinition({ uniqueName: "new_CreateOrder" })), false);
  });

  test("defaults AI execution policy to deny", () => {
    assert.equal(normalizeAiExecutionPolicy(undefined), "deny");
    assert.equal(normalizeAiExecutionPolicy("unexpected"), "deny");
    assert.equal(normalizeAiExecutionPolicy("allow"), "allow");
  });

  test("blocks AI-related operations by default", () => {
    const decision = evaluateAiExecutionPolicy(buildDefinition({ uniqueName: "AIReply" }));

    assert.equal(decision.classification, "ai-related");
    assert.equal(decision.allowed, false);
    assert.equal(decision.severity, "blocked");
  });

  test("allows AI-related operations only after explicit policy opt-in", () => {
    const decision = evaluateAiExecutionPolicy(buildDefinition({ uniqueName: "AIReply" }), { aiPolicy: "allow" });

    assert.equal(decision.classification, "ai-related");
    assert.equal(decision.allowed, true);
    assert.equal(decision.severity, "warning");
  });
});
