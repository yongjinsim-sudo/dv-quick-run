import * as assert from "assert";
import { toConfidenceBand } from "../../../commands/router/actions/shared/intelligence/scoring/confidenceBanding.js";

suite("confidenceBanding", () => {
  test("maps score ranges consistently", () => {
    assert.strictEqual(toConfidenceBand(6.2), "high");
    assert.strictEqual(toConfidenceBand(3.1), "medium");
    assert.strictEqual(toConfidenceBand(1.4), "low");
  });
});
