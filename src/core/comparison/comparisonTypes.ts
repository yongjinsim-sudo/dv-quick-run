export type ComparisonDifferenceKind =
  | "Added"
  | "Removed"
  | "Changed"
  | "Participation Drift"
  | "Inheritance Drift"
  | "Assignment Drift"
  | "Runtime Participation Drift"
  | "Configuration Drift"
  | "State Drift"
  | "Density Drift"
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
  readonly lineageOrigin?: string;
  readonly lineageCreatedAtIso?: string;
  readonly lineageNote?: string;
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

export interface ComparisonNearbyRepresentativeSignal {
  readonly title: string;
  readonly kind: ComparisonDifferenceKind;
  readonly significance: ComparisonOperationalSignificance;
}

export interface ComparisonNearbyOperationalDrift {
  readonly id: string;
  readonly orientationCue: string;
  readonly orientationSummary: string;
  readonly relatedGroupId: string;
  readonly relatedGroupTitle: string;
  readonly title: string;
  readonly summary: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly differenceCount: number;
  readonly evidence: readonly ComparisonEvidenceRef[];
  readonly representativeSignals?: readonly ComparisonNearbyRepresentativeSignal[];
  readonly continuations?: readonly ComparisonInvestigationContinuation[];
}

export type ComparisonInvestigationContinuationKind =
  | "IdentityParticipation"
  | "RuntimeBehaviour"
  | "WorkflowAutomation"
  | "SolutionParticipation"
  | "OperationalProfile"
  | "RawEvidence";

export type ComparisonInvestigationContinuationState = "Available" | "Deferred" | "InspectOnly";

export interface ComparisonInvestigationContinuation {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly kind: ComparisonInvestigationContinuationKind;
  readonly state: ComparisonInvestigationContinuationState;
  readonly evidence: readonly ComparisonEvidenceRef[];
  readonly children?: readonly ComparisonInvestigationContinuation[];
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
  readonly continuations?: readonly ComparisonInvestigationContinuation[];
  /**
   * Optional provider-owned reconstruction intent metadata. This remains local
   * investigation context only; renderers/controllers may offer explicit export
   * actions, but the comparison engine must not treat it as remediation advice.
   */
  readonly reconstructionCandidateKind?: string;
  readonly reconstructionCandidate?: unknown;
  /**
   * Optional explanation shown when a provider-owned reconstruction handoff is
   * intentionally unavailable for this finding. For v0.13.2 this keeps
   * source-side DVAF export direction visible instead of silently hiding the
   * affordance on target-only attribute drift.
   */
  readonly reconstructionCandidateUnavailableReason?: string;
}

export interface ComparisonDriftGroup {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly differences: readonly ComparisonDifference[];
  readonly nearbyOperationalDrift?: readonly ComparisonNearbyOperationalDrift[];
  readonly continuations?: readonly ComparisonInvestigationContinuation[];
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

export type ComparisonSubjectType =
  | "entity"
  | "user"
  | "team"
  | "role"
  | "applicationUser"
  | "businessUnit"
  | "solution"
  | "workflow"
  | "pluginStep";

export interface ComparisonProviderCapabilities {
  readonly supportedSubjectTypes?: readonly ComparisonSubjectType[];
  readonly supportedDifferenceKinds?: readonly ComparisonDifferenceKind[];
  readonly supportsReplay?: boolean;
  readonly supportsExport?: boolean;
  readonly supportsNearbyCorrelation?: boolean;
  readonly significanceOwnership?: "provider";
}

export interface ComparisonProvider {
  readonly id: string;
  readonly title: string;
  readonly capabilities?: ComparisonProviderCapabilities;
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
  readonly entityLogicalName?: string;
}

export interface ComparisonViewModel {
  readonly title: string;
  readonly summary: ComparisonSummary;
  readonly snapshotTrust?: ComparisonSnapshotTrustSummary;
  readonly session?: ComparisonSessionMetadata;
  readonly groups: readonly ComparisonDriftGroup[];
  readonly providerResults: readonly ComparisonProviderResult[];
}
