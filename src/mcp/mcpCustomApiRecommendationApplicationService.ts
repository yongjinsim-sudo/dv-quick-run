import type { CustomApiDefinition } from "../customApi/models/customApiTypes.js";
import {
  buildCustomApiComparisonItem,
  buildCustomApiRecommendationDecision,
  type McpCustomApiComparisonItem,
  type McpCustomApiGoalRecommendation,
  type McpCustomApiRecommendationDecision
} from "./mcpCustomApiKnowledgeService.js";
import { McpCustomApiMetadataRepository, type McpCustomApiMetadataSnapshot } from "./mcpCustomApiMetadataRepository.js";
import { stringArg, validateEnvironmentUrl } from "./mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export interface McpCustomApiCatalogueRepositoryLike {
  discover(environmentUrl: string): Promise<McpCustomApiMetadataSnapshot>;
}

function uniqueNamesArg(args: Record<string, unknown>): string[] {
  if (!Array.isArray(args.uniqueNames)) return [];
  return args.uniqueNames
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index);
}

function boundedMax(args: Record<string, unknown>, fallback = 5): number {
  const value = Number(args.maxResults ?? fallback);
  return Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : fallback;
}

function exactDefinition(catalogue: readonly CustomApiDefinition[], uniqueName: string): CustomApiDefinition | undefined {
  return catalogue.find((definition) => definition.uniqueName.localeCompare(uniqueName, undefined, { sensitivity: "accent" }) === 0);
}

function comparisonText(items: readonly McpCustomApiComparisonItem[], missing: readonly string[]): string {
  const lines = [`Custom API comparison: ${items.map((item) => item.uniqueName).join(" vs ")}`];
  for (const item of items) {
    lines.push("");
    lines.push(item.uniqueName);
    lines.push(`Purpose: ${item.purpose}`);
    lines.push(`Operation: ${item.operationKind}, ${item.bindingKind}, ${item.expectedMethod}`);
    if (item.primaryInput) lines.push(`Primary input: ${item.primaryInput}`);
    if (item.primaryOutput) lines.push(`Primary output: ${item.primaryOutput}`);
    lines.push(`Best used for: ${item.bestUsedFor[0] ?? "Its metadata-described purpose."}`);
    lines.push(`Not ideal for: ${item.notIdealFor[0] ?? "A different business outcome."}`);
  }
  if (missing.length) {
    lines.push("");
    lines.push(`Not found: ${missing.join(", ")}. DVQR did not substitute similar names.`);
  }
  lines.push("");
  lines.push("Evidence boundary: comparison is deterministic metadata interpretation. It does not prove runtime equivalence, OData exposure or execution safety.");
  return lines.join("\n");
}


const WORKFLOW_PRIORITY: Readonly<Record<string, number>> = {
  translation: 10,
  extraction: 20,
  classification: 30,
  "sentiment-analysis": 40,
  summarisation: 50,
  "response-drafting": 60
};

function suggestedWorkflow(recommendations: readonly McpCustomApiGoalRecommendation[]) {
  return [...recommendations]
    .sort((left, right) => (WORKFLOW_PRIORITY[left.category ?? ""] ?? 100) - (WORKFLOW_PRIORITY[right.category ?? ""] ?? 100) || right.score - left.score || left.uniqueName.localeCompare(right.uniqueName))
    .map((item, index) => ({ order: index + 1, uniqueName: item.uniqueName, role: item.workflowRole }));
}

