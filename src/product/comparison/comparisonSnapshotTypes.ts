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
