import * as assert from "assert";
import { createCrossEnvironmentComparisonEngine } from "../../core/comparison/index.js";
import type { ComparisonProvider } from "../../core/comparison/index.js";

suite("crossEnvironmentComparisonEngine", () => {
  test("combines provider groups into one ordered comparison view model", async () => {
    const providers: readonly ComparisonProvider[] = [
      {
        id: "low-provider",
        title: "Low Provider",
        compare: async () => ({
          providerId: "low-provider",
          title: "Low Provider",
          groups: [
            {
              id: "low",
              title: "Low drift",
              summary: "Low drift summary",
              significance: "Low",
              differences: [
                {
                  id: "low-1",
                  title: "Low difference",
                  summary: "Low difference summary",
                  kind: "Changed",
                  significance: "Low",
                  evidence: []
                }
              ]
            }
          ]
        })
      },
      {
        id: "high-provider",
        title: "High Provider",
        compare: async () => ({
          providerId: "high-provider",
          title: "High Provider",
          groups: [
            {
              id: "high",
              title: "High drift",
              summary: "High drift summary",
              significance: "High",
              differences: [
                {
                  id: "high-1",
                  title: "High difference",
                  summary: "High difference summary",
                  kind: "Added",
                  significance: "High",
                  evidence: []
                }
              ]
            }
          ]
        })
      }
    ];

    const model = await createCrossEnvironmentComparisonEngine(providers).compare({
      source: { label: "DEV" },
      target: { label: "SIT" }
    });

    assert.strictEqual(model.title, "Cross-Environment Diff: DEV → SIT");
    assert.strictEqual(model.summary.providerCount, 2);
    assert.strictEqual(model.summary.differenceCount, 2);
    assert.strictEqual(model.summary.highCount, 1);
    assert.strictEqual(model.summary.lowCount, 1);
    assert.strictEqual(model.groups[0].id, "high");
  });
});
