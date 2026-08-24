import type {
  BusinessPathArtifact,
  BusinessPathHop,
  BusinessPathRepository
} from "../../core/businessPaths/index.js";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  canonicalBusinessPathKey,
  validateBusinessPathArtifact
} from "../../core/businessPaths/index.js";

export interface SaveOrVerifyBusinessPathCommand {
  readonly environmentId: string;
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly hops: readonly BusinessPathHop[];
  readonly traversalResultId?: string;
  readonly sourceRecordId?: string;
  readonly observedTargetRows?: number | null;
  readonly name?: string;
  readonly userRequestedAction: "saveOrVerify";
}

export type SaveOrVerifyBusinessPathResult =
  | { readonly outcome: "Created"; readonly artifact: BusinessPathArtifact }
  | { readonly outcome: "VerifiedExisting"; readonly artifact: BusinessPathArtifact; readonly previousVerifiedAt?: string };

export interface SaveOrVerifyBusinessPathClock { nowIso(): string; }

const defaultClock: SaveOrVerifyBusinessPathClock = { nowIso: () => new Date().toISOString() };

/** Explicit workspace mutation for a completed, user-approved Guided Traversal route. */
export class SaveOrVerifyBusinessPathService {
  public constructor(
    private readonly repository: BusinessPathRepository,
    private readonly clock: SaveOrVerifyBusinessPathClock = defaultClock
  ) {}

  public execute(command: SaveOrVerifyBusinessPathCommand): SaveOrVerifyBusinessPathResult {
    if (command.userRequestedAction !== "saveOrVerify") {
      throw new Error("Business Path capture requires explicit save/verify intent.");
    }
    const environmentId = command.environmentId.trim();
    if (!environmentId) throw new Error("Business Path capture requires an environment identity.");
    if (!command.hops.length) throw new Error("Business Path capture requires at least one exact relationship hop.");

    const key = canonicalBusinessPathKey(command.sourceTable, command.targetTable, command.hops);
    const existing = this.repository.list().find((artifact) =>
      canonicalBusinessPathKey(artifact.sourceTable, artifact.targetTable, artifact.hops) === key
    );
    const now = this.clock.nowIso();

    if (existing) {
      const previousVerifiedAt = existing.verification?.verifiedAt;
      const verifiedEnvironmentIds = [...new Set([
        ...(existing.applicability?.verifiedEnvironmentIds ?? []),
        environmentId
      ])].sort((left, right) => left.localeCompare(right));
      const artifact: BusinessPathArtifact = {
        ...existing,
        verification: {
          status: "verified",
          environment: { identity: environmentId },
          verifiedAt: now,
          testedSourceCount: 1,
          reachedTargetCount: 1,
          observedTargetRows: command.observedTargetRows ?? null,
          bounded: true,
          ...(command.traversalResultId ? { evidenceRef: command.traversalResultId } : {})
        },
        applicability: { scope: "workspace", verifiedEnvironmentIds },
        updatedAt: now
      };
      this.assertValid(artifact);
      this.repository.save(artifact);
      return { outcome: "VerifiedExisting", artifact, ...(previousVerifiedAt ? { previousVerifiedAt } : {}) };
    }

    const artifact: BusinessPathArtifact = {
      schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
      id: businessPathId(command.sourceTable, command.targetTable, command.hops),
      name: command.name?.trim() || `${command.sourceTable} → ${command.targetTable}`,
      sourceTable: command.sourceTable.trim(),
      targetTable: command.targetTable.trim(),
      state: "saved",
      hops: [...command.hops],
      provenance: {
        promotedFrom: "guided-traversal",
        ...(command.traversalResultId ? { sourceEvidenceId: command.traversalResultId } : {}),
        promotedAt: now,
        promotedBy: "user"
      },
      verification: {
        status: "verified",
        environment: { identity: environmentId },
        verifiedAt: now,
        testedSourceCount: 1,
        reachedTargetCount: 1,
        observedTargetRows: command.observedTargetRows ?? null,
        bounded: true,
        ...(command.traversalResultId ? { evidenceRef: command.traversalResultId } : {})
      },
      applicability: { scope: "workspace", verifiedEnvironmentIds: [environmentId] },
      createdAt: now,
      updatedAt: now
    };
    this.assertValid(artifact);
    this.repository.save(artifact);
    return { outcome: "Created", artifact };
  }

  private assertValid(artifact: BusinessPathArtifact): void {
    const validation = validateBusinessPathArtifact(artifact);
    if (!validation.valid) {
      throw new Error(`Business Path capture rejected: ${validation.issues.map((item) => item.code).join(", ")}`);
    }
  }
}
