import type {
  BusinessPathArtifact,
  BusinessPathRepository,
  BusinessPathVerificationEnvironment
} from "../../core/businessPaths/index.js";

export interface BusinessPathSuccessfulRuntimeVerification {
  readonly environment: BusinessPathVerificationEnvironment;
  readonly observedTargetRows: number | null;
  readonly verifiedAt?: string;
  readonly evidenceRef?: string;
}

export interface BusinessPathVerificationClock {
  nowIso(): string;
}

/**
 * Refreshes historical verification provenance only after canonical DVQR runtime
 * validation has reached the saved path's target.
 *
 * Empty/no-continuation, access-limited, failed and not-tested runs must not call
 * this service and therefore cannot erase an earlier successful verification.
 */
export class BusinessPathVerificationService {
  public constructor(
    private readonly repository: BusinessPathRepository,
    private readonly clock: BusinessPathVerificationClock = { nowIso: () => new Date().toISOString() }
  ) {}

  public recordSuccessfulRuntimeVerification(
    id: string,
    evidence: BusinessPathSuccessfulRuntimeVerification
  ): BusinessPathArtifact {
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new Error(`Business Path ${id} was not found.`);
    }
    if (existing.state !== "preferred") {
      throw new Error("Only an enabled Preferred Business Path can refresh runtime verification.");
    }
    if (!evidence.environment.identity.trim()) {
      throw new Error("Runtime verification requires an environment identity.");
    }

    const now = evidence.verifiedAt ?? this.clock.nowIso();
    const environmentIdentity = evidence.environment.identity.trim();
    const verifiedEnvironmentIds = [
      ...(existing.applicability?.verifiedEnvironmentIds ?? []),
      environmentIdentity
    ].filter((value, index, values) =>
      values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
    ).sort((left, right) => left.localeCompare(right));

    const updated: BusinessPathArtifact = {
      ...existing,
      verification: {
        status: "verified",
        environment: {
          identity: environmentIdentity,
          ...(evidence.environment.organisationId
            ? { organisationId: evidence.environment.organisationId }
            : {})
        },
        verifiedAt: now,
        testedSourceCount: 1,
        reachedTargetCount: 1,
        observedTargetRows: evidence.observedTargetRows,
        bounded: true,
        ...(evidence.evidenceRef ? { evidenceRef: evidence.evidenceRef } : {})
      },
      applicability: {
        scope: "workspace",
        verifiedEnvironmentIds
      },
      updatedAt: now
    };

    this.repository.save(updated);
    return updated;
  }
}
