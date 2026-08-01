import {
  buildCustomApiRecommendationDecision,
  type McpCustomApiGoalRecommendation,
  type McpCustomApiRecommendationConfidence,
  type McpCustomApiRecommendationDecision
} from "./mcpCustomApiKnowledgeService.js";
import {
  McpCustomApiMetadataRepository,
  type McpCustomApiMetadataSnapshot
} from "./mcpCustomApiMetadataRepository.js";
import { stringArg, validateEnvironmentUrl } from "./mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export interface McpSolutionArchitectureCatalogueRepositoryLike {
  discover(environmentUrl: string): Promise<McpCustomApiMetadataSnapshot>;
}

export interface McpSolutionArchitectureStage {
  readonly order: number;
  readonly kind: "custom-api" | "human-review" | "business-process";
  readonly uniqueName?: string;
  readonly capabilityFamily: ArchitectureCapabilityFamily | "human-review" | "business-process";
  readonly purpose: string;
  readonly workflowRole: string;
  readonly required: boolean;
  readonly confidence: McpCustomApiRecommendationConfidence;
  readonly score?: number;
  readonly whyHere: readonly string[];
  readonly orderingRationale: string;
}

type ArchitectureCapabilityFamily =
  | "translation"
  | "extraction"
  | "classification"
  | "sentiment-analysis"
  | "text-summarisation"
  | "record-summarisation"
  | "response-drafting"
  | "prediction"
  | "plugin-lifecycle"
  | "administration"
  | "unknown";

const WORKFLOW_PRIORITY: Readonly<Record<ArchitectureCapabilityFamily, number>> = {
  translation: 10,
  extraction: 20,
  classification: 30,
  "sentiment-analysis": 40,
  "text-summarisation": 50,
  "record-summarisation": 55,
  "response-drafting": 60,
  prediction: 65,
  "plugin-lifecycle": 900,
  administration: 910,
  unknown: 999
};

function capabilityFamily(item: McpCustomApiGoalRecommendation): ArchitectureCapabilityFamily {
  const source = `${item.uniqueName} ${item.purpose ?? ""}`.toLowerCase();
  if (/plugin|sdkmessageprocessingstep|customapis?/.test(source) && /generate|update|delete|remove|create/.test(source)) return "plugin-lifecycle";
  if (/certificate|credential|permission|tenant|capacity|administrat/.test(source)) return "administration";
  if (/translat/.test(source)) return "translation";
  if (/extract/.test(source)) return "extraction";
  if (/classif|categor/.test(source)) return "classification";
  if (/sentiment|tone/.test(source)) return "sentiment-analysis";
  if (/summari[sz]/.test(source) && /record|entity/.test(source)) return "record-summarisation";
  if (/summari[sz]/.test(source)) return "text-summarisation";
  if (/reply|draft a response|respond/.test(source)) return "response-drafting";
  if (/predict|forecast|infer/.test(source)) return "prediction";
  return "unknown";
}

function familyRole(family: ArchitectureCapabilityFamily): string {
  switch (family) {
    case "translation": return "Translate incoming or outgoing text";
    case "extraction": return "Extract candidate structured values for validation";
    case "classification": return "Classify intent or category for routing and review";
    case "sentiment-analysis": return "Add a non-authoritative tone or sentiment signal";
    case "text-summarisation": return "Summarize the incoming message or conversation";
    case "record-summarisation": return "Summarize related Dataverse record context";
    case "response-drafting": return "Draft a response for human review";
    case "prediction": return "Produce a proposal or prediction for review";
    default: return "Support the metadata-described operation";
  }
}

function maxResults(args: Record<string, unknown>): number {
  const value = Number(args.maxStages ?? 6);
  return Number.isFinite(value) ? Math.max(1, Math.min(10, Math.floor(value))) : 6;
}

function containsAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

const UNSUPPORTED_ARCHITECTURE_PARADIGMS: readonly RegExp[] = [
  /\bquantum\b/i
];

function hasUnsupportedArchitectureParadigm(goal: string): boolean {
  return containsAny(goal, UNSUPPORTED_ARCHITECTURE_PARADIGMS);
}

