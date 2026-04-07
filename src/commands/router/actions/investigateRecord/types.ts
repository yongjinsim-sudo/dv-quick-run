export type InvestigationInputType = "guid" | "json" | "recordPath";

export interface InvestigationInput {
  type: InvestigationInputType;
  rawText: string;
  recordId?: string;
  entityLogicalName?: string;
  entitySetName?: string;
  sourceJson?: Record<string, unknown>;
  sourcePath?: string;

  selectedCandidateFieldName?: string;
  selectedCandidateEntitySetNameHint?: string;
  selectedCandidateType?: "primary" | "related" | "unknown";
  selectedCandidateConfidence?: number;
  selectedCandidateReason?: string;
}

export interface ResolvedInvestigationContext {
  environmentName: string;
  recordId: string;
  entityLogicalName: string;
  entitySetName: string;
  primaryIdField?: string;
  primaryNameField?: string;
  primaryNameValue?: string;
  inferenceSource: "jsonContext" | "recordPath" | "explicit" | "quickPick";
  inputType: InvestigationInputType;
  wasFallbackUsed: boolean;
}


export interface RecordContext {
  entityLogicalName: string;
  entitySetName: string;
  primaryIdField?: string;
  primaryNameField?: string;
  inferenceSource: "jsonContext" | "recordPath" | "explicit" | "quickPick";
}

export interface BuiltRecordQueries {
  minimalQuery: string;
  rawQuery: string;
}

export type InvestigationSummaryCategory = "identity" | "lifecycle" | "ownership" | "business";

export interface InvestigationSummaryField {
  label: string;
  logicalName: string;
  value: string;
  category: InvestigationSummaryCategory;
}

export interface InvestigationLookupTargetOption {
  logicalName: string;
  entitySetName?: string;
  displayName?: string;
}

export interface InvestigationLookupSuggestion {
    logicalName: string;
    targetEntityLogicalNameRaw?: string;
    targetEntityLogicalName?: string;
    targetEntitySetName?: string;
    recordId: string;
    displayName?: string;
    targetOptions?: InvestigationLookupTargetOption[];
}

export interface InvestigationDocumentModel {
  environmentName: string;
  entityLogicalName: string;
  entitySetName: string;
  recordId: string;
  primaryName?: string;
  uiLink?: string;
  minimalQuery: string;
  rawQuery: string;
  summaryFields: InvestigationSummaryField[];
  relatedRecords: InvestigationLookupSuggestion[];
  reverseLinks: InvestigationReverseSuggestion[];
  signals: InvestigationDocumentSignal[];
  suggestedQueries: string[];
  inferenceNotes: string[];

  selectedCandidateFieldName?: string;
  selectedCandidateType?: "primary" | "related" | "unknown";
  selectedCandidateConfidence?: number;
  selectedCandidateReason?: string;
}

export interface InvestigationDocumentSignal {
  severity: "warn" | "info";
  message: string;
  note?: string;
}

export interface InvestigationReverseSuggestion {
  label: string;
  sourceEntityLogicalName?: string;
  sourceEntitySetName?: string;
  referencingAttribute?: string;
  query: string;
}