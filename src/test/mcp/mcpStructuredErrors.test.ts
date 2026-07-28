import * as assert from "assert";
import { mapStructuredExecutionError } from "../../mcp/mcpStructuredErrors.js";

suite("mcpStructuredErrors", () => {
  test("classifies unknown navigation property after a recovered fallback connection", () => {
    const error = new Error("Node transport failed (fetch failed (SELF_SIGNED_CERT_IN_CHAIN)). PowerShell fallback connected, but Dataverse returned HTTP 400: {\"error\":{\"code\":\"0x80060888\",\"message\":\"Could not find a property named 'task_careplan' on type 'Microsoft.Dynamics.CRM.task'.\"}}");
    const mapped = mapStructuredExecutionError(error, "tasks?$expand=task_careplan", "tasks");
    assert.strictEqual(mapped.code, "DataverseQueryRejected");
    assert.strictEqual(mapped.http?.status, 400);
    assert.strictEqual(mapped.dataverse?.category, "UnknownNavigationProperty");
    assert.strictEqual(mapped.dataverse?.property, "task_careplan");
    assert.ok(mapped.suggestedNextActions.includes("Run Relationship Path Intelligence."));
  });
});