function architectureRecommendationGoal(goal: string): { recommendationGoal: string; profile?: string } {
  const customerEngagement = containsAny(goal, [
    /customer service/i,
    /customer support/i,
    /customer engagement/i,
    /customer email/i,
    /customer enquir/i,
    /customer message/i,
    /customer histor/i,
    /case histor/i,
    /previous (?:customer )?interactions?/i,
    /record histor/i,
    /dataverse histor/i,
    /patient enquir/i,
    /support workflow/i
  ]);
  if (!customerEngagement) return { recommendationGoal: goal };

  const capabilityIntent = [
    "classify intent for routing",
    "assess sentiment as a non-authoritative signal",
    "summarize message context",
    "summarize related Dataverse record context",
    "draft a response for human review"
  ];
  if (containsAny(goal, [/multilingual/i, /different language/i, /translat/i, /non-english/i])) {
    capabilityIntent.unshift("translate multilingual input");
  }
  return {
    recommendationGoal: `${goal}. Architecture completeness profile: ${capabilityIntent.join("; ")}.`,
    profile: "customer-engagement"
  };
}

function isOptional(item: McpCustomApiGoalRecommendation, goal: string): boolean {
  if (item.category === "translation") {
    return !containsAny(goal, [/multilingual/i, /different language/i, /translat/i, /non-english/i]);
  }
  if (item.category === "sentiment-analysis") {
    return !containsAny(goal, [/sentiment/i, /tone/i, /dissatisf/i, /urgency/i, /frustrat/i]);
  }
  if (item.category === "extraction") {
    return !containsAny(goal, [/extract/i, /structured/i, /field/i, /invoice/i, /document/i]);
  }
  return false;
}

function orderingRationale(item: McpCustomApiGoalRecommendation): string {
  switch (capabilityFamily(item)) {
    case "translation": return "Translate first so downstream interpretation operates on a consistent language.";
    case "extraction": return "Extract candidate structured values before classification, summarisation or persistence.";
    case "classification": return "Classify before response generation so routing and later stages can use the identified intent.";
    case "sentiment-analysis": return "Assess tone before drafting so it can remain a non-authoritative review signal.";
    case "text-summarisation": return "Summarise the incoming message before drafting so the response uses concise conversation context.";
    case "record-summarisation": return "Summarise related Dataverse records before drafting so the response is grounded in business context.";
    case "response-drafting": return "Draft near the end after the available understanding stages have produced context.";
    default: return "Place this operation according to its metadata-described workflow role.";
  }
}

function orderedRecommendations(decision: McpCustomApiRecommendationDecision): McpCustomApiGoalRecommendation[] {
  const eligible = decision.recommendations.filter((item) => {
    const family = capabilityFamily(item);
    return family !== "plugin-lifecycle" && family !== "administration" && family !== "unknown";
  });
  const bestByFamily = new Map<ArchitectureCapabilityFamily, McpCustomApiGoalRecommendation>();
  for (const item of eligible) {
    const family = capabilityFamily(item);
    const current = bestByFamily.get(family);
    if (!current || item.score > current.score || (item.score === current.score && canonicalPreference(item, current) < 0)) {
      bestByFamily.set(family, item);
    }
  }
  return [...bestByFamily.values()].sort((left, right) =>
    WORKFLOW_PRIORITY[capabilityFamily(left)] - WORKFLOW_PRIORITY[capabilityFamily(right)]
    || right.score - left.score
    || left.uniqueName.localeCompare(right.uniqueName)
  );
}

function canonicalPreference(left: McpCustomApiGoalRecommendation, right: McpCustomApiGoalRecommendation): number {
  const leftAi = /^AI/.test(left.uniqueName) ? 0 : 1;
  const rightAi = /^AI/.test(right.uniqueName) ? 0 : 1;
  return leftAi - rightAi || left.uniqueName.localeCompare(right.uniqueName);
}

