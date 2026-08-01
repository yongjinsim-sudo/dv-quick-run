import type { CustomApiDefinition } from "../customApi/models/customApiTypes.js";

export interface McpCustomApiRelatedRecommendation {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly operationKind: CustomApiDefinition["operationKind"];
  readonly bindingKind: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly purpose?: string;
}


export interface McpCustomApiAlternativeRecommendation {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly score: number;
  readonly purpose?: string;
  readonly betterFitWhen: string;
  readonly reasons: readonly string[];
}

export interface McpCustomApiDecisionSupport {
  readonly bestUsedFor: readonly string[];
  readonly notIdealFor: readonly string[];
  readonly alternatives: readonly McpCustomApiAlternativeRecommendation[];
  readonly typicalWorkflow: readonly string[];
  readonly conceptTags: readonly string[];
  readonly summary: {
    readonly purpose: string;
    readonly primaryInput?: string;
    readonly primaryOutput?: string;
    readonly bestFor: string;
    readonly avoidFor: string;
    readonly alternatives: readonly string[];
  };
  readonly guidanceSource: "deterministic-metadata-interpretation";
}

export interface McpCustomApiUsageGuidance {
  readonly useWhen: readonly string[];
  readonly avoidWhen: readonly string[];
  readonly guidanceSource: "deterministic-metadata-interpretation";
}

const STOP_WORDS = new Set([
  "a", "an", "and", "api", "action", "custom", "dataverse", "for", "from", "in", "is", "of", "or", "the", "this", "to", "using", "with"
]);

function bindingKind(definition: CustomApiDefinition): string {
  if (definition.bindingKind === "Unbound" || definition.boundTargetKind === "none") return "Global";
  if (definition.boundTargetKind === "entity") return "Entity";
  if (definition.boundTargetKind === "collection") return "EntityCollection";
  return "Unresolved";
}