function recommendationText(goal: string, decision: McpCustomApiRecommendationDecision): string {
  const lines = [`Custom API recommendations for: ${goal}`];
  lines.push(`Decision posture: ${decision.posture}; confidence: ${decision.confidence}.`);
  for (const rationale of decision.rationale) lines.push(`- ${rationale}`);
  if (!decision.recommendations.length) {
    lines.push("No deterministic public Custom API recommendation met the evidence threshold.");
    lines.push("DVQR did not invent, substitute or promote a weak lexical match.");
    return lines.join("\n");
  }
  decision.recommendations.forEach((item, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${item.uniqueName} — ${item.score}/100 (${item.confidence} confidence)`);
    if (item.purpose) lines.push(`Purpose: ${item.purpose}`);
    lines.push(`Workflow role: ${item.workflowRole}`);
    for (const reason of item.reasons) lines.push(`- ${reason}`);
    lines.push(`Score evidence: category ${item.scoreBreakdown.categoryMatch}, concepts ${item.scoreBreakdown.conceptOverlap}, shape ${item.scoreBreakdown.shapeSupport}, domain penalty ${item.scoreBreakdown.domainPenalty}.`);
  });
  lines.push("");
  lines.push("Recommended workflow:");
  for (const step of suggestedWorkflow(decision.recommendations)) lines.push(`${step.order}. ${step.uniqueName} — ${step.role}`);
  if (decision.excludedDomains.length) lines.push(`Excluded by request: ${decision.excludedDomains.join(", ")}.`);
  if (decision.unmatchedGoalConcepts.length) lines.push(`Not directly covered by metadata: ${decision.unmatchedGoalConcepts.slice(0, 6).join(", ")}.`);
  lines.push("Use each operation only for its declared role, preserve human review for generated or inferred outputs, and verify runtime eligibility before execution.");
  lines.push("Evidence boundary: ranking is deterministic metadata guidance, not proof of semantic equivalence or safe executability.");
  return lines.join("\n");
}

export class McpCustomApiRecommendationApplicationService {
  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly repository: McpCustomApiCatalogueRepositoryLike = new McpCustomApiMetadataRepository(config)
  ) {}

  public async compare(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const uniqueNames = uniqueNamesArg(args);
    if (uniqueNames.length < 2 || uniqueNames.length > 10) {
      return { ok: false, code: "InvalidArguments", message: "uniqueNames must contain 2 to 10 distinct Custom API unique names." };
    }
    const environment = validateEnvironmentUrl(args, this.config);
    if (!environment.ok) return environment;
    try {
      const snapshot = await this.repository.discover(environment.environmentUrl);
      const definitions = uniqueNames.map((name) => exactDefinition(snapshot.definitions, name)).filter((item): item is CustomApiDefinition => Boolean(item));
      const missing = uniqueNames.filter((name) => !exactDefinition(snapshot.definitions, name));
      const comparisons = definitions.map(buildCustomApiComparisonItem);
      return {
        ok: true,
        summary: `Compared ${comparisons.length} Custom API definition${comparisons.length === 1 ? "" : "s"}${missing.length ? `; ${missing.length} exact name${missing.length === 1 ? " was" : "s were"} not found` : ""}.`,
        displayText: comparisonText(comparisons, missing),
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-comparison-v1",
          environmentUrl: environment.environmentUrl,
          requestedUniqueNames: uniqueNames,
          compared: comparisons,
          missing,
          evidenceBoundary: "Comparison uses one authoritative Custom API metadata snapshot and deterministic knowledge rules. It does not claim runtime equivalence or execution eligibility."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Custom API comparison failed." };
    }
  }

  public async recommend(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const goal = stringArg(args, "goal");
    if (!goal) return { ok: false, code: "InvalidArguments", message: "goal is required." };
    const environment = validateEnvironmentUrl(args, this.config);
    if (!environment.ok) return environment;
    try {
      const snapshot = await this.repository.discover(environment.environmentUrl);
      const decision = buildCustomApiRecommendationDecision(goal, snapshot.definitions, boundedMax(args));
      const recommendations = decision.recommendations;
      return {
        ok: true,
        summary: recommendations.length
          ? `Recommended ${recommendations.length} Custom API${recommendations.length === 1 ? "" : "s"} for the stated goal.`
          : "No deterministic Custom API recommendation met the evidence threshold.",
        displayText: recommendationText(goal, decision),
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-recommendation-v2",
          environmentUrl: environment.environmentUrl,
          goal,
          decision,
          recommendations,
          suggestedWorkflow: suggestedWorkflow(recommendations),
          evidenceBoundary: "Recommendations rank public Custom APIs from one metadata snapshot using explicit goal concepts, names, descriptions, operation kinds, bindings and parameters. They are guidance only and do not prove runtime exposure, privileges, side effects or safe execution."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Custom API recommendation failed." };
    }
  }
}
