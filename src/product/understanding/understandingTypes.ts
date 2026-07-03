export type UnderstandingSchemaVersion = "1.0";

export type UnderstandingAudience = "investigator" | "developer" | "admin" | "handoff";

export type UnderstandingSignalKind = "positive" | "smell" | "risk" | "unknown" | "recommendation";

export type UnderstandingConfidence = "high" | "medium" | "low" | "unknown";

export type UnderstandingComplexityLevel = "Low" | "Medium" | "High";

export interface UnderstandingDocument {
  schemaVersion: UnderstandingSchemaVersion;
  engineVersion: "v2.2";
  title: string;
  generatedAt: string;
  subject: {
    kind: string;
    entityLogicalName?: string;
    entitySetName?: string;
  };
  confidence: UnderstandingConfidence;
  audience: UnderstandingAudience[];
  invariant: string;
  narrative: UnderstandingNarrative;
  technical: UnderstandingTechnicalBreakdown;
  mechanics: UnderstandingMechanics;
  traversal: UnderstandingTraversalNode[];
  returnedShape: UnderstandingReturnedShapeNode[];
  complexity: UnderstandingComplexity;
  signals: UnderstandingSignal[];
  recommendations: UnderstandingRecommendation[];
  evidence: UnderstandingEvidence[];
  rawReference: UnderstandingRawReference;
  sourceContributors: Array<{ id: string; title: string }>;
}

export interface UnderstandingNarrative {
  overview: string;
  intent: string[];
  investigationStage?: string;
  investigationPattern?: string;
}

export interface UnderstandingTechnicalBreakdown {
  summary: string[];
  sections: UnderstandingTechnicalSection[];
}

export interface UnderstandingTechnicalSection {
  heading: string;
  lines: string[];
  confidence?: UnderstandingConfidence;
  sourceContributor?: string;
}

export interface UnderstandingMechanics {
  rootTarget?: string;
  operation: string;
  projection: string[];
  filters: string[];
  ordering: string[];
  expands: UnderstandingExpandMechanic[];
  rowLimit?: number;
  unknownOptions: string[];
}

export interface UnderstandingExpandMechanic {
  navigationProperty: string;
  nestedProjection: string[];
  raw: string;
  explanation?: string;
}

export interface UnderstandingTraversalNode {
  label: string;
  technicalName?: string;
  depth: number;
  relationship?: string;
  joinType?: string;
}

export interface UnderstandingReturnedShapeNode {
  label: string;
  technicalName?: string;
  depth: number;
  fields: string[];
}

export interface UnderstandingComplexity {
  level: UnderstandingComplexityLevel;
  score: number;
  reasons: string[];
}

export interface UnderstandingSignal {
  kind: UnderstandingSignalKind;
  title: string;
  detail: string;
  confidence?: UnderstandingConfidence;
  sourceContributor?: string;
}

export interface UnderstandingRecommendation {
  title: string;
  detail: string;
  rationale?: string;
  confidence: UnderstandingConfidence;
  actionability?: "none" | "previewOnly" | "previewAndApply";
  previewQuery?: string;
  sourceContributor?: string;
}

export interface UnderstandingEvidence {
  label: string;
  detail: string;
  confidence?: UnderstandingConfidence;
}

export interface UnderstandingRawReference {
  language: "odata" | "fetchxml" | "text";
  text: string;
}
