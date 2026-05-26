export type ComparisonDifferenceKind =
  | "Added"
  | "Removed"
  | "Changed"
  | "DensityChanged"
  | "OnlyInSource"
  | "OnlyInTarget";

export type ComparisonOperationalSignificance = "Low" | "Medium" | "High";

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
}

export interface ComparisonViewModel {
  readonly title: string;
  readonly summary: ComparisonSummary;
  readonly groups: readonly ComparisonDriftGroup[];
  readonly providerResults: readonly ComparisonProviderResult[];
}
