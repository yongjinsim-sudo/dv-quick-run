import * as assert from "assert";
import { buildEvidencePivotResult } from "../../product/comparison/evidenceContinuation/liveEvidencePivotService.js";

suite("liveEvidencePivotService", () => {
  test("returns context-only guidance for solution classification evidence", async () => {
    const result = await buildEvidencePivotResult(
      {} as never,
      "solution",
      "Solution classification",
      "Custom solution",
      "Managed package drift"
    );

    assert.strictEqual(result.status, "available");
    assert.match(result.summary, /captured comparison context/i);
    assert.match(result.summary, /adjacent Source solution \/ Target solution/i);
  });

  test("returns bounded preview guidance when no live route is available", async () => {
    const result = await buildEvidencePivotResult(
      {} as never,
      "rawEvidence",
      "Captured note",
      "Observed metadata-only evidence"
    );

    assert.strictEqual(result.status, "available");
    assert.match(result.summary, /Bounded investigation pivot ready/i);
  });
});
