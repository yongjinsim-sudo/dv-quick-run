export type IdentityMatchConfidence = "ExactMatch" | "LikelyMatch" | "PossibleMatch" | "NoMatch";

export type ComparableIdentitySubjectType =
  | "user"
  | "team"
  | "role"
  | "applicationUser"
  | "businessUnit";

export type IdentityMatchEvidenceStrength = "exact" | "strong" | "supporting" | "weak";

export interface IdentityMatchEvidence {
  readonly label: string;
  readonly detail: string;
  readonly strength?: IdentityMatchEvidenceStrength;
}

export interface IdentityMatchCandidate<TIdentity> {
  readonly source: TIdentity;
  readonly target?: TIdentity;
  readonly confidence: IdentityMatchConfidence;
  readonly evidence: readonly IdentityMatchEvidence[];
  readonly normalizedKey?: string;
}

export interface ComparableIdentity {
  readonly id?: string;
  readonly subjectType?: ComparableIdentitySubjectType;
  readonly displayName?: string;
  readonly uniqueName?: string;
  readonly email?: string;
  readonly applicationId?: string;
  readonly azureAdObjectId?: string;
  readonly isApplicationUser?: boolean;
  readonly teamType?: string;
  readonly businessUnitName?: string;
  readonly businessUnitPath?: readonly string[];
  readonly parentBusinessUnitName?: string;
  readonly roles?: readonly string[];
  readonly directRoles?: readonly string[];
  readonly inheritedRoles?: readonly string[];
  readonly inheritedTeamRoles?: readonly string[];
  readonly teams?: readonly string[];
  readonly users?: readonly string[];
}