function buildStages(goal: string, decision: McpCustomApiRecommendationDecision, maximum: number): McpSolutionArchitectureStage[] {
  const stages: McpSolutionArchitectureStage[] = orderedRecommendations(decision).slice(0, maximum).map((item, index) => ({
    order: index + 1,
    kind: "custom-api",
    uniqueName: item.uniqueName,
    capabilityFamily: capabilityFamily(item),
    purpose: item.purpose ?? item.workflowRole,
    workflowRole: familyRole(capabilityFamily(item)),
    required: !isOptional(item, goal),
    confidence: item.confidence,
    score: item.score,
    whyHere: item.reasons,
    orderingRationale: orderingRationale(item)
  }));

  if (stages.some((stage) => stage.uniqueName === "AIReply" || /draft|reply|response/i.test(stage.workflowRole))) {
    stages.push({
      order: stages.length + 1,
      kind: "human-review",
      capabilityFamily: "human-review",
      purpose: "Review generated wording before it is used in customer communication or a consequential process.",
      workflowRole: "Human validation and approval",
      required: true,
      confidence: "high",
      whyHere: ["Generated or inferred text should remain subject to appropriate human review."],
      orderingRationale: "Review follows response drafting and precedes sending, persistence or consequential use."
    });
  }
  return stages;
}

function renumber(stages: readonly McpSolutionArchitectureStage[]): McpSolutionArchitectureStage[] {
  return stages.map((stage, index) => ({ ...stage, order: index + 1 }));
}

function alternativeArchitectures(stages: readonly McpSolutionArchitectureStage[]) {
  const apiStages = stages.filter((stage) => stage.kind === "custom-api");
  const review = stages.filter((stage) => stage.kind === "human-review");
  const drafting = apiStages.find((stage) => stage.capabilityFamily === "response-drafting");
  const classification = apiStages.find((stage) => stage.capabilityFamily === "classification");
  const recordContext = apiStages.find((stage) => stage.capabilityFamily === "record-summarisation");
  const simpleContext = classification ?? recordContext;
  const simpleApis = [simpleContext, drafting].filter((stage): stage is McpSolutionArchitectureStage => Boolean(stage));
  const recommendedApis = apiStages.filter((stage) => stage.required);
  const recommendedHasDrafting = recommendedApis.some((stage) => stage.capabilityFamily === "response-drafting");
  if (drafting && !recommendedHasDrafting) recommendedApis.push(drafting);
  return [
    {
      id: "recommended",
      label: "Recommended",
      rationale: "Keeps the required scenario capabilities, response drafting and explicit review boundary.",
      stages: renumber([...recommendedApis, ...review])
    },
    {
      id: "simple",
      label: "Simpler",
      rationale: "Keeps one understanding or context stage, response drafting and human review.",
      stages: renumber([...simpleApis, ...review])
    },
    {
      id: "extended",
      label: "Extended",
      rationale: "Includes required and optional metadata-backed interpretation stages before review.",
      stages: renumber([...apiStages, ...review])
    }
  ];
}

function risks(stages: readonly McpSolutionArchitectureStage[], goal: string): string[] {
  const result = [
    "The architecture is metadata-derived and does not verify runtime OData exposure, privileges, side effects or safe execution.",
    "Custom API output must be validated before persistence or consequential use."
  ];
  if (stages.some((stage) => stage.kind === "human-review")) {
    result.push("Human review is required before generated response text is sent or treated as authoritative.");
  }
  if (/without human review|fully automated|auto[- ]?send/i.test(goal)) {
    result.push("The stated goal suggests bypassing human review; DVQR does not recommend autonomous use of generated customer-facing wording.");
  }
  if (stages.some((stage) => !stage.required)) {
    result.push("Optional stages should be retained only when their triggering requirement is present in the real solution context.");
  }
  return result;
}

function architectureText(goal: string, decision: McpCustomApiRecommendationDecision, stages: readonly McpSolutionArchitectureStage[]): string {
  const lines = [`Solution architecture recommendation for: ${goal}`];
  lines.push(`Decision posture: ${decision.posture}; confidence: ${decision.confidence}.`);
  if (!stages.length) {
    lines.push("No strong metadata-backed architecture could be assembled.");
    lines.push("DVQR did not invent a pipeline from weak or unrelated matches.");
    return lines.join("\n");
  }
  lines.push("");
  lines.push("Recommended pipeline");
  for (const stage of stages) {
    const name = stage.uniqueName ?? "Human Review";
    lines.push(`${stage.order}. ${name}${stage.required ? "" : " (optional)"} — ${stage.workflowRole}`);
    lines.push(`   Why here: ${stage.orderingRationale}`);
  }
  lines.push("");
  lines.push("Architecture rationale");
  for (const rationale of decision.rationale) lines.push(`- ${rationale}`);
  lines.push("- Each stage has a distinct metadata-described role; duplicate capability stages are not added.");
  lines.push("");
  lines.push("Risks and evidence boundary");
  for (const risk of risks(stages, goal)) lines.push(`- ${risk}`);
  return lines.join("\n");
}

