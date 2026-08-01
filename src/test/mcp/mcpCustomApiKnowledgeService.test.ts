import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import {
  buildCustomApiComparisonItem,
  buildCustomApiDecisionSupport,
  buildCustomApiRecommendationDecision,
  buildCustomApiUsageGuidance,
  recommendCustomApisForGoal,
  recommendRelatedCustomApis
} from "../../mcp/mcpCustomApiKnowledgeService.js";

function api(uniqueName: string, description: string, parameter = "Text"): CustomApiDefinition {
  return {
    id: uniqueName,
    uniqueName,
    displayName: uniqueName,
    description,
    operationKind: "Action",
    bindingKind: "Unbound",
    boundTargetKind: "none",
    isPrivate: false,
    requestParameters: [{ uniqueName: parameter, typeLabel: "String", isOptional: false }],
    responseProperties: [{ uniqueName: "Result", typeLabel: "String" }]
  };
}

suite("mcpCustomApiKnowledgeService", () => {
  test("produces deterministic reply usage guidance", () => {
    const guidance = buildCustomApiUsageGuidance(api("AIReply", "Draft a response to supplied text"));
    assert.ok(guidance.useWhen.some((item) => item.includes("Drafting a reply")));
    assert.ok(guidance.avoidWhen.some((item) => item.includes("summarisation")));
    assert.strictEqual(guidance.guidanceSource, "deterministic-metadata-interpretation");
  });

  test("ranks related public APIs with inspectable reasons", () => {
    const source = api("AIReply", "Draft a response to supplied text");
    const related = recommendRelatedCustomApis(source, [
      source,
      api("AISummarize", "Summarize supplied text"),
      api("AITranslate", "Translate supplied text"),
      { ...api("AIPrivate", "Draft a private reply"), isPrivate: true },
      api("UnrelatedOperation", "Provision a machine image", "MachineId")
    ]);
    assert.ok(related.length >= 2);
    assert.ok(related.every((item) => item.reasons.length > 0));
    assert.ok(!related.some((item) => item.uniqueName === "AIPrivate"));
    assert.ok(related[0].score >= related[1].score);
  });
  test("builds deterministic decision support from usage guidance and related APIs", () => {
    const source = api("AIReply", "Draft a response to supplied text");
    const guidance = buildCustomApiUsageGuidance(source);
    const related = recommendRelatedCustomApis(source, [
      source,
      api("AISummarize", "Summarize supplied text"),
      api("AITranslate", "Translate supplied text"),
      api("AISentiment", "Assess sentiment in supplied text")
    ]);
    const decision = buildCustomApiDecisionSupport(source, guidance, related);
    assert.ok(decision.bestUsedFor.some((item) => item.includes("Drafting a reply")));
    assert.ok(decision.notIdealFor.some((item) => item.includes("summarisation")));
    assert.ok(decision.alternatives.some((item) => item.uniqueName === "AISummarize" && item.betterFitWhen.includes("condense")));
    assert.ok(decision.typicalWorkflow.some((item) => item.includes("Text")));
    assert.ok(decision.conceptTags.includes("Response Drafting"));
    assert.ok(decision.conceptTags.includes("Action"));
    assert.strictEqual(decision.summary.primaryInput, "Text");
    assert.strictEqual(decision.summary.primaryOutput, "Result");
    assert.ok(decision.summary.alternatives.includes("AISummarize"));
    assert.strictEqual(decision.guidanceSource, "deterministic-metadata-interpretation");
  });


  test("recommends goal-matched public Custom APIs with reasons", () => {
  const recommendations = recommendCustomApisForGoal("translate and summarize customer emails", [
    api("AIReply", "Draft a response to supplied text"),
    api("AISummarize", "Summarize supplied text"),
    api("AITranslate", "Translate supplied text"),
    { ...api("AIPrivate", "Translate private text"), isPrivate: true }
  ]);
  assert.ok(recommendations.some((item) => item.uniqueName === "AISummarize"));
  assert.ok(recommendations.some((item) => item.uniqueName === "AITranslate"));
  assert.ok(!recommendations.some((item) => item.uniqueName === "AIPrivate"));
  assert.ok(recommendations.every((item) => item.reasons.length > 0));
});


test("suppresses operational noise and honours explicit exclusion domains", () => {
  const decision = buildCustomApiRecommendationDecision(
    "Recommend APIs for customer service messages. Exclude administration, plugin-generation, deployment and infrastructure APIs.",
    [
      api("AIReply", "Draft a response to supplied text"),
      api("AISummarize", "Summarize supplied text"),
      api("GenerateAutomatedPlugin", "Generate an automated plugin for a solution"),
      api("SetupAiConnection", "Set up an AI infrastructure connection")
    ]
  );
  assert.ok(decision.recommendations.some((item) => item.uniqueName === "AIReply"));
  assert.ok(!decision.recommendations.some((item) => item.uniqueName === "GenerateAutomatedPlugin"));
  assert.ok(!decision.recommendations.some((item) => item.uniqueName === "SetupAiConnection"));
  assert.ok(decision.excludedDomains.includes("plugin-generation"));
  assert.ok(decision.excludedDomains.includes("infrastructure"));
});

test("does not promote a generic category-only prediction match", () => {
  const decision = buildCustomApiRecommendationDecision("quantum payroll forecasting", [
    api("FormPredict", "Predict the next field value in a record based on context"),
    api("InferEntityDefinition", "Infer structural definition context")
  ]);
  assert.strictEqual(decision.posture, "no-strong-fit");
  assert.strictEqual(decision.confidence, "none");
  assert.deepStrictEqual(decision.recommendations, []);
  assert.ok(decision.unmatchedGoalConcepts.includes("payroll"));
});

test("distinguishes free-form and record-oriented summarisation", () => {
  const catalogue = [
    api("AISummarize", "Summarize supplied free-form text"),
    api("AISummarizeRecord", "Summarize a Dataverse record")
  ];
  const textDecision = buildCustomApiRecommendationDecision("create a concise summary of a long customer email", catalogue);
  const recordDecision = buildCustomApiRecommendationDecision("summarize a Dataverse record", catalogue);
  assert.strictEqual(textDecision.recommendations[0]?.uniqueName, "AISummarize");
  assert.strictEqual(recordDecision.recommendations[0]?.uniqueName, "AISummarizeRecord");
  assert.strictEqual(recordDecision.recommendations[0]?.confidence, "high");
});

test("builds aligned comparison items", () => {
  const comparison = buildCustomApiComparisonItem(api("AIReply", "Draft a response to supplied text"));
  assert.strictEqual(comparison.operationKind, "Action");
  assert.strictEqual(comparison.bindingKind, "Global");
  assert.strictEqual(comparison.expectedMethod, "POST");
  assert.strictEqual(comparison.primaryInput, "Text");
  assert.strictEqual(comparison.primaryOutput, "Result");
  assert.ok(comparison.bestUsedFor.length > 0);
  assert.ok(comparison.notIdealFor.length > 0);
});
});
