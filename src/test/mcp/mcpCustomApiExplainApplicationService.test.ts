import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import {
  McpCustomApiExplainApplicationService,
  type McpCustomApiDefinitionServiceLike
} from "../../mcp/mcpCustomApiExplainApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm6.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

const definition: CustomApiDefinition = {
  id: "1",
  uniqueName: "AIReply",
  displayName: "AIReply",
  description: "Draft a response to the given text using AI builder GPT action",
  operationKind: "Action",
  bindingKind: "Unbound",
  boundTargetKind: "none",
  isPrivate: false,
  requestParameters: [{ uniqueName: "Text", typeLabel: "String", typeCategory: "primitive", isOptional: false }],
  responseProperties: [{ uniqueName: "PreparedResponse", typeLabel: "String" }]
};

function serviceFor(found: boolean): McpCustomApiExplainApplicationService {
  const definitionService: McpCustomApiDefinitionServiceLike = {
    async resolveDefinition() {
      return {
        environmentUrl: config.environmentUrl!,
        uniqueName: found ? definition.uniqueName : "MissingApi",
        definition: found ? definition : null,
        invocation: found ? {
          method: "POST",
          routeTemplate: "/api/data/v9.2/AIReply",
          bodyTemplate: { Text: "<value>" },
          executionEligibility: { status: "metadata_only" }
        } : null,
        catalogue: found ? [
          definition,
          { ...definition, id: "2", uniqueName: "AISummarize", description: "Summarize supplied text", responseProperties: [{ uniqueName: "Summary", typeLabel: "String" }] },
          { ...definition, id: "3", uniqueName: "AITranslate", description: "Translate supplied text", responseProperties: [{ uniqueName: "Translation", typeLabel: "String" }] }
        ] : []
      };
    }
  };
  return new McpCustomApiExplainApplicationService(config, definitionService);
}

suite("mcpCustomApiExplainApplicationService", () => {
  test("builds an evidence-backed explanation over the authoritative definition result", async () => {
    const result = await serviceFor(true).explain({ uniqueName: "AIReply" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.contractVersion, "dvqr-mcp-custom-api-explain-v3");
    assert.strictEqual(content.found, true);
    assert.strictEqual(content.explanation.purpose.text, definition.description);
    assert.strictEqual(content.explanation.purpose.evidenceSource, "metadata");
    assert.strictEqual(content.explanation.operation.kind, "Action");
    assert.strictEqual(content.explanation.binding.kind, "Global");
    assert.strictEqual(content.explanation.requestParameters[0].required, true);
    assert.strictEqual(content.explanation.responseProperties[0].uniqueName, "PreparedResponse");
    assert.strictEqual(content.explanation.invocation.method, "POST");
    assert.strictEqual(content.explanation.invocation.route, "/api/data/v9.2/AIReply");
    assert.ok(result.displayText?.includes("Purpose"));
    assert.ok(result.displayText?.includes("Metadata-derived HTTP shape"));
    assert.ok(result.displayText?.includes("not proof that the operation is exposed through OData"));
    assert.ok(result.displayText?.includes("Best used for"));
    assert.ok(result.displayText?.includes("Not ideal for"));
    assert.ok(result.displayText?.includes("Related Custom APIs"));
    assert.ok(content.explanation.usageGuidance.useWhen.length > 0);
    assert.ok(content.explanation.usageGuidance.avoidWhen.length > 0);
    assert.strictEqual(content.explanation.relatedApis[0].uniqueName, "AISummarize");
    assert.ok(content.explanation.relatedApis[0].reasons.length > 0);
    assert.ok(content.explanation.decisionSupport.bestUsedFor.length > 0);
    assert.ok(content.explanation.decisionSupport.notIdealFor.length > 0);
    assert.ok(content.explanation.decisionSupport.alternatives.some((item: any) => item.uniqueName === "AISummarize"));
    assert.ok(content.explanation.decisionSupport.typicalWorkflow.length >= 4);
    assert.ok(content.explanation.decisionSupport.conceptTags.includes("Response Drafting"));
    assert.strictEqual(content.explanation.decisionSupport.summary.primaryInput, "Text");
    assert.strictEqual(content.explanation.decisionSupport.summary.primaryOutput, "PreparedResponse");
    assert.ok(result.displayText?.includes("Decision summary"));
    assert.ok(result.displayText?.includes("Best used for"));
    assert.ok(result.displayText?.includes("Not ideal for"));
    assert.ok(result.displayText?.includes("Instead consider"));
    assert.ok(result.displayText?.includes("Typical workflow"));
    assert.ok(result.displayText?.includes("Concepts"));
  });

  test("does not guess when the exact definition is missing", async () => {
    const result = await serviceFor(false).explain({ uniqueName: "MissingApi" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.found, false);
    assert.strictEqual(content.explanation, null);
    assert.ok(result.displayText?.includes("did not guess or substitute"));
  });
});
