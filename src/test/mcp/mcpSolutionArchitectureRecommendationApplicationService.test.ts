import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import {
  McpSolutionArchitectureRecommendationApplicationService,
  type McpSolutionArchitectureCatalogueRepositoryLike
} from "../../mcp/mcpSolutionArchitectureRecommendationApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm6.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

function api(uniqueName: string, description: string, output: string): CustomApiDefinition {
  return {
    id: uniqueName,
    uniqueName,
    displayName: uniqueName,
    description,
    operationKind: "Action",
    bindingKind: "Unbound",
    boundTargetKind: "none",
    isPrivate: false,
    requestParameters: [{ uniqueName: "Text", typeLabel: "String", typeCategory: "primitive", isOptional: false }],
    responseProperties: [{ uniqueName: output, typeLabel: "String" }]
  };
}

const catalogue = [
  api("AITranslate", "Translate supplied text", "TranslatedText"),
  api("AIClassify", "Classify supplied text by intent or category", "Classification"),
  api("AISentiment", "Assess sentiment in supplied text", "Sentiment"),
  api("AISummarize", "Summarize supplied text", "SummarizedText"),
  api("AISummarizeRecord", "Summarize the given entity record", "SummarizedRecord"),
  api("SummarizeRecord", "Summarize the given entity record", "SummarizedRecord"),
  api("AIReply", "Draft a response to supplied text", "PreparedResponse"),
  api("AIExtract", "Extract structured values from supplied text", "ExtractedData"),
  api("FormPredict", "Predict a proposed form field value from supplied context", "Prediction"),
  api("GenerateAutomatedPlugin", "Generate an automated plugin and corresponding SdkMessageProcessingStep", "PluginId"),
  api("GenerateInstantPlugin", "Generate an instant plugin and corresponding custom API", "PluginId"),
  api("UpdateAutomatedPlugin", "Update an automated plugin and corresponding SdkMessageProcessingStep", "PluginId")
];

function service(): McpSolutionArchitectureRecommendationApplicationService {
  let calls = 0;
  const repository: McpSolutionArchitectureCatalogueRepositoryLike = {
    async discover() {
      calls += 1;
      assert.strictEqual(calls, 1);
      return { definitions: catalogue, executionContexts: [], transports: [], nativeFetchFailures: [] };
    }
  };
  return new McpSolutionArchitectureRecommendationApplicationService(config, repository);
}

