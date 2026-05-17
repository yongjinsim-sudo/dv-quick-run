import assert from "node:assert/strict";
import { suite, test } from "mocha";
import { resolveActionExecutionReadiness } from "../../customApi/execution/actionExecutionReadiness.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";

function buildAction(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_ProcessThing",
    displayName: "Process Thing",
    operationKind: "Action",
    bindingKind: "Unbound",
    isPrivate: false,
    requestParameters: [],
    responseProperties: [],
    executionReadiness: "preview-ready",
    executionReadinessLabel: "Preview-ready",
    executionReadinessReason: "All parameters are preview-ready.",
    executionEligibility: {
      state: "executable",
      label: "Executable via OData metadata",
      reason: "Matched an ActionImport.",
      odataQualifiedName: "Microsoft.Dynamics.CRM.new_ProcessThing",
      odataInvocationName: "new_ProcessThing"
    },
    ...overrides
  };
}

suite("actionExecutionReadiness", () => {
  test("marks public OData-exposed unbound Actions as ready", () => {
    const readiness = resolveActionExecutionReadiness(buildAction());

    assert.equal(readiness.state, "ready");
    assert.equal(readiness.canPreview, true);
    assert.equal(readiness.canExecute, true);
    assert.deepEqual(readiness.reasonCodes, ["PublicODataAction", "SimplePreviewReadyParameters"]);
  });

  test("marks destructive-looking metadata-valid Actions as ready with caution", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      uniqueName: "new_delete_blah",
      displayName: "Delete Blah"
    }));

    assert.equal(readiness.state, "readyWithCaution");
    assert.equal(readiness.canExecute, true);
    assert.equal(readiness.caution, true);
    assert.equal(readiness.requiresTypedConfirmation, true);
    assert.equal(readiness.confirmationPhrase, "NEW_DELETE_BLAH");
    assert.ok(readiness.reasonCodes.includes("PotentialDestructiveOperation"));
  });

  test("blocks AI-related Actions when policy denies execution", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      uniqueName: "AIReply",
      displayName: "AIReply"
    }));

    assert.equal(readiness.state, "blockedByPolicy");
    assert.equal(readiness.canPreview, true);
    assert.equal(readiness.canExecute, false);
    assert.deepEqual(readiness.reasonCodes, ["AiPolicyDenied"]);
  });

  test("allows AI-related Actions with caution when policy is explicitly allowed", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      uniqueName: "AIReply",
      displayName: "AIReply"
    }), { aiPolicy: "allow" });

    assert.equal(readiness.state, "readyWithCaution");
    assert.equal(readiness.canExecute, true);
    assert.ok(readiness.reasonCodes.includes("GeneratedContentAdvisoryRequired"));
  });

  test("keeps bound Actions inspect-only", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      bindingKind: "Bound",
      boundEntityLogicalName: "account",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Preview only — bound context required",
        reason: "Selected row context is required."
      }
    }));

    assert.equal(readiness.state, "inspectOnlyUnsupportedBinding");
    assert.equal(readiness.canExecute, false);
    assert.deepEqual(readiness.reasonCodes, ["BoundActionDeferred"]);
  });

  test("classifies complex parameters as inspect-only unsupported parameters", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      executionReadiness: "inspect-only",
      executionReadinessReason: "Entity payloads need explicit payload shaping.",
      requestParameters: [{
        uniqueName: "Target",
        typeLabel: "EntityReference",
        executionSupport: "inspect-only"
      }],
      executionEligibility: {
        state: "preview-only-unsupported-parameters",
        label: "Preview only — unsupported parameters",
        reason: "Complex parameters are not execution-ready."
      }
    }));

    assert.equal(readiness.state, "inspectOnlyUnsupportedParameters");
    assert.equal(readiness.canExecute, false);
    assert.ok(readiness.reasonCodes.includes("EntityReferenceParameter"));
    assert.equal(readiness.parameterTrust[0]?.state, "unsupportedEntityReference");
  });
});
