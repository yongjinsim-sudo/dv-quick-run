export type ComparisonDifferenceKind =
  | "Added"
  | "Removed"
  | "Changed"
  | "Participation Drift"
  | "Configuration Drift"
  | "State Drift"
  | "DensityChanged"
  | "OnlyInSource"
  | "OnlyInTarget";

export type ComparisonOperationalSignificance = "Low" | "Medium" | "High";

export type ComparisonSnapshotTrustStatus =
  | "Verified"
  | "Modified"
  | "Legacy / Unverified"
  | "Invalid";

export interface ComparisonSnapshotTrustSummary {
  readonly sourceTrustState?: ComparisonSnapshotTrustStatus;
  readonly targetTrustState?: ComparisonSnapshotTrustStatus;
}

export interface ComparisonSessionSnapshotRef {
  readonly label: string;
  readonly environmentLabel: string;
  readonly subjectLabel?: string;
  readonly capturedAtIso?: string;
  readonly trustState?: ComparisonSnapshotTrustStatus;
  readonly fileUri?: string;
}

export interface ComparisonSessionMetadata {
  readonly generatedAtIso: string;
  readonly mode: "Cross-Environment Diff" | "Timeline Diff";
  readonly sourceSnapshot: ComparisonSessionSnapshotRef;
  readonly targetSnapshot: ComparisonSessionSnapshotRef;
  readonly unalignedSubjects?: boolean;
}

export interface ComparisonEnvironmentRef {
  readonly label: string;
  readonly environmentId?: string;
  readonly environmentUrl?: string;
  readonly capturedAtIso?: string;
}

export interface ComparisonEvidenceRef {
  readonly label: string;
  readonly value?: string;
  readonly source?: "source" | "target" | "both";
}

export interface ComparisonDifference {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly kind: ComparisonDifferenceKind;
  readonly significance: ComparisonOperationalSignificance;
  readonly sourceValue?: string;
  readonly targetValue?: string;
  readonly evidence: readonly ComparisonEvidenceRef[];
}

export interface ComparisonDriftGroup {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly differences: readonly ComparisonDifference[];
}

export interface ComparisonProviderContext {
  readonly source: ComparisonEnvironmentRef;
  readonly target: ComparisonEnvironmentRef;
  readonly entityLogicalName?: string;
  readonly subjectLabel?: string;
  readonly snapshots?: readonly unknown[];
}

export interface ComparisonProviderResult {
  readonly providerId: string;
  readonly title: string;
  readonly groups: readonly ComparisonDriftGroup[];
}

export interface ComparisonProvider {
  readonly id: string;
  readonly title: string;
  compare(context: ComparisonProviderContext): Promise<ComparisonProviderResult>;
}

export interface ComparisonSummary {
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly sourceCapturedAtIso?: string;
  readonly targetCapturedAtIso?: string;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly providerCount: number;
  readonly differenceCount: number;
  readonly subjectLabel?: string;
}

export interface ComparisonViewModel {
  readonly title: string;
  readonly summary: ComparisonSummary;
  readonly snapshotTrust?: ComparisonSnapshotTrustSummary;
  readonly session?: ComparisonSessionMetadata;
  readonly groups: readonly ComparisonDriftGroup[];
  readonly providerResults: readonly ComparisonProviderResult[];
}
