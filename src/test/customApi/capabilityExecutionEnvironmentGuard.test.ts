import assert from "node:assert/strict";
import { resolveCapabilityExecutionSafetyLock, resolveCapabilityRunEnvironmentLock } from "../../customApi/execution/capabilityExecutionEnvironmentGuard.js";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";



function buildDefinition(overrides: Partial<CustomApiDefinition> = {}): CustomApiDefinition {
  return {
    id: "api-1",
    uniqueName: "new_TestAction",
    operationKind: "Action",
    bindingKind: "Unbound",
    requestParameters: [],
    responseProperties: [],
    executionReadiness: "preview-ready",
    executionReadinessLabel: "Preview-ready",
    executionEligibility: {
      state: "executable",
      label: "Executable via OData metadata",
      reason: "Matched in OData metadata."
    },
    ...overrides
  };
}

suite("capabilityExecutionEnvironmentGuard", () => {
  test("allows execution when captured and active environment URLs match", () => {
    const result = resolveCapabilityRunEnvironmentLock({
      capturedEnvironmentUrl: "https://org.crm6.dynamics.com/",
      activeEnvironmentUrl: "https://ORG.crm6.dynamics.com",
      capturedEnvironmentName: "DEV",
      activeEnvironmentName: "DEV"
    });

    assert.equal(result.isLocked, false);
  });

  test("locks execution when active environment changes", () => {
    const result = resolveCapabilityRunEnvironmentLock({
      capturedEnvironmentUrl: "https://dev.crm6.dynamics.com",
      activeEnvironmentUrl: "https://prod.crm6.dynamics.com",
      capturedEnvironmentName: "DEV",
      activeEnvironmentName: "PROD"
    });

    assert.equal(result.isLocked, true);
    assert.match(result.reason ?? "", /active environment changed from DEV to PROD/);
  });

  test("locks execution when the active environment cannot be verified", () => {
    const result = resolveCapabilityRunEnvironmentLock({
      capturedEnvironmentUrl: "https://dev.crm6.dynamics.com"
    });

    assert.equal(result.isLocked, true);
    assert.match(result.reason ?? "", /could not be verified/);
  });

  test("denies execution when capability state is not executable for expected method", () => {
    const result = resolveCapabilityExecutionSafetyLock({
      definition: buildDefinition({
        executionReadiness: "inspect-only",
        executionReadinessReason: "Entity payloads need explicit shaping.",
        requestParameters: [{ uniqueName: "Target", typeLabel: "Entity", executionSupport: "inspect-only" }],
        executionEligibility: {
          state: "preview-only-unsupported-parameters",
          label: "Preview only — unsupported parameters",
          reason: "Complex parameters are not execution-ready."
        }
      }),
      expectedMethod: "POST",
      capturedEnvironmentUrl: "https://dev.crm6.dynamics.com",
      activeEnvironmentUrl: "https://dev.crm6.dynamics.com",
      capturedEnvironmentName: "DEV",
      activeEnvironmentName: "DEV"
    });

    assert.equal(result.isLocked, true);
    assert.equal(result.state, "denied");
    assert.match(result.reason ?? "", /not executable via POST/);
  });

  test("marks changed active environment as stale execution authority", () => {
    const result = resolveCapabilityExecutionSafetyLock({
      definition: buildDefinition(),
      expectedMethod: "POST",
      capturedEnvironmentUrl: "https://dev.crm6.dynamics.com",
      activeEnvironmentUrl: "https://sit.crm6.dynamics.com",
      capturedEnvironmentName: "DEV",
      activeEnvironmentName: "SIT"
    });

    assert.equal(result.isLocked, true);
    assert.equal(result.state, "stale");
    assert.match(result.recovery ?? "", /regenerate executable authority/i);
  });

});
