import type {
  BusinessPathArtifact,
  BusinessPathRevalidationResult
} from "../core/businessPaths/index.js";
import type { McpBusinessPathCandidate } from "./mcpBusinessPathDiscovery.js";

const normalize = (value: string | undefined): string => (value ?? "").trim().toLowerCase();

export interface PreferredBusinessPathRuntimeRequest {
  readonly sourceRecordId: string;
  readonly artifact: BusinessPathArtifact;
  readonly revalidation: BusinessPathRevalidationResult;
  readonly runtimeArguments?: Readonly<Record<string, unknown>>;
  readonly maxCandidates?: number;
  readonly maxRecordsPerStep?: number;
  readonly maxProbeRequests?: number;
  readonly maxDepth?: number;
}

export function businessPathTables(artifact: BusinessPathArtifact): readonly string[] {
  const ordered = [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal);
  return ordered.length
    ? [ordered[0].fromTable, ...ordered.map((hop) => hop.toTable)]
    : [artifact.sourceTable, artifact.targetTable];
}

export function businessPathRelationshipSchemas(artifact: BusinessPathArtifact): readonly string[] {
  return [...artifact.hops]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((hop) => hop.relationshipSchemaName);
}

export function candidateMatchesPreferredBusinessPath(
  candidate: McpBusinessPathCandidate,
  tables: readonly string[],
  relationshipSchemas: readonly string[]
): boolean {
  if (
    candidate.tables.length !== tables.length
    || !candidate.tables.every((table, index) => normalize(table) === normalize(tables[index]))
  ) {
    return false;
  }

  if (!relationshipSchemas.length) {
    return true;
  }

  return candidate.hops.length === relationshipSchemas.length
    && candidate.hops.every(
      (hop, index) =>
        normalize(hop.relationshipSchemaName) === normalize(relationshipSchemas[index])
    );
}

/**
 * Builds arguments for the existing runtime validator.
 *
 * A saved Business Path is never allowed to bypass metadata revalidation. The
 * existing validator remains responsible for bounded row probing and runtime
 * evidence classification.
 */
export function buildPreferredBusinessPathRuntimeArgs(
  request: PreferredBusinessPathRuntimeRequest
): Record<string, unknown> {
  const { artifact, revalidation } = request;

  if (artifact.state !== "preferred") {
    throw new Error("Only an enabled Preferred Business Path can be reused for runtime validation.");
  }
  if (revalidation.pathId !== artifact.id) {
    throw new Error("Business Path revalidation result does not belong to the requested saved path.");
  }
  if (revalidation.state !== "valid") {
    throw new Error(
      `Preferred Business Path ${artifact.id} must be metadata-valid before runtime validation; current state is ${revalidation.state}.`
    );
  }
  if (!request.sourceRecordId.trim()) {
    throw new Error("Preferred Business Path runtime validation requires a source record id.");
  }

  const tables = businessPathTables(artifact);
  const relationshipSchemas = businessPathRelationshipSchemas(artifact);

  return {
    ...(request.runtimeArguments ?? {}),
    sourceTable: artifact.sourceTable,
    targetTable: artifact.targetTable,
    sourceRecordId: request.sourceRecordId.trim(),
    assertedBusinessPathTables: tables,
    assertedBusinessPathRelationshipSchemaNames: relationshipSchemas,
    preferredBusinessPathId: artifact.id,
    preferredBusinessPathHistoricalVerification: artifact.verification?.status ?? "not-runtime-verified",
    preferredBusinessPathHistoricallyVerifiedInActiveEnvironment:
      revalidation.historicallyVerifiedInActiveEnvironment,
    ...(request.maxCandidates !== undefined ? { maxCandidates: request.maxCandidates } : {}),
    ...(request.maxRecordsPerStep !== undefined ? { maxRecordsPerStep: request.maxRecordsPerStep } : {}),
    ...(request.maxProbeRequests !== undefined ? { maxProbeRequests: request.maxProbeRequests } : {}),
    ...(request.maxDepth !== undefined ? { maxDepth: request.maxDepth } : {})
  };
}
