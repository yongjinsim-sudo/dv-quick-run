import type { FieldDef } from "../../../../../../services/entityFieldMetadataService.js";
import type { DiagnosticNarrowingSuggestion } from "../diagnosticTypes.js";
import type { ExecutionFieldObservation } from "../executionEvidence.js";
import type { RankedInsightCandidate } from "../../intelligence/insights/insightTypes.js";

export type ResultInsightSuggestionTier = DiagnosticNarrowingSuggestion["tier"];

export interface ResultInsightContext {
  totalRows: number;
  filterFieldNames: string[];
}

export interface ResultInsightCandidateItem {
  observation: ExecutionFieldObservation;
  field?: FieldDef;
  tier: ResultInsightSuggestionTier;
}

export type RankedResultInsightCandidate = RankedInsightCandidate<ResultInsightCandidateItem>;
