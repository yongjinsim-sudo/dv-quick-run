import type {
  MetadataQueryDiagnostic,
  MetadataQueryDiagnosticCode,
  MetadataSuggestedQuery
} from "../queryDoctor/metadataQueryDiagnostics.js";
import { buildStableRecommendationId, dedupeAndRankRecommendations } from "./recommendationEngine.js";

export type MetadataRecommendationCategory = "Lookup" | "Relationship" | "Navigation" | "QueryShape";
export type MetadataRecommendationPriority = "High" | "Medium" | "Low";

export interface MetadataQueryRecommendation {
  readonly id: string;
  readonly sourceDiagnosticId: string;
  readonly ruleId: string;
  readonly code: MetadataQueryDiagnosticCode;
  readonly category: MetadataRecommendationCategory;
  readonly priority: MetadataRecommendationPriority;
  readonly action: string;
  readonly reason: string;
  readonly suggestedQueries: readonly MetadataSuggestedQuery[];
  readonly supportedTargets?: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
}

function categoryFor(code: MetadataQueryDiagnosticCode): MetadataRecommendationCategory {
  if (code === "MalformedQueryOption" || code === "DuplicateQueryOption") {
    return "QueryShape";
  }
  if (code === "UnknownNavigationProperty" || code === "NavigationPropertyWrongEntity") {
    return "Navigation";
  }
  if (code === "AmbiguousRelationshipDirection") {
    return "Relationship";
  }
  return "Lookup";
}

function priorityFor(diagnostic: MetadataQueryDiagnostic): MetadataRecommendationPriority {
  return diagnostic.severity === "error" ? "High" : diagnostic.severity === "warning" ? "Medium" : "Low";
}

function priorityRank(priority: MetadataRecommendationPriority): number {
  return priority === "High" ? 300 : priority === "Medium" ? 200 : 100;
}

export function buildMetadataQueryRecommendations(
  diagnostics: readonly MetadataQueryDiagnostic[]
): MetadataQueryRecommendation[] {
  return dedupeAndRankRecommendations(diagnostics.map((diagnostic) => {
    const priority = priorityFor(diagnostic);
    return {
      id: buildStableRecommendationId("metadata-recommendation", diagnostic.ruleId, diagnostic.id),
      sourceDiagnosticId: diagnostic.id,
      ruleId: diagnostic.ruleId,
      code: diagnostic.code,
      category: categoryFor(diagnostic.code),
      priority,
      action: diagnostic.title,
      reason: diagnostic.message,
      suggestedQueries: diagnostic.suggestedQueries,
      supportedTargets: diagnostic.supportedTargets,
      evidenceRefs: diagnostic.evidenceRefs,
      limitations: diagnostic.limitations,
      rank: priorityRank(priority)
    };
  })).map(({ rank: _rank, ...item }) => item);
}
