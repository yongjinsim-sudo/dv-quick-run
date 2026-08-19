import type { BusinessPathArtifact } from "./businessPathContracts.js";
import { validateBusinessPathArtifact } from "./businessPathValidation.js";

export interface BusinessPathManagementUpdate {
  readonly name?: string;
  readonly description?: string | null;
  readonly priority?: number | null;
  readonly state?: "preferred" | "disabled";
}

export interface BusinessPathManagementClock {
  nowIso(): string;
}

export function updateManagedBusinessPath(
  artifact: BusinessPathArtifact,
  update: BusinessPathManagementUpdate,
  nowIso: string
): BusinessPathArtifact {
  const name = update.name !== undefined ? update.name.trim() : artifact.name;
  if (!name) {
    throw new Error("Business Path name cannot be empty.");
  }

  const priority = update.priority === null
    ? undefined
    : update.priority !== undefined
      ? update.priority
      : artifact.priority;
  if (priority !== undefined && (!Number.isInteger(priority) || priority < 0)) {
    throw new Error("Business Path priority must be a non-negative integer.");
  }

  const description = update.description === null
    ? undefined
    : update.description !== undefined
      ? update.description.trim() || undefined
      : artifact.description;

  const updated: BusinessPathArtifact = {
    ...artifact,
    name,
    ...(description !== undefined ? { description } : { description: undefined }),
    ...(priority !== undefined ? { priority } : { priority: undefined }),
    state: update.state ?? artifact.state,
    updatedAt: nowIso
  };

  const validation = validateBusinessPathArtifact(updated);
  if (!validation.valid) {
    throw new Error(
      `Managed Business Path update rejected: ${validation.issues.map((item) => item.code).join(", ")}`
    );
  }

  return updated;
}

export function businessPathDisplayChain(artifact: BusinessPathArtifact): string {
  const hops = [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal);
  if (!hops.length) {
    return `${artifact.sourceTable} → ${artifact.targetTable}`;
  }
  return [hops[0].fromTable, ...hops.map((hop) => hop.toTable)].join(" → ");
}

export function businessPathVerificationLabel(artifact: BusinessPathArtifact): string {
  if (artifact.verification?.status !== "verified") {
    return "Not runtime verified";
  }
  return artifact.verification.verifiedAt
    ? `Previously verified ${artifact.verification.verifiedAt}`
    : "Previously runtime verified";
}
