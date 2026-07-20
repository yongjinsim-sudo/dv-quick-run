import { buildMetadataQueryDiagnostics } from "../../../../../../core/queryDoctor/metadataQueryDiagnostics.js";
import { buildMetadataQueryRecommendations } from "../../../../../../core/recommendations/metadataRecommendationEngine.js";
import type { DiagnosticRule } from "../diagnosticRule.js";

export const metadataLookupRules: DiagnosticRule[] = [
  (context) => {
    if (!context.querySemanticModel || !context.queryMetadataContext) {
      return [];
    }

    const diagnostics = buildMetadataQueryDiagnostics(context.querySemanticModel, context.queryMetadataContext);
    const severityById = new Map(diagnostics.map((finding) => [finding.id, finding.severity]));
    return buildMetadataQueryRecommendations(diagnostics).map((recommendation) => ({
      id: recommendation.id,
      code: recommendation.code,
      ruleId: recommendation.ruleId,
      message: recommendation.reason,
      severity: severityById.get(recommendation.sourceDiagnosticId) ?? "info",
      suggestion: recommendation.action,
      suggestedFix: recommendation.suggestedQueries.length
        ? { label: recommendation.action, detail: recommendation.reason, confidence: 0.98 }
        : undefined,
      suggestedQuery: recommendation.suggestedQueries[0],
      suggestedQueries: [...recommendation.suggestedQueries],
      supportedTargets: recommendation.supportedTargets ? [...recommendation.supportedTargets] : undefined,
      evidenceRefs: [...recommendation.evidenceRefs],
      limitations: [...recommendation.limitations],
      confidence: recommendation.priority === "Low" ? 0.9 : 0.98
    }));
  }
];
