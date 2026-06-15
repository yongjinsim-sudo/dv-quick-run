import assert from "node:assert/strict";
import {
  canExecuteCustomApiDefinition,
  resolveCustomApiExecutionCapability,
  withCustomApiExecutionCapability
} from "../../customApi/execution/customApiExecutionCapabilityResolver.js";
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

suite("customApiExecutionCapabilityResolver", () => {
  test("marks only OData-validated unbound Functions as executable", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition());

    assert.equal(capability.mode, "executable");
    assert.equal(capability.canPreview, true);
    assert.equal(capability.canExecute, true);
    assert.equal(capability.executionMethod, "GET");
    assert.equal(canExecuteCustomApiDefinition(buildDefinition()), true);
  });

  test("marks OData-validated unbound Actions as executable through the Action pipeline", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition({
      operationKind: "Action",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataQualifiedName: "Microsoft.Dynamics.CRM.new_TestAction",
        odataInvocationName: "new_TestAction"
      }
    }));

    assert.equal(capability.mode, "executable");
    assert.equal(capability.label, "Ready to run");
    assert.equal(capability.canPreview, true);
    assert.equal(capability.canExecute, true);
    assert.equal(capability.executionMethod, "POST");
    assert.equal(canExecuteCustomApiDefinition(buildDefinition({
      operationKind: "Action",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataQualifiedName: "Microsoft.Dynamics.CRM.new_TestAction",
        odataInvocationName: "new_TestAction"
      }
    })), true);
  });

  test("keeps private Actions inspectable even when OData eligible", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition({
      operationKind: "Action",
      isPrivate: true,
      executionEligibility: {
        state: "preview-only-private",
        label: "Inspect only — private API",
        reason: "Private operations remain inspect-only."
      }
    }));

    assert.equal(capability.mode, "preview-only");
    assert.equal(capability.canPreview, true);
    assert.equal(capability.canExecute, false);
  });

  test("keeps unsupported parameter operations inspect-only", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition({
      executionReadiness: "inspect-only",
      executionReadinessReason: "Entity payloads need explicit payload shaping.",
      requestParameters: [{ uniqueName: "Target", typeLabel: "Entity", executionSupport: "inspect-only" }],
      executionEligibility: {
        state: "preview-only-unsupported-parameters",
        label: "Preview only — unsupported parameters",
        reason: "Complex parameters are not execution-ready."
      }
    }));

    assert.equal(capability.mode, "inspect-only");
    assert.equal(capability.canPreview, true);
    assert.equal(capability.canExecute, false);
  });

  test("preserves validation-unavailable as preview-only without execution", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition({
      executionEligibility: {
        state: "unknown-validation-unavailable",
        label: "Validation unavailable",
        reason: "OData metadata could not be loaded."
      }
    }));

    assert.equal(capability.mode, "validation-unavailable");
    assert.equal(capability.canPreview, true);
    assert.equal(capability.canExecute, false);
  });

  test("attaches canonical execution capability to definitions", () => {
    const enriched = withCustomApiExecutionCapability(buildDefinition());

    assert.equal(enriched.executionCapability?.mode, "executable");
    assert.equal(enriched.executionCapability?.canExecute, true);
  });

  test("blocks AI-related executable Actions by default policy", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition({
      operationKind: "Action",
      uniqueName: "AIReply",
      displayName: "AIReply",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataQualifiedName: "Microsoft.Dynamics.CRM.AIReply",
        odataInvocationName: "AIReply"
      }
    }));

    assert.equal(capability.mode, "preview-only");
    assert.equal(capability.state, "denied");
    assert.equal(capability.label, "AI execution blocked by policy");
    assert.equal(capability.canPreview, true);
    assert.equal(capability.canExecute, false);
    assert.equal(capability.executionPolicy?.classification, "ai-related");
  });

  test("allows AI-related executable Actions after explicit policy opt-in", () => {
    const capability = resolveCustomApiExecutionCapability(buildDefinition({
      operationKind: "Action",
      uniqueName: "AIReply",
      displayName: "AIReply",
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched in OData metadata.",
        odataQualifiedName: "Microsoft.Dynamics.CRM.AIReply",
        odataInvocationName: "AIReply"
      }
    }), { aiPolicy: "allow" });

    assert.equal(capability.mode, "executable");
    assert.equal(capability.canExecute, true);
    assert.equal(capability.executionMethod, "POST");
    assert.equal(capability.executionPolicy?.allowed, true);
  });
});
