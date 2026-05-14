import assert from "node:assert/strict";
import { suite, test } from "mocha";
import { resolveCapabilityRunEnvironmentLock } from "../../customApi/execution/capabilityExecutionEnvironmentGuard.js";

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
});
