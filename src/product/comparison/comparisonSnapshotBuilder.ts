import type {
  ComparisonEnvironmentIdentity,
  ComparisonEvidenceSnapshot,
  ComparisonSnapshotEvidenceType
} from "./comparisonSnapshotTypes.js";

export function normalizeComparisonEnvironmentIdentity(identity: ComparisonEnvironmentIdentity): ComparisonEnvironmentIdentity {
  return {
    environmentId: normalizeOptional(identity.environmentId),
    environmentUrl: normalizeOptional(identity.environmentUrl),
    label: normalizeOptional(identity.label) ?? "Unknown environment"
  };
}

export function createComparisonEvidenceSnapshot<TPayload>(args: {
  environment: ComparisonEnvironmentIdentity;
  evidenceType: ComparisonSnapshotEvidenceType;
  evidence: TPayload;
  capturedAt?: Date;
  sourceFeature: string;
}): ComparisonEvidenceSnapshot<TPayload> {
  return {
    environment: normalizeComparisonEnvironmentIdentity(args.environment),
    evidenceType: args.evidenceType,
    metadata: {
      snapshotVersion: "comparison-snapshot-v1",
      capturedAtIso: (args.capturedAt ?? new Date()).toISOString(),
      sourceFeature: args.sourceFeature
    },
    evidence: args.evidence
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const text = (value ?? "").trim();
  return text || undefined;
}
