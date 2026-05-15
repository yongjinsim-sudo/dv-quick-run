import type { CustomApiDefinition } from "../models/customApiTypes.js";

const AI_OPERATION_PATTERNS = [
  /\bai\b/i,
  /\bAI[A-Z0-9_]/,
  /copilot/i,
  /gpt/i,
  /prompt/i,
  /semantic/i,
  /generative/i,
  /openai/i,
  /large language model/i,
  /llm/i
];

const KNOWN_AI_OPERATION_NAMES = new Set([
  "aiclassify",
  "aiextract",
  "aireply",
  "aisentiment",
  "aisummarize",
  "aitranslate"
]);

function normalize(value: string | undefined): string {
  return value?.trim() ?? "";
}

function hasAiPattern(value: string | undefined): boolean {
  const text = normalize(value);
  return text.length > 0 && AI_OPERATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isAiRelatedCustomApiOperation(definition: CustomApiDefinition): boolean {
  const uniqueName = normalize(definition.uniqueName);
  if (KNOWN_AI_OPERATION_NAMES.has(uniqueName.toLowerCase())) {
    return true;
  }

  return hasAiPattern(definition.uniqueName)
    || hasAiPattern(definition.displayName)
    || hasAiPattern(definition.description)
    || definition.requestParameters.some((parameter) => hasAiPattern(parameter.uniqueName) || hasAiPattern(parameter.displayName) || hasAiPattern(parameter.logicalName))
    || definition.responseProperties.some((property) => hasAiPattern(property.uniqueName) || hasAiPattern(property.displayName) || hasAiPattern(property.logicalName));
}
