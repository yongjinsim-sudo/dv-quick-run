import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import { DVQR_PROMPT_CATALOGUE } from "./promptCatalogue.js";
import { createDvqrPromptEvidenceMatrix } from "./promptEvidenceMatrix.js";
import { createDvqrPromptCatalogueCoverageReport, DVQR_INTENTIONALLY_UNCOVERED_PROMPT_TOOLS } from "./promptCatalogueCoverage.js";
import type { DvqrPromptDefinition, DvqrPromptSearchOptions, DvqrRenderedPrompt } from "./promptLibraryTypes.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function renderDvqrPrompt(prompt: DvqrPromptDefinition, values: Readonly<Record<string, string>>): DvqrRenderedPrompt {
  const missing = prompt.parameters
    .filter((parameter) => parameter.required && !normalize(values[parameter.id] ?? ""))
    .map((parameter) => parameter.id);

  let text = prompt.template;
  for (const parameter of prompt.parameters) {
    const value = values[parameter.id]?.trim();
    if (value) text = text.replaceAll(`{{${parameter.id}}}`, value);
  }

  return {
    promptId: prompt.id,
    text,
    missingRequiredParameters: missing,
    isReady: missing.length === 0
  };
}

export function searchDvqrPrompts(options: DvqrPromptSearchOptions = {}): readonly DvqrPromptDefinition[] {
  const query = normalize(options.query ?? "");
  return DVQR_PROMPT_CATALOGUE
    .filter((prompt) => !options.categoryId || prompt.categoryId === options.categoryId)
    .filter((prompt) => !options.tier || prompt.tier === options.tier)
    .filter((prompt) => !options.journeyStage || prompt.journeyStage === options.journeyStage)
    .map((prompt, index) => {
      if (!query) return { prompt, score: 0, index };
      const title = normalize(prompt.title);
      const tags = normalize(prompt.tags.join(" "));
      const description = normalize(prompt.description);
      const template = normalize(prompt.template);
      const score =
        (title === query ? 100 : 0) +
        (title.includes(query) ? 40 : 0) +
        (tags.includes(query) ? 25 : 0) +
        (description.includes(query) ? 15 : 0) +
        (template.includes(query) ? 10 : 0);
      return { prompt, score, index };
    })
    .filter((item) => !query || item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.prompt);
}

export function getDvqrPrompt(promptId: string): DvqrPromptDefinition | undefined {
  return DVQR_PROMPT_CATALOGUE.find((prompt) => prompt.id === promptId);
}

export function getDvqrPromptFollowUps(promptId: string): readonly DvqrPromptDefinition[] {
  const prompt = getDvqrPrompt(promptId);
  if (!prompt) return [];
  return prompt.followUpPromptIds.map(getDvqrPrompt).filter((candidate): candidate is DvqrPromptDefinition => Boolean(candidate));
}

export interface DvqrPromptCatalogueValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateDvqrPromptCatalogue(): DvqrPromptCatalogueValidationResult {
  const errors: string[] = [];
  const prompts = new Map(DVQR_PROMPT_CATALOGUE.map((prompt) => [prompt.id, prompt]));
  const tools = new Map(DVQR_LIVE_MCP_TOOLS.map((tool) => [tool.name, tool]));
  const evidence = new Set(createDvqrPromptEvidenceMatrix().map((entry) => entry.id));

  if (prompts.size !== DVQR_PROMPT_CATALOGUE.length) errors.push("Prompt IDs must be unique.");

  const liveToolNames = new Set(DVQR_LIVE_MCP_TOOLS.map((tool) => tool.name));
  for (const toolName of DVQR_INTENTIONALLY_UNCOVERED_PROMPT_TOOLS) {
    if (!liveToolNames.has(toolName)) errors.push(`Intentional uncovered tool ${toolName} is not in the live MCP catalogue.`);
  }

  for (const prompt of DVQR_PROMPT_CATALOGUE) {
    const tool = tools.get(prompt.capabilityTool);
    if (!tool) errors.push(`${prompt.id}: capability tool ${prompt.capabilityTool} is not in the live MCP catalogue.`);
    else if (tool.tier !== prompt.tier) errors.push(`${prompt.id}: prompt tier ${prompt.tier} does not match live tool tier ${tool.tier}.`);

    for (const evidenceRef of prompt.evidenceMatrixRefs) {
      if (!evidence.has(evidenceRef)) errors.push(`${prompt.id}: unknown evidence matrix ref ${evidenceRef}.`);
    }
    for (const linkedId of [...prompt.prerequisitePromptIds, ...prompt.followUpPromptIds]) {
      if (!prompts.has(linkedId)) errors.push(`${prompt.id}: linked prompt ${linkedId} does not exist.`);
    }
    const placeholders = [...prompt.template.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
    const parameterIds = new Set(prompt.parameters.map((parameter) => parameter.id));
    for (const placeholder of placeholders) {
      if (!parameterIds.has(placeholder)) errors.push(`${prompt.id}: template placeholder ${placeholder} has no parameter definition.`);
    }
  }

  const coverage = createDvqrPromptCatalogueCoverageReport();
  for (const toolName of coverage.uncoveredToolNames) errors.push(`Live MCP tool ${toolName} is neither represented by a curated prompt nor explicitly classified as intentionally uncovered.`);

  return { valid: errors.length === 0, errors };
}
