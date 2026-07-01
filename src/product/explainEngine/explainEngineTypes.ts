export type ExplainSubjectKind = "odata" | "fetchxml" | "result" | "diagnostic";

export type ExplainConfidenceLevel = "high" | "medium" | "low" | "unknown";

export type ExplainObservationCategory =
  | "projection"
  | "filtering"
  | "ordering"
  | "paging"
  | "relationship"
  | "execution"
  | "validation"
  | "unknown"
  | "general";

export interface ExplainContext {
  subjectKind: ExplainSubjectKind;
  sourceText: string;
  entityLogicalName?: string;
  entitySetName?: string;
  generatedAt?: string;
}

export interface ExplainEvidenceRef {
  label: string;
  detail: string;
  confidence?: ExplainConfidenceLevel;
}

export interface ExplainUnknown {
  label: string;
  reason: string;
  impact?: string;
}

export interface ExplainRecommendation {
  title: string;
  detail: string;
  confidence: ExplainConfidenceLevel;
  sourceContributor: string;
  previewQuery?: string;
  actionability?: "none" | "previewOnly" | "previewAndApply";
}

export interface ExplainObservation {
  id: string;
  title: string;
  category: ExplainObservationCategory;
  statement: string;
  why?: string;
  useWhen?: string;
  tradeOff?: string;
  watchFor?: string;
  confidence: ExplainConfidenceLevel;
  evidence?: string[];
  sourceContributor: string;
  displayPriority?: number;
}

export interface ExplainConfidenceFactor {
  label: string;
  detail: string;
  status: "supports" | "limits" | "neutral";
}

export interface ExplainSection {
  heading: string;
  lines: string[];
  confidence?: ExplainConfidenceLevel;
  sourceContributor: string;
}

export interface ExplainContribution {
  summaryLines?: string[];
  sections?: ExplainSection[];
  observations?: ExplainObservation[];
  evidence?: ExplainEvidenceRef[];
  unknowns?: ExplainUnknown[];
  recommendations?: ExplainRecommendation[];
}

export interface ExplainContributor {
  id: string;
  title: string;
  run(context: ExplainContext): Promise<ExplainContribution> | ExplainContribution;
}

export interface ExplainResult {
  schemaVersion: "2.1";
  title: string;
  context: ExplainContext;
  confidence: ExplainConfidenceLevel;
  confidenceFactors: ExplainConfidenceFactor[];
  summaryLines: string[];
  sections: ExplainSection[];
  observations: ExplainObservation[];
  evidence: ExplainEvidenceRef[];
  unknowns: ExplainUnknown[];
  recommendations: ExplainRecommendation[];
  contributors: Array<{ id: string; title: string }>;
}
