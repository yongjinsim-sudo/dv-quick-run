import assert from "node:assert/strict";
import { validateBoundActionTarget } from "../../customApi/execution/boundActionTargetValidation.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";

function buildDefinition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_BoundAction",
    displayName: "Bound Action",
    operationKind: "Action",
    bindingKind: "Bound",
    boundTargetKind: "entity",
    boundEntityLogicalName: "account",
    boundEntitySetName: "accounts",
    requestParameters: [],
    responseProperties: [],
    ...overrides
  };
}

suite("boundActionTargetValidation", () => {
  test("accepts valid entity-bound target context", () => {
    const result = validateBoundActionTarget({
      definition: buildDefinition(),
      rowId: "{11111111-2222-3333-4444-555555555555}",
      capturedEnvironmentUrl: "https://example.crm.dynamics.com/",
      activeEnvironmentUrl: "https://example.crm.dynamics.com"
    });

    assert.equal(result.valid, true);
    assert.equal(result.normalizedRowId, "11111111-2222-3333-4444-555555555555");
    assert.equal(result.entityLogicalName, "account");
    assert.equal(result.entitySetName, "accounts");
    assert.deepEqual(result.reasonCodes, ["BoundEntityAction"]);
  });

  test("rejects invalid target GUID", () => {
    const result = validateBoundActionTarget({
      definition: buildDefinition(),
      rowId: "not-a-guid"
    });

    assert.equal(result.valid, false);
    assert.equal(result.label, "Inspect only — invalid target row id");
    assert.deepEqual(result.reasonCodes, ["BoundTargetInvalidGuid"]);
  });

  test("rejects mismatched target entity", () => {
    const result = validateBoundActionTarget({
      definition: buildDefinition(),
      targetEntityLogicalName: "contact",
      rowId: "11111111-2222-3333-4444-555555555555"
    });

    assert.equal(result.valid, false);
    assert.equal(result.label, "Inspect only — target entity mismatch");
    assert.deepEqual(result.reasonCodes, ["BoundTargetEntityMismatch"]);
  });

  test("accepts collection-bound Action route context", () => {
    const result = validateBoundActionTarget({
      definition: buildDefinition({
        boundTargetKind: "collection",
        boundEntityLogicalName: "account",
        boundEntitySetName: "accounts"
      }),
      rowId: "11111111-2222-3333-4444-555555555555"
    });

    assert.equal(result.valid, true);
    assert.equal(result.label, "Collection route valid");
    assert.deepEqual(result.reasonCodes, ["CollectionBoundAction"]);
  });

  test("rejects unresolved entity set metadata", () => {
    const result = validateBoundActionTarget({
      definition: buildDefinition({
        boundEntitySetName: ""
      }),
      rowId: "11111111-2222-3333-4444-555555555555"
    });

    assert.equal(result.valid, false);
    assert.equal(result.label, "Inspect only — bound route unavailable");
    assert.deepEqual(result.reasonCodes, ["BoundRouteUnavailable"]);
  });

  test("rejects stale environment context", () => {
    const result = validateBoundActionTarget({
      definition: buildDefinition(),
      rowId: "11111111-2222-3333-4444-555555555555",
      capturedEnvironmentUrl: "https://sit.crm.dynamics.com",
      activeEnvironmentUrl: "https://dev.crm.dynamics.com"
    });

    assert.equal(result.valid, false);
    assert.equal(result.label, "Stale context");
    assert.deepEqual(result.reasonCodes, ["BoundTargetEnvironmentMismatch"]);
  });
});