export class McpSolutionArchitectureRecommendationApplicationService {
  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly repository: McpSolutionArchitectureCatalogueRepositoryLike = new McpCustomApiMetadataRepository(config)
  ) {}

  public async recommend(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const goal = stringArg(args, "goal");
    if (!goal) return { ok: false, code: "InvalidArguments", message: "goal is required." };
    const environment = validateEnvironmentUrl(args, this.config);
    if (!environment.ok) return environment;
    try {
      const snapshot = await this.repository.discover(environment.environmentUrl);
      const unsupportedParadigm = hasUnsupportedArchitectureParadigm(goal);
      const architectureGoal = unsupportedParadigm
        ? { recommendationGoal: goal, profile: undefined }
        : architectureRecommendationGoal(goal);
      const recommendationDecision = buildCustomApiRecommendationDecision(
        architectureGoal.recommendationGoal,
        snapshot.definitions,
        Math.max(20, maxResults(args) * 4)
      );
      const decision: McpCustomApiRecommendationDecision = unsupportedParadigm
        ? {
            ...recommendationDecision,
            posture: "no-strong-fit",
            confidence: "none",
            rationale: [
              "The requested architecture includes a technology paradigm that is not described by the available public Custom API metadata.",
              "DVQR preserved the original goal and did not reinterpret it as an adjacent prediction, classification or automation problem.",
              ...recommendationDecision.rationale
            ],
            recommendations: []
          }
        : recommendationDecision;
      const stages = buildStages(goal, decision, maxResults(args));
      const alternatives = stages.length ? alternativeArchitectures(stages) : [];
      return {
        ok: true,
        summary: stages.length
          ? `Built a ${stages.length}-stage metadata-backed solution architecture recommendation.`
          : "No strong metadata-backed solution architecture could be assembled.",
        displayText: architectureText(goal, decision, stages),
        structuredContent: {
          contractVersion: "dvqr-mcp-solution-architecture-v1",
          environmentUrl: environment.environmentUrl,
          goal,
          decision: {
            posture: decision.posture,
            confidence: decision.confidence,
            confidenceSource: "custom-api-recommendation-decision",
            allowClosestMatch: decision.posture !== "no-strong-fit",
            responseDirective: decision.posture === "no-strong-fit"
              ? "Report that no metadata-backed architecture exists. Do not call discovery, recommendation, definition or explain tools to construct an adjacent substitute architecture."
              : "Render the returned pipeline and confidence without upgrading or reinterpreting them.",
            rationale: decision.rationale,
            unmatchedGoalConcepts: decision.unmatchedGoalConcepts,
            excludedDomains: decision.excludedDomains
          },
          architectureProfile: architectureGoal.profile
            ? {
                id: architectureGoal.profile,
                source: "deterministic-scenario-profile",
                purpose: "Completeness guidance for a recognised solution scenario; this is architectural interpretation, not additional Dataverse metadata."
              }
            : undefined,
          guidanceBoundary: {
            metadataBacked: ["Custom API identity", "metadata-described purpose", "semantic capability family", "workflow role", "recommendation score and confidence"],
            architecturalInterpretation: ["stage ordering", "human-review boundary", "minimal/recommended/extended alternatives", "solution layers and operating guidance"],
            runtimeUnverified: ["API exposure", "permissions", "side effects", "latency", "cost", "business and regulatory suitability"]
          },
          recommendedPipeline: stages,
          optionalStages: stages.filter((stage) => !stage.required),
          alternativeArchitectures: alternatives,
          risks: risks(stages, goal),
          evidenceBoundary: "The architecture is assembled deterministically from one public Custom API metadata snapshot and the existing recommendation rules. It does not validate runtime exposure, permissions, side effects or execution safety."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Solution architecture recommendation failed." };
    }
  }
}