suite("mcpSolutionArchitectureRecommendationApplicationService", () => {
  test("builds a deterministic customer-service pipeline with ordering rationale", async () => {
    const result = await service().recommend({
      goal: "Translate an incoming email, classify intent, assess sentiment, summarize it and draft a reply"
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.contractVersion, "dvqr-mcp-solution-architecture-v1");
    assert.deepStrictEqual(
      content.recommendedPipeline.filter((stage: any) => stage.kind === "custom-api").map((stage: any) => stage.uniqueName),
      ["AITranslate", "AIClassify", "AISentiment", "AISummarize", "AISummarizeRecord", "AIReply"]
    );
    assert.strictEqual(content.recommendedPipeline.at(-1).kind, "human-review");
    assert.ok(content.recommendedPipeline.every((stage: any) => stage.orderingRationale));
    assert.ok(result.displayText?.includes("Recommended pipeline"));
  });

  test("marks translation optional when no multilingual need is stated", async () => {
    const result = await service().recommend({ goal: "Design customer support with classification, summarization and a drafted reply" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    const translation = content.recommendedPipeline.find((stage: any) => stage.uniqueName === "AITranslate");
    if (translation) assert.strictEqual(translation.required, false);
  });

  test("returns recommended, simpler and extended alternatives", async () => {
    const result = await service().recommend({ goal: "Design a multilingual customer service response workflow" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.deepStrictEqual(content.alternativeArchitectures.map((item: any) => item.id), ["recommended", "simple", "extended"]);
    assert.ok(content.alternativeArchitectures.every((item: any) => item.rationale));
  });

  test("keeps unsupported goals honest", async () => {
    const result = await service().recommend({ goal: "Design quantum payroll forecasting" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.decision.posture, "no-strong-fit");
    assert.deepStrictEqual(content.recommendedPipeline, []);
    assert.ok(result.displayText?.includes("did not invent"));
    assert.ok(content.decision.rationale.some((line: string) => /preserved the original goal/i.test(line)));
    assert.ok(!content.recommendedPipeline.some((stage: any) => stage.uniqueName === "FormPredict"));
  });


  test("applies a deterministic customer-engagement completeness profile", async () => {
    const result = await service().recommend({
      goal: "Design an AI solution architecture for a healthcare customer engagement platform where patients submit enquiries in multiple languages"
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.architectureProfile.id, "customer-engagement");
    const names = content.recommendedPipeline
      .filter((stage: any) => stage.kind === "custom-api")
      .map((stage: any) => stage.uniqueName);
    assert.ok(names.includes("AITranslate"));
    assert.ok(names.includes("AIClassify"));
    assert.ok(names.includes("AIReply"));
    assert.strictEqual(content.decision.confidenceSource, "custom-api-recommendation-decision");
    assert.ok(content.guidanceBoundary.architecturalInterpretation.includes("stage ordering"));
  });

  test("forbids closest-match substitution for unsupported architecture paradigms", async () => {
    const result = await service().recommend({ goal: "Design a quantum payroll prediction architecture" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.decision.allowClosestMatch, false);
    assert.match(content.decision.responseDirective, /do not call discovery/i);
    assert.strictEqual(content.architectureProfile, undefined);
  });


  test("excludes plugin lifecycle operations and deduplicates semantic capability families", async () => {
    const result = await service().recommend({
      goal: "Design a multilingual customer-service architecture with classification, conversation summarization, Dataverse record context, response drafting, and human review",
      maxStages: 8
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    const names = content.recommendedPipeline.filter((stage: any) => stage.kind === "custom-api").map((stage: any) => stage.uniqueName);
    assert.ok(names.includes("AITranslate"));
    assert.ok(names.includes("AIClassify"));
    assert.ok(names.includes("AISummarize"));
    assert.ok(names.includes("AISummarizeRecord"));
    assert.ok(names.includes("AIReply"));
    assert.ok(!names.some((name: string) => /Plugin/.test(name)));
    assert.ok(!names.includes("SummarizeRecord"));
  });

  test("never assigns a response-drafting role to plugin lifecycle metadata", async () => {
    const result = await service().recommend({ goal: "Design a production customer-service response architecture", maxStages: 8 });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.ok(!content.recommendedPipeline.some((stage: any) => /Plugin/.test(stage.uniqueName ?? "")));
    assert.ok(content.recommendedPipeline
      .filter((stage: any) => stage.workflowRole === "Draft a response for human review")
      .every((stage: any) => stage.uniqueName === "AIReply"));
  });

  test("keeps the simpler response architecture internally valid", async () => {
    const result = await service().recommend({ goal: "Design customer support with Dataverse history and a drafted reply" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    const simple = content.alternativeArchitectures.find((item: any) => item.id === "simple");
    assert.ok(simple.stages.some((stage: any) => stage.uniqueName === "AIReply"));
    assert.strictEqual(simple.stages.at(-1).kind, "human-review");
  });



  test("maps customer history to record-context architecture and exposes semantic families", async () => {
    const result = await service().recommend({
      goal: "Design a production customer-service architecture that categorizes messages, uses customer history, drafts a response, and requires human approval",
      maxStages: 6
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    const recordContext = content.recommendedPipeline.find((stage: any) => stage.capabilityFamily === "record-summarisation");
    assert.ok(recordContext);
    assert.strictEqual(recordContext.uniqueName, "AISummarizeRecord");
    assert.ok(content.recommendedPipeline.every((stage: any) => typeof stage.capabilityFamily === "string"));
  });

  test("produces meaningfully differentiated architecture alternatives when optional stages exist", async () => {
    const result = await service().recommend({ goal: "Design a multilingual customer-service response workflow", maxStages: 8 });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    const simple = content.alternativeArchitectures.find((item: any) => item.id === "simple");
    const recommended = content.alternativeArchitectures.find((item: any) => item.id === "recommended");
    const extended = content.alternativeArchitectures.find((item: any) => item.id === "extended");
    assert.ok(simple.stages.length < recommended.stages.length);
    assert.ok(recommended.stages.length <= extended.stages.length);
    assert.ok(simple.stages.some((stage: any) => stage.capabilityFamily === "response-drafting"));
    assert.strictEqual(simple.stages.at(-1).capabilityFamily, "human-review");
  });

  test("adds a warning when the goal suggests bypassing review", async () => {
    const result = await service().recommend({ goal: "Draft customer replies and auto-send without human review" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.ok(content.risks.some((risk: string) => /bypassing human review/i.test(risk)));
  });

  test("validates the required goal", async () => {
    const result = await service().recommend({});
    assert.strictEqual(result.ok, false);
  });
});
