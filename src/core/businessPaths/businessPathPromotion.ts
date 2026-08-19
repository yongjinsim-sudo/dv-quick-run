import type {
  BusinessPathArtifact,
  BusinessPathHop,
  BusinessPathProvenance,
  BusinessPathVerification
} from "./businessPathContracts.js";
import { DVQR_BUSINESS_PATH_SCHEMA_VERSION } from "./businessPathContracts.js";
import { businessPathId } from "./businessPathIdentity.js";
import { validateBusinessPathArtifact } from "./businessPathValidation.js";

export interface BusinessPathPromotionInput {
  readonly name: string;
  readonly description?: string;
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly hops: readonly BusinessPathHop[];
  readonly priority?: number;
  readonly provenance: BusinessPathProvenance;
  readonly verification?: BusinessPathVerification;
  readonly applicability?: {
    readonly scope: "workspace";
    readonly verifiedEnvironmentIds?: readonly string[];
  };
}

export interface BusinessPathPromotionClock {
  nowIso(): string;
}

export interface BusinessPathPromotionResult {
  readonly artifact: BusinessPathArtifact;
  readonly created: boolean;
  readonly updatedExisting: boolean;
}

export function buildPromotedBusinessPathArtifact(
  input: BusinessPathPromotionInput,
  existing: BusinessPathArtifact | undefined,
  nowIso: string
): BusinessPathArtifact {
  const id = businessPathId(input.sourceTable, input.targetTable, input.hops);

  if (existing && existing.id !== id) {
    throw new Error("Existing Business Path identity does not match the promoted route.");
  }

  const verification = input.verification?.status === "verified"
    ? input.verification
    : existing?.verification?.status === "verified"
      ? existing.verification
      : input.verification ?? existing?.verification;

  const existingEnvironmentIds = existing?.applicability?.verifiedEnvironmentIds ?? [];
  const incomingEnvironmentIds = input.applicability?.verifiedEnvironmentIds ?? [];
  const verifiedEnvironmentIds = [...new Set([...existingEnvironmentIds, ...incomingEnvironmentIds])].sort();

  const artifact: BusinessPathArtifact = {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id,
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    sourceTable: input.sourceTable.trim(),
    targetTable: input.targetTable.trim(),
    state: "preferred",
    ...(input.priority !== undefined ? { priority: input.priority } : existing?.priority !== undefined ? { priority: existing.priority } : {}),
    hops: [...input.hops],
    provenance: {
      ...input.provenance,
      promotedAt: nowIso,
      promotedBy: "user"
    },
    ...(verification !== undefined ? { verification } : {}),
    applicability: {
      scope: "workspace",
      ...(verifiedEnvironmentIds.length ? { verifiedEnvironmentIds } : {})
    },
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso
  };

  const validation = validateBusinessPathArtifact(artifact);
  if (!validation.valid) {
    throw new Error(`Business Path promotion rejected: ${validation.issues.map((item) => item.code).join(", ")}`);
  }

  return artifact;
}
