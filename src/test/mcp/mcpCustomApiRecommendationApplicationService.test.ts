import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import {
  McpCustomApiRecommendationApplicationService,
  type McpCustomApiCatalogueRepositoryLike
} from "../../mcp/mcpCustomApiRecommendationApplicationService.js";
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
  api("AIReply", "Draft a response to supplied text", "PreparedResponse"),
  api("AISummarize", "Summarize supplied text", "SummarizedText"),
  api("AITranslate", "Translate supplied text", "TranslatedText"),
  api("AISentiment", "Assess sentiment in supplied text", "Sentiment"),
  api("GenerateAutomatedPlugin", "Generate an automated plugin for a solution", "PluginId"),
  api("AISummarizeRecord", "Summarize a Dataverse record", "SummarizedRecord")
];

function service(): McpCustomApiRecommendationApplicationService {
  let calls = 0;
  const repository: McpCustomApiCatalogueRepositoryLike = {
    async discover() {
      calls += 1;
      assert.strictEqual(calls, 1);
      return { definitions: catalogue, executionContexts: [], transports: [], nativeFetchFailures: [] };
    }
  };
  return new McpCustomApiRecommendationApplicationService(config, repository);
}

suite("mcpCustomApiRecommendationApplicationService", () => {
  test("compares named APIs from one catalogue snapshot", async () => {
    const result = await service().compare({ uniqueNames: ["AIReply", "AISummarize"] });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.contractVersion, "dvqr-mcp-custom-api-comparison-v1");
    assert.deepStrictEqual(content.compared.map((item: any) => item.uniqueName), ["AIReply", "AISummarize"]);
    assert.strictEqual(content.compared[0].primaryOutput, "PreparedResponse");
    assert.ok(result.displayText?.includes("AIReply vs AISummarize"));
    assert.ok(result.displayText?.includes("Best used for"));
  });

  test("reports exact-name misses without substitution", async () => {
    const result = await service().compare({ uniqueNames: ["AIReply", "MissingApi"] });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.deepStrictEqual(content.missing, ["MissingApi"]);
    assert.ok(result.displayText?.includes("did not substitute"));
  });

  test("recommends APIs for a natural-language goal", async () => {
    const result = await service().recommend({ goal: "translate and summarize customer emails", maxResults: 4 });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.contractVersion, "dvqr-mcp-custom-api-recommendation-v2");
    assert.ok(["strong-fit", "partial-fit"].includes(content.decision.posture));
    assert.ok(content.recommendations.some((item: any) => item.uniqueName === "AITranslate"));
    assert.ok(content.recommendations.some((item: any) => item.uniqueName === "AISummarize"));
    assert.ok(content.recommendations.every((item: any) => item.reasons.length > 0));
    assert.ok(result.displayText?.includes("Recommended workflow"));
    assert.ok(result.displayText?.includes("confidence"));
  });


  test("honours exclusions and suppresses plugin-generation noise", async () => {
    const result = await service().recommend({
      goal: "customer service messages; exclude plugin-generation, deployment and infrastructure APIs",
      maxResults: 10
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.ok(content.decision.excludedDomains.includes("plugin-generation"));
    assert.ok(!content.recommendations.some((item: any) => item.uniqueName === "GenerateAutomatedPlugin"));
  });

  test("returns no strong recommendation for an unsupported domain goal", async () => {
    const result = await service().recommend({ goal: "quantum payroll forecasting" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.decision.posture, "no-strong-fit");
    assert.deepStrictEqual(content.recommendations, []);
    assert.ok(result.displayText?.includes("did not invent"));
  });

  test("validates comparison and recommendation arguments", async () => {
    const invalidCompare = await service().compare({ uniqueNames: ["AIReply"] });
    assert.strictEqual(invalidCompare.ok, false);
    const invalidRecommend = await service().recommend({});
    assert.strictEqual(invalidRecommend.ok, false);
  });
});
