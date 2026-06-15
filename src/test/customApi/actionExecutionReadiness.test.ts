import assert from "node:assert/strict";
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



  test("keeps entity-bound Actions inspect-only with target-required reason", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      bindingKind: "Bound",
      boundTargetKind: "entity",
      boundEntityLogicalName: "account",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Entity-bound execution requires explicit target row context.",
        odataBoundTargetKind: "entity",
        odataBoundEntityLogicalName: "account"
      }
    }));

    assert.equal(readiness.state, "inspectOnlyUnsupportedBinding");
    assert.equal(readiness.label, "Inspect only — target row required");
    assert.deepEqual(readiness.reasonCodes, ["EntityBoundActionRequiresTarget"]);
  });

  test("marks collection-bound Actions executable when route and parameters are supported", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      bindingKind: "Bound",
      boundTargetKind: "collection",
      boundEntityLogicalName: "account",
      boundEntitySetName: "accounts",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Preview-ready — collection-bound Action",
        reason: "Collection-bound execution is available after confirmation.",
        odataBoundTargetKind: "collection",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts"
      }
    }));

    assert.equal(readiness.state, "ready");
    assert.equal(readiness.label, "Ready to run collection-bound Action");
    assert.equal(readiness.canExecute, true);
    assert.ok(readiness.reasonCodes.includes("CollectionBoundAction"));
    assert.ok(readiness.reasonCodes.includes("BoundRouteResolved"));
  });

  test("classifies EntityReference parameters as supported when preview-ready", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      executionReadiness: "preview-ready",
      executionReadinessReason: "EntityReference payloads are preview-ready.",
      requestParameters: [{
        uniqueName: "Target",
        typeLabel: "EntityReference",
        executionSupport: "preview-ready"
      }],
      executionEligibility: {
        state: "executable",
        label: "Executable via OData metadata",
        reason: "Matched an ActionImport."
      }
    }));

    assert.equal(readiness.state, "ready");
    assert.equal(readiness.canExecute, true);
    assert.ok(readiness.reasonCodes.includes("EntityReferenceParameter"));
    assert.equal(readiness.parameterTrust[0]?.state, "supportedEntityReference");
  });
});

suite("actionExecutionReadiness bound target validation", () => {
  test("marks entity-bound Actions with a valid target as target captured but still inspect-only", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      bindingKind: "Bound",
      boundTargetKind: "entity",
      boundEntityLogicalName: "account",
      boundEntitySetName: "accounts",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Entity-bound execution requires explicit target row context.",
        odataBoundTargetKind: "entity",
        odataBoundEntityLogicalName: "account",
        odataBoundEntitySetName: "accounts"
      }
    }), {
      boundTargetValidation: {
        valid: true,
        normalizedRowId: "11111111-1111-1111-1111-111111111111",
        entityLogicalName: "account",
        entitySetName: "accounts",
        bindingKind: "entity",
        reasonCodes: ["BoundEntityAction"],
        label: "Bound target valid",
        reason: "The target is valid."
      }
    });

    assert.equal(readiness.state, "ready");
    assert.equal(readiness.label, "Ready to run bound Action");
    assert.equal(readiness.canPreview, true);
    assert.equal(readiness.canExecute, true);
    assert.ok(readiness.reasonCodes.includes("BoundEntityAction"));
    assert.ok(readiness.reasonCodes.includes("BoundRouteResolved"));
  });

  test("uses bound target validation reason when route metadata is unavailable", () => {
    const readiness = resolveActionExecutionReadiness(buildAction({
      bindingKind: "Bound",
      boundTargetKind: "entity",
      boundEntityLogicalName: "workflow",
      executionEligibility: {
        state: "preview-only-bound-context-required",
        label: "Inspect only — target row required",
        reason: "Entity-bound execution requires explicit target row context.",
        odataBoundTargetKind: "entity",
        odataBoundEntityLogicalName: "workflow"
      }
    }), {
      boundTargetValidation: {
        valid: false,
        entityLogicalName: "workflow",
        entitySetName: "",
        bindingKind: "entity",
        reasonCodes: ["BoundRouteUnavailable"],
        label: "Inspect only — bound route unavailable",
        reason: "The bound entity set could not be resolved from metadata."
      }
    });

    assert.equal(readiness.state, "inspectOnlyUnsupportedBinding");
    assert.equal(readiness.label, "Inspect only — bound route unavailable");
    assert.deepEqual(readiness.reasonCodes, ["BoundRouteUnavailable"]);
  });
});
