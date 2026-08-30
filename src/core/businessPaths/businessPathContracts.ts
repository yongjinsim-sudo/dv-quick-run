export const DVQR_BUSINESS_PATH_SCHEMA_VERSION = "dvqr-business-path-v1" as const;

export type BusinessPathSchemaVersion = typeof DVQR_BUSINESS_PATH_SCHEMA_VERSION;

export type BusinessPathState = "saved" | "preferred" | "disabled";

export type BusinessPathKnowledgeState = "suggested" | "verified" | "preferred";

export type BusinessPathValidationState = "valid" | "stale" | "unknown";

export type BusinessPathRelationshipType = "ManyToOne" | "OneToMany" | "ManyToMany";

export type BusinessPathDirection = "forward" | "reverse";

export interface BusinessPathHop {
  readonly ordinal: number;
  readonly fromTable: string;
  readonly toTable: string;
  readonly relationshipSchemaName: string;
  readonly relationshipType: BusinessPathRelationshipType;
  readonly direction: BusinessPathDirection;
  readonly navigationProperty?: string;
  readonly lookupAttribute?: string;
  readonly intersectTable?: string;
  readonly polymorphicTarget?: string;
}

export interface BusinessPathProvenance {
  readonly promotedFrom:
    | "runtime-validation"
    | "guided-traversal"
    | "relationship-discovery"
    | "manual-reviewed";
  readonly sourceEvidenceId?: string;
  readonly investigationId?: string;
  readonly promotedAt: string;
  readonly promotedBy: "user";
}

export interface BusinessPathVerificationEnvironment {
  readonly identity: string;
  readonly organisationId?: string;
}

export interface BusinessPathVerification {
  readonly status: "verified" | "not-runtime-verified";
  readonly environment?: BusinessPathVerificationEnvironment;
  readonly verifiedAt?: string;
  readonly testedSourceCount?: number;
  readonly reachedTargetCount?: number;
  readonly observedTargetRows?: number | null;
  readonly bounded: boolean;
  readonly evidenceRef?: string;
}

export interface BusinessPathApplicability {
  readonly scope: "workspace";
  readonly verifiedEnvironmentIds?: readonly string[];
}

export interface BusinessPathArtifact {
  readonly schemaVersion: BusinessPathSchemaVersion;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly sourceTable: string;
  readonly targetTable: string;
  readonly state: BusinessPathState;
  readonly priority?: number;
  readonly hops: readonly BusinessPathHop[];
  readonly provenance: BusinessPathProvenance;
  readonly verification?: BusinessPathVerification;
  readonly applicability?: BusinessPathApplicability;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessPathValidationIssue {
  readonly code:
    | "invalid-schema-version"
    | "invalid-id"
    | "invalid-name"
    | "invalid-source-table"
    | "invalid-target-table"
    | "invalid-state"
    | "invalid-priority"
    | "missing-hops"
    | "excessive-hops"
    | "invalid-text-content"
    | "invalid-hop-ordinal"
    | "duplicate-hop-ordinal"
    | "invalid-hop-table"
    | "invalid-relationship-schema"
    | "invalid-relationship-type"
    | "invalid-direction"
    | "path-discontinuity"
    | "source-mismatch"
    | "target-mismatch"
    | "id-mismatch"
    | "invalid-provenance"
    | "invalid-verification"
    | "invalid-applicability"
    | "secret-like-content";
  readonly message: string;
  readonly hopOrdinal?: number;
}

export interface BusinessPathArtifactValidationResult {
  readonly valid: boolean;
  readonly issues: readonly BusinessPathValidationIssue[];
}
