import type { CustomApiDefinition, CustomApiExecutionPolicyDecision } from "../models/customApiTypes.js";
import { isAiRelatedCustomApiOperation } from "./aiOperationClassifier.js";

export type AiExecutionPolicyMode = "deny" | "allow";

export interface AiExecutionPolicyOptions {
  readonly aiPolicy?: AiExecutionPolicyMode;
}

export function normalizeAiExecutionPolicy(value: unknown): AiExecutionPolicyMode {
  return value === "allow" ? "allow" : "deny";
}

export function evaluateAiExecutionPolicy(
  definition: CustomApiDefinition,
  options: AiExecutionPolicyOptions = {}
): CustomApiExecutionPolicyDecision {
  const isAiRelated = isAiRelatedCustomApiOperation(definition);
  const policy = normalizeAiExecutionPolicy(options.aiPolicy);

  if (!isAiRelated) {
    return {
      policyKind: "aiExecution",
      classification: "non-ai",
      allowed: true,
      severity: "info",
      reason: "This operation is not classified as AI-related by DV Quick Run's deterministic policy classifier."
    };
  }

  if (policy === "allow") {
    return {
      policyKind: "aiExecution",
      classification: "ai-related",
      allowed: true,
      severity: "warning",
      reason: "This operation is classified as AI-related, and AI execution is explicitly allowed by policy.",
      trustModel: "probabilistic-generated-content",
      humanReviewRecommended: true,
      generatedContentWarning: true,
      externalProcessingPossible: true
    };
  }

  return {
    policyKind: "aiExecution",
    classification: "ai-related",
    allowed: false,
    severity: "blocked",
    reason: "This operation is classified as AI-related. DV Quick Run blocks AI execution by default; set dvQuickRun.execution.aiPolicy to allow to enable explicit AI execution."
  };
}


export function shouldShowAiExecutionAdvisory(decision: CustomApiExecutionPolicyDecision | undefined): boolean {
  return decision?.classification === "ai-related" && decision.allowed === true;
}

export function buildAiExecutionAdvisoryLines(decision: CustomApiExecutionPolicyDecision | undefined): string[] {
  if (!shouldShowAiExecutionAdvisory(decision)) {
    return [];
  }

  return [
    "Execution classification: AI-related",
    "Trust model: Probabilistic / generated content",
    "Execution policy: Allowed by configuration",
    "Human review: Recommended",
    "Generated responses may be inaccurate, incomplete, non-deterministic, or unsuitable for direct operational decisions without review.",
    "This operation may invoke external AI processing depending on the Dataverse environment configuration."
  ];
}
