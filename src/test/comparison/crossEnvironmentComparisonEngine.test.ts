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

test("adds bounded additional observed drift surfaces without causality semantics", async () => {
  const providers: readonly ComparisonProvider[] = [
    {
      id: "identity-provider",
      title: "Identity Provider",
      compare: async () => ({
        providerId: "identity-provider",
        title: "Identity Provider",
        groups: [
          {
            id: "identity-participation-drift",
            title: "Identity Participation Drift",
            summary: "Identity participation differs.",
            significance: "Medium",
            differences: [
              {
                id: "identity-1",
                title: "Integration Team participation changed",
                summary: "Observed team participation changed.",
                kind: "Assignment Drift",
                significance: "Medium",
                evidence: [{ label: "Team participation", value: "Integration Team", source: "both" }]
              }
            ]
          }
        ]
      })
    },
    {
      id: "workflow-provider",
      title: "Workflow Provider",
      compare: async () => ({
        providerId: "workflow-provider",
        title: "Workflow Provider",
        groups: [
          {
            id: "workflow-automation-participation-drift",
            title: "Workflow / Automation Participation Drift",
            summary: "Workflow participation differs.",
            significance: "Medium",
            differences: [
              {
                id: "workflow-1",
                title: "Integration workflow owner changed",
                summary: "Observed workflow metadata changed.",
                kind: "Configuration Drift",
                significance: "Medium",
                evidence: [{ label: "Automation", value: "Integration workflow", source: "both" }]
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

  const identityGroup = model.groups.find((group) => group.id === "identity-participation-drift");
  assert.ok(identityGroup);
  assert.strictEqual(identityGroup.nearbyOperationalDrift?.length, 1);
  const nearby = identityGroup.nearbyOperationalDrift?.[0];
  assert.ok(nearby);
  assert.strictEqual(nearby.relatedGroupId, "workflow-automation-participation-drift");
  assert.match(nearby.summary, /additional operational context/);
  assert.doesNotMatch(nearby.summary, /caused|triggered|root cause/i);
  assert.ok(nearby.evidence.some((item) => item.label === "Operational boundary"));
});

test("preserves low-priority solution presence significance during engine calibration", async () => {
  const providers: readonly ComparisonProvider[] = [
    {
      id: "solution-provider",
      title: "Solution Provider",
      compare: async () => ({
        providerId: "solution-provider",
        title: "Solution Provider",
        groups: [
          {
            id: "solution-participation-drift",
            title: "Solution Participation Drift",
            summary: "Solution participation differs.",
            significance: "Low",
            differences: [
              {
                id: "platform-solution-1",
                title: "Application Common present only in target",
                summary: "Target-only Microsoft platform solution participation.",
                kind: "OnlyInTarget",
                significance: "Low",
                evidence: [
                  { label: "Target solution", value: "msdynce_AppCommon • v9.0.4.0066 • Managed", source: "target" },
                  { label: "Solution classification", value: "Microsoft platform solution", source: "both" }
                ]
              },
              {
                id: "custom-solution-1",
                title: "Contoso Core present only in target",
                summary: "Target-only custom solution participation.",
                kind: "OnlyInTarget",
                significance: "Medium",
                evidence: [
                  { label: "Target solution", value: "ContosoCore • v1.0.0.0 • Unmanaged", source: "target" },
                  { label: "Solution classification", value: "Custom solution", source: "both" }
                ]
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

  const group = model.groups.find((item) => item.id === "solution-participation-drift");
  assert.ok(group);
  const platformDifference = group.differences.find((item) => item.id === "platform-solution-1");
  const customDifference = group.differences.find((item) => item.id === "custom-solution-1");
  assert.ok(platformDifference);
  assert.ok(customDifference);
  assert.strictEqual(platformDifference.significance, "Low");
  assert.strictEqual(customDifference.significance, "Medium");
  assert.strictEqual(model.summary.mediumCount, 1);
  assert.strictEqual(model.summary.lowCount, 1);
});
