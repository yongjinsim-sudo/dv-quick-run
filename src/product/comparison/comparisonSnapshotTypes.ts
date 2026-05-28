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

export type ComparisonSnapshotTrustState =
  | "Verified"
  | "Modified"
  | "Legacy / Unverified"
  | "Invalid";

export interface ComparisonSnapshotIntegrity {
  readonly algorithm: "sha256";
  readonly canonicalization: "dvqr-snapshot-core-v1";
  readonly contentHash: string;
}

export type ComparisonSnapshotLineageOrigin = "captured" | "imported" | "derivedComparison" | "legacy";

export interface ComparisonSnapshotLineage {
  readonly lineageVersion: "comparison-lineage-v1";
  readonly origin: ComparisonSnapshotLineageOrigin;
  readonly createdAtIso: string;
  readonly sourceFeature?: string;
  readonly parentSnapshotIds?: readonly string[];
  readonly note?: string;
}

export interface OperationalComparisonSnapshotDocument {
  readonly kind: "dvqr-operational-comparison-snapshot";
  readonly schemaVersion?: "1.0";
  readonly snapshotVersion: "comparison-snapshot-v1";
  readonly environment: ComparisonEnvironmentIdentity;
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
  readonly evidenceSnapshots: readonly ComparisonEvidenceSnapshot[];
  readonly lineage?: ComparisonSnapshotLineage;
  readonly integrity?: ComparisonSnapshotIntegrity;
}

export interface ComparisonSnapshotValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly trustState: ComparisonSnapshotTrustState;
  readonly snapshots: readonly ComparisonEvidenceSnapshot[];
}
