export type ComparisonSnapshotEvidenceType =
  | "OperationalProfile"
  | "PluginStep"
  | "WorkflowParticipation"
  | "IdentityParticipation"
  | "Unknown";

export interface ComparisonEnvironmentIdentity {
  readonly environmentId?: string;
  readonly environmentUrl?: string;
  readonly label: string;
}

export interface ComparisonSnapshotMetadata {
  readonly snapshotVersion: "comparison-snapshot-v1";
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
}

export interface ComparisonEvidenceSnapshot<TPayload = unknown> {
  readonly environment: ComparisonEnvironmentIdentity;
  readonly evidenceType: ComparisonSnapshotEvidenceType;
  readonly metadata: ComparisonSnapshotMetadata;
  readonly evidence: TPayload;
}

export interface OperationalComparisonSnapshotDocument {
  readonly kind: "dvqr-operational-comparison-snapshot";
  readonly schemaVersion?: "1.0";
  readonly snapshotVersion: "comparison-snapshot-v1";
  readonly environment: ComparisonEnvironmentIdentity;
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
  readonly evidenceSnapshots: readonly ComparisonEvidenceSnapshot[];
}

export interface ComparisonSnapshotValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly snapshots: readonly ComparisonEvidenceSnapshot[];
}
