export type AuditEvidenceStatus = "Found" | "NoMatchingAudit" | "Unavailable" | "Error";

export interface AuditEvidenceInterval {
  readonly fromCapturedAtIso?: string;
  readonly toCapturedAtIso?: string;
}

export interface AuditEvidenceQueryRequest {
  readonly findingId: string;
  readonly findingTitle: string;
  readonly findingSummary?: string;
  readonly providerId?: string;
  readonly providerTitle?: string;
  readonly entityLogicalName?: string;
  readonly evidenceLabel?: string;
  readonly evidenceValue?: string;
  readonly parentEvidence?: string;
  readonly interval: AuditEvidenceInterval;
  readonly limit?: number;
}

export type AuditEvidenceRecordKind = "AttributeChange" | "AssociationChange" | "Raw";

export interface AuditEvidenceRecord {
  readonly auditId?: string;
  readonly recordedAtIso?: string;
  readonly changedBy?: string;
  readonly userId?: string;
  readonly operation?: string;
  readonly action?: string;
  readonly objectId?: string;
  readonly objectTypeCode?: string;
  readonly changedAttributeLogicalName?: string;
  readonly attributeMask?: string;
  readonly changedData?: string;
  readonly oldValue?: string;
  readonly newValue?: string;
  readonly relationshipName?: string;
  readonly relatedEntityLogicalName?: string;
  readonly relatedRecordId?: string;
  readonly kind?: AuditEvidenceRecordKind;
  readonly summary: string;
}

export interface AuditEvidenceResult {
  readonly status: AuditEvidenceStatus;
  readonly title: string;
  readonly summary: string;
  readonly interval: AuditEvidenceInterval;
  readonly records: readonly AuditEvidenceRecord[];
  readonly queryPath?: string;
  readonly warning?: string;
}