function words(value: string | undefined): string[] {
  return (value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function tokens(definition: CustomApiDefinition): Set<string> {
  return new Set([
    ...words(definition.uniqueName),
    ...words(definition.displayName),
    ...words(definition.description),
    ...definition.requestParameters.flatMap((parameter) => [
      ...words(parameter.uniqueName),
      ...words(parameter.displayName),
      ...words(parameter.typeLabel),
      ...words(parameter.logicalEntityName)
    ]),
    ...definition.responseProperties.flatMap((property) => [
      ...words(property.uniqueName),
      ...words(property.displayName),
      ...words(property.typeLabel)
    ])
  ]);
}

function sharedValues(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => right.has(value));
}

function sharedParameterNames(left: CustomApiDefinition, right: CustomApiDefinition): string[] {
  const rightNames = new Set(right.requestParameters.map((item) => item.uniqueName.toLowerCase()));
  return left.requestParameters
    .map((item) => item.uniqueName)
    .filter((name) => rightNames.has(name.toLowerCase()));
}

function commonPrefix(left: string, right: string): string {
  let index = 0;
  while (index < left.length && index < right.length && left[index].toLowerCase() === right[index].toLowerCase()) index += 1;
  return left.slice(0, index);
}

export function recommendRelatedCustomApis(
  definition: CustomApiDefinition,
  catalogue: readonly CustomApiDefinition[],
  maximum = 5
): McpCustomApiRelatedRecommendation[] {
  const sourceTokens = tokens(definition);
  return catalogue
    .filter((candidate) => candidate.uniqueName !== definition.uniqueName && candidate.isPrivate !== true)
    .map((candidate) => {
      const overlap = sharedValues(sourceTokens, tokens(candidate));
      const sharedParameters = sharedParameterNames(definition, candidate);
      const prefix = commonPrefix(definition.uniqueName, candidate.uniqueName);
      const reasons: string[] = [];
      let score = overlap.length * 12;
      if (prefix.length >= 2) {
        score += Math.min(28, prefix.length * 4);
        reasons.push(`Shares the ${prefix} naming family.`);
      }
      if (sharedParameters.length) {
        score += Math.min(24, sharedParameters.length * 12);
        reasons.push(`Shares request parameter${sharedParameters.length === 1 ? "" : "s"}: ${sharedParameters.join(", ")}.`);
      }
      if (candidate.operationKind === definition.operationKind) {
        score += 8;
        reasons.push(`Uses the same ${definition.operationKind} operation model.`);
      }
      if (bindingKind(candidate) === bindingKind(definition)) {
        score += 6;
        reasons.push(`Uses the same ${bindingKind(definition)} binding model.`);
      }
      const meaningfulOverlap = overlap.filter((value) => value.length > 2).slice(0, 4);
      if (meaningfulOverlap.length) reasons.unshift(`Shares metadata concepts: ${meaningfulOverlap.join(", ")}.`);
      return {
        uniqueName: candidate.uniqueName,
        displayName: candidate.displayName,
        operationKind: candidate.operationKind,
        bindingKind: bindingKind(candidate),
        score: Math.min(100, score),
        reasons: reasons.slice(0, 3),
        purpose: candidate.description
      };
    })
    .filter((item) => item.score >= 18 && item.reasons.length > 0)
    .sort((left, right) => right.score - left.score || left.uniqueName.localeCompare(right.uniqueName))
    .slice(0, maximum);
}

function text(definition: CustomApiDefinition): string {
  return `${definition.uniqueName} ${definition.displayName ?? ""} ${definition.description ?? ""}`.toLowerCase();
}

export function buildCustomApiUsageGuidance(definition: CustomApiDefinition): McpCustomApiUsageGuidance {
  const source = text(definition);
  const useWhen: string[] = [];
  const avoidWhen: string[] = [];
  const rules: Array<{ match: RegExp; use: string[]; avoid: string[] }> = [
    {
      match: /reply|response|respond|draft/,
      use: ["Drafting a reply or response from supplied text.", "Creating conversational or customer-facing text that a person can review before use."],
      avoid: ["The goal is summarisation, translation, classification or sentiment analysis rather than response drafting.", "The generated wording would be used without appropriate human review for a consequential decision."]
    },
    {
      match: /summari[sz]/,
      use: ["Condensing longer text or record content into a shorter summary.", "Providing reviewers with a concise overview before they inspect the source material."],
      avoid: ["The goal is to draft a reply, translate content or determine sentiment.", "Important source detail must be preserved verbatim rather than condensed."]
    },
    {
      match: /translat/,
      use: ["Translating supplied text between supported languages.", "Producing a draft translation for review."],
      avoid: ["The goal is summarisation, classification or new-content generation.", "A legally certified or domain-validated translation is required."]
    },
    {
      match: /sentiment/,
      use: ["Estimating the sentiment expressed in supplied text.", "Supporting triage or prioritisation where sentiment is one non-authoritative signal."],
      avoid: ["The result would be treated as a definitive judgement about a person or situation.", "The goal is to draft, translate or summarise text."]
    },
    {
      match: /classif|categor/,
      use: ["Assigning supplied content to one of the operation's intended categories.", "Supporting review or routing where classification is treated as a proposal."],
      avoid: ["The category decision must be authoritative without human or business-rule validation.", "The goal is extraction, summarisation or response generation."]
    },
    {
      match: /extract/,
      use: ["Extracting structured values from supplied content.", "Preparing candidate data for validation before it is written to Dataverse."],
      avoid: ["Extracted values would be persisted without validation.", "The goal is to generate, translate or summarise text."]
    }
  ];
  for (const rule of rules) {
    if (rule.match.test(source)) {
      useWhen.push(...rule.use);
      avoidWhen.push(...rule.avoid);
      break;
    }
  }
  if (!useWhen.length) {
    useWhen.push(`The metadata-described purpose of ${definition.uniqueName} matches the business operation you need to perform.`);
    useWhen.push("The caller can supply every required input using the declared Dataverse parameter types.");
  }
  if (!avoidWhen.length) {
    avoidWhen.push("The operation's metadata-described purpose does not match the intended business outcome.");
    avoidWhen.push("Privileges, side effects, OData exposure or parameter serialisation must be assumed rather than verified.");
  }
  return { useWhen, avoidWhen, guidanceSource: "deterministic-metadata-interpretation" };
}


export function customApiKnowledgeCategory(value: string): string | undefined {
  const categories: Array<[RegExp, string]> = [
    [/reply|response|respond|draft/, "response-drafting"],
    [/summari[sz]/, "summarisation"],
    [/translat/, "translation"],
    [/sentiment/, "sentiment-analysis"],
    [/classif|categor/, "classification"],
    [/extract/, "extraction"],
    [/predict|infer/, "prediction"],
    [/search|query/, "search"],
    [/create|generate/, "generation"],
    [/update|set/, "update"],
    [/delete|remove|clear/, "deletion"]
  ];
  return categories.find(([pattern]) => pattern.test(value))?.[1];
}

function categoryGuidance(categoryName: string | undefined): { label: string; betterFitWhen: string } {
  switch (categoryName) {
    case "response-drafting": return { label: "Response Drafting", betterFitWhen: "the goal is to draft a reply or conversational response" };
    case "summarisation": return { label: "Summarisation", betterFitWhen: "the goal is to condense text or record content" };
    case "translation": return { label: "Translation", betterFitWhen: "the goal is to translate text while preserving meaning" };
    case "sentiment-analysis": return { label: "Sentiment Analysis", betterFitWhen: "the goal is to assess the tone or sentiment of text" };
    case "classification": return { label: "Classification", betterFitWhen: "the goal is to categorise supplied content" };
    case "extraction": return { label: "Extraction", betterFitWhen: "the goal is to extract structured values from content" };
    case "prediction": return { label: "Prediction", betterFitWhen: "the goal is to infer or predict an outcome" };
    case "search": return { label: "Search", betterFitWhen: "the goal is to retrieve or search for matching information" };
    case "generation": return { label: "Generation", betterFitWhen: "the goal is to generate new content or an artefact" };
    case "update": return { label: "Update", betterFitWhen: "the goal is to change existing Dataverse state" };
    case "deletion": return { label: "Deletion", betterFitWhen: "the goal is to remove or clear existing Dataverse state" };
    default: return { label: "Custom Operation", betterFitWhen: "its metadata-described purpose matches the intended outcome more closely" };
  }
}

function firstRequiredInput(definition: CustomApiDefinition): string | undefined {
  return definition.requestParameters.find((parameter) => parameter.isOptional !== true)?.uniqueName
    ?? definition.requestParameters[0]?.uniqueName;
}

function firstOutput(definition: CustomApiDefinition): string | undefined {
  return definition.responseProperties[0]?.uniqueName;
}

function workflowFor(definition: CustomApiDefinition): string[] {
  const required = definition.requestParameters.filter((parameter) => parameter.isOptional !== true).map((parameter) => parameter.uniqueName);
  const outputs = definition.responseProperties.map((property) => property.uniqueName);
  const steps: string[] = [];
  if (definition.boundTargetKind === "entity") {
    steps.push(`Select the target ${definition.boundEntityLogicalName ?? "Dataverse"} row.`);
  } else if (definition.boundTargetKind === "collection") {
    steps.push(`Select the target ${definition.boundEntityLogicalName ?? "Dataverse"} table collection.`);
  }
  steps.push(required.length
    ? `Supply the required input${required.length === 1 ? "" : "s"}: ${required.join(", ")}.`
    : "Prepare the operation request using its declared binding context.");
  steps.push(`${definition.uniqueName} performs its metadata-described ${definition.operationKind.toLowerCase()} operation.`);
  if (outputs.length) steps.push(`Read the declared response ${outputs.length === 1 ? "property" : "properties"}: ${outputs.join(", ")}.`);
  else steps.push("Confirm successful completion; the metadata declares no business response properties.");
  steps.push("Validate the result before using it in a consequential business process or persisting derived values.");
  return steps;
}

function conceptTagsFor(definition: CustomApiDefinition): string[] {
  const source = text(definition);
  const tags = new Set<string>();
  const mapped: Array<[RegExp, string]> = [
    [/\bai\b|gpt|copilot/, "AI"],
    [/reply|response|respond|draft/, "Response Drafting"],
    [/summari[sz]/, "Summarisation"],
    [/translat/, "Translation"],
    [/sentiment/, "Sentiment Analysis"],
    [/classif|categor/, "Classification"],
    [/extract/, "Extraction"],
    [/search|query/, "Search"],
    [/text|string/, "Text Processing"],
    [/record|entity/, "Record Processing"]
  ];
  for (const [pattern, tag] of mapped) if (pattern.test(source)) tags.add(tag);
  tags.add(definition.operationKind);
  tags.add(bindingKind(definition));
  tags.add(definition.operationKind === "Function" ? "GET" : "POST");
  return [...tags].slice(0, 8);
}

export function buildCustomApiDecisionSupport(
  definition: CustomApiDefinition,
  usageGuidance: McpCustomApiUsageGuidance,
  relatedApis: readonly McpCustomApiRelatedRecommendation[]
): McpCustomApiDecisionSupport {
  const sourceCategory = customApiKnowledgeCategory(text(definition));
  const alternatives = relatedApis
    .map((item) => {
      const candidateCategory = customApiKnowledgeCategory(`${item.uniqueName} ${item.displayName ?? ""} ${item.purpose ?? ""}`.toLowerCase());
      return {
        uniqueName: item.uniqueName,
        displayName: item.displayName,
        score: item.score,
        purpose: item.purpose,
        betterFitWhen: categoryGuidance(candidateCategory).betterFitWhen,
        reasons: item.reasons
      };
    })
    .filter((item) => {
      const candidateCategory = customApiKnowledgeCategory(`${item.uniqueName} ${item.displayName ?? ""} ${item.purpose ?? ""}`.toLowerCase());
      return candidateCategory !== sourceCategory || item.score >= 45;
    })
    .slice(0, 5);

  const primaryInput = firstRequiredInput(definition);
  const primaryOutput = firstOutput(definition);
  const bestFor = usageGuidance.useWhen[0] ?? `Using ${definition.uniqueName} for its metadata-described purpose.`;
  const avoidFor = usageGuidance.avoidWhen[0] ?? "Using the operation for a different business outcome.";

  return {
    bestUsedFor: usageGuidance.useWhen,
    notIdealFor: usageGuidance.avoidWhen,
    alternatives,
    typicalWorkflow: workflowFor(definition),
    conceptTags: conceptTagsFor(definition),
    summary: {
      purpose: definition.description?.trim() || `${definition.uniqueName} is a ${bindingKind(definition)} Dataverse ${definition.operationKind}.`,
      ...(primaryInput ? { primaryInput } : {}),
      ...(primaryOutput ? { primaryOutput } : {}),
      bestFor,
      avoidFor,
      alternatives: alternatives.map((item) => item.uniqueName)
    },
    guidanceSource: "deterministic-metadata-interpretation"
  };
}


export type McpCustomApiRecommendationConfidence = "high" | "medium" | "low";

export interface McpCustomApiGoalRecommendation {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly operationKind: CustomApiDefinition["operationKind"];
  readonly bindingKind: string;
  readonly score: number;
  readonly confidence: McpCustomApiRecommendationConfidence;
  readonly purpose?: string;
  readonly category?: string;
  readonly workflowRole: string;
  readonly reasons: readonly string[];
  readonly cautions: readonly string[];
  readonly scoreBreakdown: {
    readonly categoryMatch: number;
    readonly conceptOverlap: number;
    readonly shapeSupport: number;
    readonly domainPenalty: number;
  };
}

export interface McpCustomApiRecommendationDecision {
  readonly posture: "strong-fit" | "partial-fit" | "no-strong-fit";
  readonly confidence: "high" | "medium" | "none";
  readonly requestedCategories: readonly string[];
  readonly excludedDomains: readonly string[];
  readonly unmatchedGoalConcepts: readonly string[];
  readonly rationale: readonly string[];
  readonly recommendations: readonly McpCustomApiGoalRecommendation[];
}

const GOAL_CATEGORY_RULES: ReadonlyArray<{ readonly pattern: RegExp; readonly category: string; readonly role: string }> = [
  { pattern: /reply|respond|response|draft|compose|customer service|case management|support workflow/, category: "response-drafting", role: "Draft a response for human review" },
  { pattern: /summari[sz]|summary|condense|overview|brief|history|historical|previous interactions?|record context|customer service|case management|support workflow/, category: "summarisation", role: "Create concise context from longer content" },
  { pattern: /translat|language|multilingual/, category: "translation", role: "Translate incoming or outgoing text" },
  { pattern: /sentiment|tone|emotion|dissatisf|urgency|customer service|case management|support workflow/, category: "sentiment-analysis", role: "Add a non-authoritative tone or sentiment signal" },
  { pattern: /classif|categor|intent|route|triage|customer service|case management|support workflow/, category: "classification", role: "Classify intent or category for routing and review" },
  { pattern: /extract|structured|field|value/, category: "extraction", role: "Extract candidate structured values for validation" },
  { pattern: /predict|infer|forecast/, category: "prediction", role: "Produce a proposal or prediction for review" },
  { pattern: /search|find|retrieve|lookup/, category: "search", role: "Retrieve or search for relevant information" }
];

const NON_DISCRIMINATING_GOAL_WORDS = new Set([
  "api", "apis", "application", "business", "create", "customer", "customers", "dataverse", "goal", "incoming", "message", "messages", "need", "outgoing",
  "service", "solution", "text", "content", "use", "using", "workflow", "workflows", "want"
]);

const WEAK_CATEGORY_ONLY_MATCHES = new Set(["prediction", "search"]);

const EXCLUSION_RULES: ReadonlyArray<{ readonly domain: string; readonly request: RegExp; readonly definition: RegExp }> = [
  { domain: "administration", request: /administration|administrative|security/, definition: /admin|credential|certificate|permission|delegated|consent|capacity|tenant/ },
  { domain: "plugin-generation", request: /plugin(?:-|\s)?generation|plugins?/, definition: /plugin/ },
  { domain: "deployment", request: /deployment|deploy|solution packaging/, definition: /deploy|publish|solution component|import solution|export solution/ },
  { domain: "infrastructure", request: /infrastructure|setup|provisioning/, definition: /setup|provision|connection|network|machine|environment|datasource|index|fabric|azure/ },
  { domain: "testing-monitoring", request: /testing|monitoring|feedback|evaluation/, definition: /test|feedback|evaluation|monitor|status|history|telemetry/ }
];

function goalWords(goal: string): Set<string> {
  return new Set(words(goal).filter((word) => !NON_DISCRIMINATING_GOAL_WORDS.has(word)));
}

function categoryForDefinition(definition: CustomApiDefinition): string | undefined {
  return customApiKnowledgeCategory(text(definition));
}

function requestedGoalCategories(goal: string): Array<{ category: string; role: string }> {
  const normalized = goal.toLowerCase();
  const matches = GOAL_CATEGORY_RULES.filter((rule) => rule.pattern.test(normalized)).map((rule) => ({ category: rule.category, role: rule.role }));
  return matches.filter((item, index) => matches.findIndex((candidate) => candidate.category === item.category) === index);
}

function workflowRoleFor(categoryName: string | undefined): string {
  return GOAL_CATEGORY_RULES.find((rule) => rule.category === categoryName)?.role
    ?? categoryGuidance(categoryName).betterFitWhen.replace(/^the goal is to /, "Support ");
}

function explicitExcludedDomains(goal: string): string[] {
  const normalized = goal.toLowerCase();
  const hasExclusionIntent = /exclude|excluding|without|do not include|don't include|avoid/.test(normalized);
  if (!hasExclusionIntent) return [];
  return EXCLUSION_RULES.filter((rule) => rule.request.test(normalized)).map((rule) => rule.domain);
}

function definitionDomains(definition: CustomApiDefinition): string[] {
  const source = text(definition);
  return EXCLUSION_RULES.filter((rule) => rule.definition.test(source)).map((rule) => rule.domain);
}

function isBusinessContentGoal(categories: ReadonlySet<string>): boolean {
  return [...categories].some((category) => [
    "response-drafting", "summarisation", "translation", "sentiment-analysis", "classification", "extraction"
  ].includes(category));
}

function confidenceFor(
  categoryMatch: boolean,
  overlapCount: number,
  categoryName: string | undefined,
  domainPenalty: number
): McpCustomApiRecommendationConfidence {
  if (domainPenalty < 0) return "low";
  if (categoryMatch && overlapCount > 0) return "high";
  if (categoryMatch && categoryName && !WEAK_CATEGORY_ONLY_MATCHES.has(categoryName)) return "medium";
  if (overlapCount >= 2) return "medium";
  return "low";
}

export function buildCustomApiRecommendationDecision(
  goal: string,
  catalogue: readonly CustomApiDefinition[],
  maximum = 5
): McpCustomApiRecommendationDecision {
  const normalizedGoal = goal.trim().toLowerCase();
  const requestedCategories = requestedGoalCategories(normalizedGoal);
  const requestedCategorySet = new Set(requestedCategories.map((item) => item.category));
  const excludedDomains = explicitExcludedDomains(normalizedGoal);
  const excludedDomainSet = new Set(excludedDomains);
  const goalTokenSet = goalWords(goal);
  const businessContentGoal = isBusinessContentGoal(requestedCategorySet);

  const recommendations = catalogue
    .filter((definition) => definition.isPrivate !== true)
    .filter((definition) => !definitionDomains(definition).some((domain) => excludedDomainSet.has(domain)))
    .map((definition) => {
      const definitionTokens = tokens(definition);
      const overlap = sharedValues(goalTokenSet, definitionTokens).filter((token) => token.length > 2);
      const definitionCategory = categoryForDefinition(definition);
      const categoryMatch = Boolean(definitionCategory && requestedCategorySet.has(definitionCategory));
      const domains = definitionDomains(definition);
      const operationalNoise = businessContentGoal && domains.length > 0 && !categoryMatch;
      const categoryPoints = categoryMatch ? 58 : 0;
      const conceptPoints = Math.min(28, overlap.length * 14);
      const shapePoints = (definition.operationKind === "Action" ? 4 : 0)
        + (bindingKind(definition) === "Global" ? 3 : 0)
        + (definition.requestParameters.some((parameter) => /string|text/i.test(`${parameter.typeLabel ?? ""} ${parameter.typeCategory ?? ""}`)) ? 4 : 0);
      const domainPenalty = operationalNoise ? -45 : 0;
      const score = Math.max(0, Math.min(100, categoryPoints + conceptPoints + shapePoints + domainPenalty));
      const confidence = confidenceFor(categoryMatch, overlap.length, definitionCategory, domainPenalty);
      const reasons: string[] = [];
      const cautions: string[] = [];

      if (categoryMatch && definitionCategory) {
        reasons.push(`Matches the requested ${categoryGuidance(definitionCategory).label.toLowerCase()} outcome.`);
      }
      if (overlap.length) {
        reasons.push(`Shares specific goal concepts: ${overlap.slice(0, 5).join(", ")}.`);
      }
      if (bindingKind(definition) === "Global") {
        reasons.push("Can be understood as a global operation without a selected Dataverse row.");
      }
      if (!definition.description?.trim()) {
        cautions.push("The Custom API has no descriptive metadata, so goal matching is weaker.");
      }
      if (confidence !== "high") {
        cautions.push("The match is advisory because the metadata does not cover every concept in the stated goal.");
      }
      cautions.push("Runtime OData exposure, privileges, side effects and safe execution are not verified by this recommendation.");

      return {
        uniqueName: definition.uniqueName,
        displayName: definition.displayName,
        operationKind: definition.operationKind,
        bindingKind: bindingKind(definition),
        score,
        confidence,
        purpose: definition.description,
        category: definitionCategory,
        workflowRole: workflowRoleFor(definitionCategory),
        reasons: reasons.slice(0, 4),
        cautions,
        scoreBreakdown: {
          categoryMatch: categoryPoints,
          conceptOverlap: conceptPoints,
          shapeSupport: shapePoints,
          domainPenalty
        }
      } satisfies McpCustomApiGoalRecommendation;
    })
    .filter((item) => {
      if (!item.reasons.length) return false;
      if (item.confidence === "high") return item.score >= 55;
      if (item.confidence === "medium") return item.score >= 45;
      return false;
    })
    .sort((left, right) => {
      const confidenceRank = { high: 3, medium: 2, low: 1 } as const;
      return confidenceRank[right.confidence] - confidenceRank[left.confidence]
        || right.score - left.score
        || left.uniqueName.localeCompare(right.uniqueName);
    })
    .slice(0, maximum);

  const coveredGoalTokens = new Set<string>();
  for (const item of recommendations) {
    const definition = catalogue.find((candidate) => candidate.uniqueName === item.uniqueName);
    if (!definition) continue;
    for (const token of sharedValues(goalTokenSet, tokens(definition))) coveredGoalTokens.add(token);
  }
  const categoryTriggerWords = new Set(["reply", "respond", "response", "draft", "compose", "summarize", "summarise", "summary", "condense", "overview", "brief", "translate", "language", "multilingual", "sentiment", "tone", "emotion", "classify", "categorize", "categorise", "intent", "route", "triage", "extract", "structured", "predict", "infer", "forecast", "search", "find", "retrieve", "lookup"]);
  const exclusionTriggerWords = new Set(["exclude", "excluding", "without", "administration", "administrative", "security", "plugin", "generation", "deployment", "deploy", "infrastructure", "setup", "provisioning", "testing", "monitoring", "feedback", "evaluation"]);
  const unmatchedGoalConcepts = [...goalTokenSet].filter((token) => !coveredGoalTokens.has(token) && !categoryTriggerWords.has(token) && !exclusionTriggerWords.has(token));
  const top = recommendations[0];
  const posture = !top ? "no-strong-fit" : top.confidence === "high" ? "strong-fit" : "partial-fit";
  const confidence = !top ? "none" : top.confidence === "high" ? "high" : "medium";
  const rationale: string[] = [];
  if (!top) {
    rationale.push("No public Custom API met the minimum deterministic evidence threshold.");
  } else {
    rationale.push(`${top.uniqueName} is the strongest ${top.confidence}-confidence metadata match at ${top.score}/100.`);
  }
  if (excludedDomains.length) {
    rationale.push(`Explicitly excluded domains were honoured: ${excludedDomains.join(", ")}.`);
  }
  if (unmatchedGoalConcepts.length) {
    rationale.push(`The catalogue did not directly cover these goal concepts: ${unmatchedGoalConcepts.slice(0, 6).join(", ")}.`);
  }

  return {
    posture,
    confidence,
    requestedCategories: requestedCategories.map((item) => item.category),
    excludedDomains,
    unmatchedGoalConcepts,
    rationale,
    recommendations
  };
}

export function recommendCustomApisForGoal(
  goal: string,
  catalogue: readonly CustomApiDefinition[],
  maximum = 5
): McpCustomApiGoalRecommendation[] {
  return [...buildCustomApiRecommendationDecision(goal, catalogue, maximum).recommendations];
}


export interface McpCustomApiComparisonItem {
  readonly uniqueName: string;
  readonly displayName?: string;
  readonly purpose: string;
  readonly operationKind: CustomApiDefinition["operationKind"];
  readonly bindingKind: string;
  readonly expectedMethod: "GET" | "POST";
  readonly primaryInput?: string;
  readonly primaryOutput?: string;
  readonly bestUsedFor: readonly string[];
  readonly notIdealFor: readonly string[];
  readonly conceptTags: readonly string[];
}

export function buildCustomApiComparisonItem(definition: CustomApiDefinition): McpCustomApiComparisonItem {
  const usage = buildCustomApiUsageGuidance(definition);
  return {
    uniqueName: definition.uniqueName,
    displayName: definition.displayName,
    purpose: definition.description?.trim() || `${definition.uniqueName} is a ${bindingKind(definition)} Dataverse ${definition.operationKind}.`,
    operationKind: definition.operationKind,
    bindingKind: bindingKind(definition),
    expectedMethod: definition.operationKind === "Function" ? "GET" : "POST",
    primaryInput: firstRequiredInput(definition),
    primaryOutput: firstOutput(definition),
    bestUsedFor: usage.useWhen,
    notIdealFor: usage.avoidWhen,
    conceptTags: conceptTagsFor(definition)
  };
}
