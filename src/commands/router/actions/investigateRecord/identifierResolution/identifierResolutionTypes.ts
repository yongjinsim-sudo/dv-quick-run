import type { RecordContext } from "../types.js";

export type IdentifierResolutionOutcome =
  | "resolved"
  | "multipleMatches"
  | "unresolved"
  | "missingAllowedTables";

export interface IdentifierResolutionRequest {
  value: string;
  currentEntityLogicalName?: string;
  currentEntitySetName?: string;
  currentFieldLogicalName?: string;
  currentFieldAttributeType?: string;
  primaryIdField?: string;
}

export interface IdentifierResolutionCandidateField {
  entityLogicalName: string;
  entitySetName: string;
  fieldLogicalName: string;
  attributeType?: string;
  isPrimaryId: boolean;
  score: number;
  reason: string;
}

export interface IdentifierResolutionMatch {
  entityLogicalName: string;
  entitySetName: string;
  matchedField: string;
  primaryIdField?: string;
  recordId: string;
  primaryNameField?: string;
  primaryNameValue?: string;
  confidence: "high" | "medium";
  reason: string;
}

export interface IdentifierResolutionResult {
  outcome: IdentifierResolutionOutcome;
  resolved?: IdentifierResolutionMatch;
  matches?: IdentifierResolutionMatch[];
  searchedEntityLogicalNames?: string[];
  queriedFieldCount?: number;
  message?: string;
}

export interface IdentifierResolutionContext {
  activeRecordContext?: RecordContext;
}
