import { randomUUID } from "crypto";
import type {
  ComparisonEnvironmentIdentity,
  ComparisonEvidenceSnapshot,
  ComparisonSnapshotEvidenceType,
  ComparisonSnapshotIdentity,
  ComparisonSnapshotLineage,
  ComparisonSnapshotValidationResult,
  OperationalComparisonSnapshotDocument
} from "./comparisonSnapshotTypes.js";
import {
  calculateOperationalComparisonSnapshotHash,
  COMPARISON_SNAPSHOT_CANONICALIZATION,
  COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM,
  verifyOperationalComparisonSnapshotIntegrity
} from "./comparisonSnapshotIntegrity.js";

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
  lineage?: Partial<ComparisonSnapshotLineage>;
  snapshotId?: string;
  snapshotLineageId?: string;
  label?: string;
  entityLogicalName?: string;
  entityDisplayName?: string;
}): OperationalComparisonSnapshotDocument {
  const capturedAtIso = (args.capturedAt ?? new Date()).toISOString();
  const environment = normalizeComparisonEnvironmentIdentity(args.environment);
  const snapshotId = normalizeOptional(args.snapshotId) ?? randomUUID();
  const snapshotLineageId = normalizeOptional(args.snapshotLineageId) ?? normalizeOptional(args.lineage?.snapshotLineageId) ?? snapshotId;
  const lineage = normalizeSnapshotLineage({
    capturedAtIso,
    sourceFeature: args.sourceFeature,
    snapshotLineageId,
    lineage: args.lineage
  });
  const snapshotIdentity = normalizeSnapshotIdentity({
    capturedAtIso,
    environment,
    sourceFeature: args.sourceFeature,
    snapshotId,
    snapshotLineageId,
    label: args.label,
    entityLogicalName: args.entityLogicalName,
    entityDisplayName: args.entityDisplayName
  });

  const document: OperationalComparisonSnapshotDocument = {
    kind: "dvqr-operational-comparison-snapshot",
    schemaVersion: "1.0",
    snapshotVersion: "comparison-snapshot-v1",
    environment,
    capturedAtIso,
    sourceFeature: args.sourceFeature,
    snapshotIdentity,
    evidenceSnapshots: args.evidenceSnapshots.map((snapshot) => ({
      ...snapshot,
      environment: normalizeComparisonEnvironmentIdentity(snapshot.environment.label ? snapshot.environment : environment),
      metadata: {
        ...snapshot.metadata,
        snapshotVersion: "comparison-snapshot-v1",
        capturedAtIso: snapshot.metadata.capturedAtIso || capturedAtIso
      }
    })),
    lineage
  };

  return {
    ...document,
    integrity: {
      algorithm: COMPARISON_SNAPSHOT_INTEGRITY_ALGORITHM,
      canonicalization: COMPARISON_SNAPSHOT_CANONICALIZATION,
      contentHash: calculateOperationalComparisonSnapshotHash(document)
    }
  };
}


function normalizeSnapshotIdentity(args: {
  readonly capturedAtIso: string;
  readonly environment: ComparisonEnvironmentIdentity;
  readonly sourceFeature: string;
  readonly snapshotId: string;
  readonly snapshotLineageId: string;
  readonly label?: string;
  readonly entityLogicalName?: string;
  readonly entityDisplayName?: string;
}): ComparisonSnapshotIdentity {
  return {
    identityVersion: "comparison-snapshot-identity-v1",
    snapshotId: args.snapshotId,
    snapshotLineageId: args.snapshotLineageId,
    label: normalizeOptional(args.label),
    entityLogicalName: normalizeOptional(args.entityLogicalName),
    entityDisplayName: normalizeOptional(args.entityDisplayName),
    environmentLabel: args.environment.label,
    environmentUrl: normalizeOptional(args.environment.environmentUrl),
    capturedAtIso: args.capturedAtIso,
    sourceFeature: args.sourceFeature
  };
}

function normalizeSnapshotLineage(args: {
  readonly capturedAtIso: string;
  readonly sourceFeature: string;
  readonly snapshotLineageId: string;
  readonly lineage?: Partial<ComparisonSnapshotLineage>;
}): ComparisonSnapshotLineage {
  const parentSnapshotIds = args.lineage?.parentSnapshotIds
    ?.map((id) => id.trim())
    .filter((id) => id.length > 0);

  return {
    lineageVersion: "comparison-lineage-v1",
    snapshotLineageId: normalizeOptional(args.lineage?.snapshotLineageId) ?? args.snapshotLineageId,
    origin: args.lineage?.origin ?? "captured",
    createdAtIso: args.lineage?.createdAtIso ?? args.capturedAtIso,
    sourceFeature: args.lineage?.sourceFeature ?? args.sourceFeature,
    parentSnapshotIds: parentSnapshotIds && parentSnapshotIds.length > 0 ? parentSnapshotIds : undefined,
    note: normalizeOptional(args.lineage?.note)
  };
}

export function validateComparisonSnapshotDocument(input: unknown): ComparisonSnapshotValidationResult {
  const snapshots = flattenComparisonSnapshotDocuments([input]);
  if (!snapshots.length) {
    return {
      valid: false,
      reason: "No DVQR comparison evidence snapshots were found in the selected file.",
      trustState: "Invalid",
      snapshots: []
    };
  }

  const invalid = snapshots.find((snapshot) => snapshot.metadata?.snapshotVersion !== "comparison-snapshot-v1");
  if (invalid) {
    return {
      valid: false,
      reason: "Snapshot version is not supported by this DVQR build.",
      trustState: "Invalid",
      snapshots: []
    };
  }

  return { valid: true, trustState: determineSnapshotTrustState(input), snapshots };
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

function determineSnapshotTrustState(input: unknown): "Verified" | "Modified" | "Legacy / Unverified" | "Invalid" {
  const documents = flattenOperationalComparisonSnapshotDocuments([input]);
  if (!documents.length) {
    return "Legacy / Unverified";
  }

  let sawLegacy = false;
  for (const document of documents) {
    if (!document.integrity?.contentHash) {
      sawLegacy = true;
      continue;
    }

    if (!verifyOperationalComparisonSnapshotIntegrity(document)) {
      return "Modified";
    }
  }

  return sawLegacy ? "Legacy / Unverified" : "Verified";
}

function flattenOperationalComparisonSnapshotDocuments(inputs: readonly unknown[]): readonly OperationalComparisonSnapshotDocument[] {
  const documents: OperationalComparisonSnapshotDocument[] = [];

  for (const input of inputs) {
    if (Array.isArray(input)) {
      documents.push(...flattenOperationalComparisonSnapshotDocuments(input));
      continue;
    }

    if (isOperationalComparisonSnapshotDocument(input)) {
      documents.push(input);
    }
  }

  return documents;
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
