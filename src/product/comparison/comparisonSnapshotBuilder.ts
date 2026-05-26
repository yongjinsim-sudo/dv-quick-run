import type {
  ComparisonEnvironmentIdentity,
  ComparisonEvidenceSnapshot,
  ComparisonSnapshotEvidenceType,
  ComparisonSnapshotValidationResult,
  OperationalComparisonSnapshotDocument
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

export function createOperationalComparisonSnapshotDocument(args: {
  environment: ComparisonEnvironmentIdentity;
  sourceFeature: string;
  evidenceSnapshots: readonly ComparisonEvidenceSnapshot[];
  capturedAt?: Date;
}): OperationalComparisonSnapshotDocument {
  const capturedAtIso = (args.capturedAt ?? new Date()).toISOString();
  const environment = normalizeComparisonEnvironmentIdentity(args.environment);

  return {
    kind: "dvqr-operational-comparison-snapshot",
    schemaVersion: "1.0",
    snapshotVersion: "comparison-snapshot-v1",
    environment,
    capturedAtIso,
    sourceFeature: args.sourceFeature,
    evidenceSnapshots: args.evidenceSnapshots.map((snapshot) => ({
      ...snapshot,
      environment: normalizeComparisonEnvironmentIdentity(snapshot.environment.label ? snapshot.environment : environment),
      metadata: {
        ...snapshot.metadata,
        snapshotVersion: "comparison-snapshot-v1",
        capturedAtIso: snapshot.metadata.capturedAtIso || capturedAtIso
      }
    }))
  };
}

export function validateComparisonSnapshotDocument(input: unknown): ComparisonSnapshotValidationResult {
  const snapshots = flattenComparisonSnapshotDocuments([input]);
  if (!snapshots.length) {
    return {
      valid: false,
      reason: "No DVQR comparison evidence snapshots were found in the selected file.",
      snapshots: []
    };
  }

  const invalid = snapshots.find((snapshot) => snapshot.metadata?.snapshotVersion !== "comparison-snapshot-v1");
  if (invalid) {
    return {
      valid: false,
      reason: "Snapshot version is not supported by this DVQR build.",
      snapshots: []
    };
  }

  return { valid: true, snapshots };
}

export function flattenComparisonSnapshotDocuments(inputs: readonly unknown[]): readonly ComparisonEvidenceSnapshot[] {
  const snapshots: ComparisonEvidenceSnapshot[] = [];

  for (const input of inputs) {
    if (Array.isArray(input)) {
      snapshots.push(...flattenComparisonSnapshotDocuments(input));
      continue;
    }

    if (isOperationalComparisonSnapshotDocument(input)) {
      snapshots.push(...input.evidenceSnapshots);
      continue;
    }

    if (isComparisonEvidenceSnapshot(input)) {
      snapshots.push(input);
    }
  }

  return snapshots;
}

function isOperationalComparisonSnapshotDocument(input: unknown): input is OperationalComparisonSnapshotDocument {
  const candidate = input as Partial<OperationalComparisonSnapshotDocument>;
  return candidate?.kind === "dvqr-operational-comparison-snapshot"
    && candidate.snapshotVersion === "comparison-snapshot-v1"
    && Array.isArray(candidate.evidenceSnapshots);
}

function isComparisonEvidenceSnapshot(input: unknown): input is ComparisonEvidenceSnapshot {
  const candidate = input as Partial<ComparisonEvidenceSnapshot>;
  return Boolean(
    candidate
      && typeof candidate === "object"
      && candidate.metadata?.snapshotVersion === "comparison-snapshot-v1"
      && candidate.environment?.label
      && candidate.evidenceType
  );
}

function normalizeOptional(value: string | undefined): string | undefined {
  const text = (value ?? "").trim();
  return text || undefined;
}
