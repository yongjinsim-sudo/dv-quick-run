export type InvestigationCandidateSourceType =
  | "recordPath"
  | "rootField"
  | "collectionField"
  | "lookup"
  | "unknown";

export type InvestigationCandidateType =
  | "primary"
  | "related"
  | "unknown";

export interface InvestigationCandidate {
  recordId: string;
  fieldName?: string;
  sourceType: InvestigationCandidateSourceType;
  sourceIndex?: number;
  entitySetHint?: string;
}

export interface ScoredInvestigationCandidate extends InvestigationCandidate {
  confidence: number;
  candidateType: InvestigationCandidateType;
  reason: string;
  precedenceTier: number;
  autoSelectEligible: boolean;
}
