import {
  McpCustomApiApplicationService,
  type McpCustomApiDefinitionResolution
} from "./mcpCustomApiApplicationService.js";
import {
  buildMcpCustomApiExplainModel,
  renderMcpCustomApiExplainText,
  type McpCustomApiInvocationModel
} from "./mcpCustomApiExplainBuilder.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { buildCustomApiDecisionSupport, buildCustomApiUsageGuidance, recommendRelatedCustomApis } from "./mcpCustomApiKnowledgeService.js";

export interface McpCustomApiDefinitionServiceLike {
  resolveDefinition(args: Record<string, unknown>): Promise<McpCustomApiDefinitionResolution | DvqrMcpFreeToolResult>;
}

export class McpCustomApiExplainApplicationService {
  public constructor(
    config: DvqrMcpRuntimeConfiguration,
    private readonly definitionService: McpCustomApiDefinitionServiceLike = new McpCustomApiApplicationService(config)
  ) {}

  public async explain(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const resolution = await this.definitionService.resolveDefinition(args);
    if ("ok" in resolution) return resolution;

    if (!resolution.definition || !resolution.invocation) {
      const uniqueName = resolution.uniqueName ?? (typeof args.uniqueName === "string" ? args.uniqueName : "the requested operation");
      return {
        ok: true,
        summary: `No Custom API definition named ${uniqueName} was found to explain.`,
        displayText: `No Custom API definition named ${uniqueName} was found. DVQR did not guess or substitute a similarly named operation.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-explain-v3",
          environmentUrl: resolution.environmentUrl,
          uniqueName,
          found: false,
          explanation: null,
          evidenceBoundary: "DVQR did not guess or substitute a similarly named Custom API."
        }
      };
    }

    const usageGuidance = buildCustomApiUsageGuidance(resolution.definition);
    const relatedApis = recommendRelatedCustomApis(resolution.definition, resolution.catalogue);
    const decisionSupport = buildCustomApiDecisionSupport(resolution.definition, usageGuidance, relatedApis);
    const explanation = buildMcpCustomApiExplainModel(resolution.definition, resolution.invocation as McpCustomApiInvocationModel, usageGuidance, relatedApis, decisionSupport);
    return {
      ok: true,
      summary: `Custom API explanation generated for ${resolution.definition.uniqueName}.`,
      displayText: renderMcpCustomApiExplainText(explanation),
      structuredContent: {
        contractVersion: "dvqr-mcp-custom-api-explain-v3",
        environmentUrl: resolution.environmentUrl,
        uniqueName: resolution.definition.uniqueName,
        found: true,
        explanation,
        evidence: {
          metadataFacts: [
            "identity",
            "description",
            "operationKind",
            "binding",
            "requestParameters",
            "responseProperties"
          ],
          deterministicInterpretation: [
            "operation explanation",
            "binding explanation",
            "parameter and response narratives",
            "use-when and avoid-when guidance",
            "related API ranking and reasons",
            "best-fit and unsuitable-use decision support",
            "alternative-operation guidance",
            "typical workflow and concept tags",
            "practical guidance"
          ],
          metadataDerivedScaffold: ["HTTP method", "route template", "body or function parameter template"],
          catalogueEvidence: ["public Custom API names", "descriptions", "operation kinds", "bindings", "parameter names and types"]
        },
        evidenceBoundary: "Explain is a deterministic knowledge and decision-support view over one authoritative definition and the current public Custom API catalogue. Recommendations and alternatives are metadata-derived guidance, not proof of semantic equivalence or runtime suitability. Explain does not validate OData eligibility or permit execution."
      }
    };
  }
}
