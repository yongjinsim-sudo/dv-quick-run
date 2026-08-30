import * as assert from "assert";
import {
  AdversarialEffectRecorder,
  assertAdversarialObservation,
  runAdversarialCase
} from "./adversarialHarness.js";
import type { AdversarialCase } from "./adversarialCase.js";

const baseCase: AdversarialCase<string> = {
  id: "A04-HARNESS-001",
  family: "A04",
  title: "Harness rejects a forbidden provider side effect",
  input: "unknown-tool",
  expectedOutcome: "Rejected",
  forbiddenEffects: ["ProviderCalled", "MutationCalled"],
  invariants: ["Registered capability only"]
};

suite("Security adversarial harness", () => {
  test("records effects without duplicating production policy", () => {
    const recorder = new AdversarialEffectRecorder();
    recorder.record("ProviderCalled");
    assert.strictEqual(recorder.has("ProviderCalled"), true);
    assert.deepStrictEqual(recorder.snapshot(), ["ProviderCalled"]);
  });

  test("accepts the expected outcome when forbidden side effects are absent", async () => {
    const observation = await runAdversarialCase(baseCase, async () => ({ outcome: "Rejected" }));
    assert.strictEqual(observation.outcome, "Rejected");
    assert.deepStrictEqual(observation.effects, []);
  });

  test("fails when a recorder observes a forbidden side effect", async () => {
    await assert.rejects(
      () => runAdversarialCase(baseCase, async (_input, effects) => {
        effects.record("ProviderCalled");
        return { outcome: "Rejected" };
      }),
      /forbidden effect observed: ProviderCalled/
    );
  });

  test("fails when returned observations report a forbidden side effect", () => {
    assert.throws(
      () => assertAdversarialObservation(baseCase, { outcome: "Rejected", effects: ["MutationCalled"] }),
      /forbidden effect observed: MutationCalled/
    );
  });

  test("fails when the security outcome is not the declared expectation", () => {
    assert.throws(
      () => assertAdversarialObservation(baseCase, { outcome: "AllowedBounded", effects: [] }),
      /unexpected security outcome/
    );
  });
});
