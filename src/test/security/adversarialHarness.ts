import * as assert from "assert";
import type {
  AdversarialCase,
  AdversarialObservation,
  ForbiddenEffect
} from "./adversarialCase.js";

export class AdversarialEffectRecorder {
  private readonly effects = new Set<ForbiddenEffect>();

  record(effect: ForbiddenEffect): void {
    this.effects.add(effect);
  }

  has(effect: ForbiddenEffect): boolean {
    return this.effects.has(effect);
  }

  snapshot(): readonly ForbiddenEffect[] {
    return [...this.effects];
  }
}

export function assertAdversarialObservation(
  testCase: AdversarialCase,
  observation: AdversarialObservation
): void {
  assert.strictEqual(
    observation.outcome,
    testCase.expectedOutcome,
    `${testCase.id}: unexpected security outcome`
  );

  const observedEffects = new Set(observation.effects ?? []);
  for (const forbiddenEffect of testCase.forbiddenEffects) {
    assert.strictEqual(
      observedEffects.has(forbiddenEffect),
      false,
      `${testCase.id}: forbidden effect observed: ${forbiddenEffect}`
    );
  }
}

export async function runAdversarialCase<TInput>(
  testCase: AdversarialCase<TInput>,
  executor: (input: TInput, effects: AdversarialEffectRecorder) => Promise<AdversarialObservation> | AdversarialObservation
): Promise<AdversarialObservation> {
  const effects = new AdversarialEffectRecorder();
  const observation = await executor(testCase.input, effects);
  const combined: AdversarialObservation = {
    ...observation,
    effects: [...(observation.effects ?? []), ...effects.snapshot()]
  };
  assertAdversarialObservation(testCase, combined);
  return combined;
}
