import * as assert from "assert";
import type { TimelineEvent, TimelineIntervalRef } from "../pro/timeline/index.js";
import {
  getTimelineEventSignificanceWeight,
  selectTopTimelineEvents,
} from "../pro/timeline/index.js";

function interval(index: number): TimelineIntervalRef {
  return {
    intervalId: `interval-${index}`,
    intervalIndex: index,
    fromSnapshotId: `s${index}`,
    toSnapshotId: `s${index + 1}`,
    fromCapturedAtIso: `2026-06-18T0${index}:00:00.000Z`,
    toCapturedAtIso: `2026-06-18T0${index + 1}:00:00.000Z`,
    label: `2026-06-18T0${index}:00:00.000Z → 2026-06-18T0${index + 1}:00:00.000Z`,
  };
}

function event(args: Partial<TimelineEvent> & { id: string; significance: TimelineEvent["significance"]; intervalIndex: number }): TimelineEvent {
  return {
    id: args.id,
    subjectKey: args.subjectKey ?? "entity:account",
    providerId: args.providerId ?? "provider",
    providerTitle: args.providerTitle ?? "Provider",
    category: args.category ?? "Changed",
    significance: args.significance,
    title: args.title ?? args.id,
    summary: args.summary ?? "First observed between snapshots.",
    firstObservedBetween: args.firstObservedBetween ?? interval(args.intervalIndex),
    evidenceRefs: args.evidenceRefs ?? [],
    sourceGroupId: args.sourceGroupId,
    sourceDifferenceId: args.sourceDifferenceId,
    sourceDifference: args.sourceDifference,
  };
}

suite("topTimelineEvents", () => {
  test("ranks high significance events before medium and low", () => {
    const selected = selectTopTimelineEvents([
      event({ id: "low", significance: "Low", intervalIndex: 1 }),
      event({ id: "medium", significance: "Medium", intervalIndex: 1 }),
      event({ id: "high", significance: "High", intervalIndex: 1 }),
    ]);

    assert.deepStrictEqual(selected.map((item) => item.id), ["high", "medium", "low"]);
  });

  test("uses first observed interval as stable tie-break within the same significance", () => {
    const selected = selectTopTimelineEvents([
      event({ id: "later", significance: "High", intervalIndex: 3 }),
      event({ id: "earlier", significance: "High", intervalIndex: 1 }),
      event({ id: "middle", significance: "High", intervalIndex: 2 }),
    ]);

    assert.deepStrictEqual(selected.map((item) => item.id), ["earlier", "middle", "later"]);
  });

  test("caps the visible top event list using the supplied limit", () => {
    const selected = selectTopTimelineEvents([
      event({ id: "one", significance: "High", intervalIndex: 1 }),
      event({ id: "two", significance: "High", intervalIndex: 2 }),
      event({ id: "three", significance: "High", intervalIndex: 3 }),
    ], { limit: 2 });

    assert.deepStrictEqual(selected.map((item) => item.id), ["one", "two"]);
  });

  test("returns no top events for empty input or zero limit", () => {
    assert.deepStrictEqual(selectTopTimelineEvents([]), []);
    assert.deepStrictEqual(selectTopTimelineEvents([
      event({ id: "one", significance: "High", intervalIndex: 1 }),
    ], { limit: 0 }), []);
  });

  test("uses expected significance weights", () => {
    assert.strictEqual(getTimelineEventSignificanceWeight("High"), 3);
    assert.strictEqual(getTimelineEventSignificanceWeight("Medium"), 2);
    assert.strictEqual(getTimelineEventSignificanceWeight("Low"), 1);
  });
});
