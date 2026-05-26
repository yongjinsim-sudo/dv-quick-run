export type IdentityMatchConfidence = "ExactMatch" | "LikelyMatch" | "PossibleMatch" | "NoMatch";

export interface IdentityMatchEvidence {
  readonly label: string;
  readonly detail: string;
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
  readonly displayName?: string;
  readonly uniqueName?: string;
  readonly email?: string;
  readonly applicationId?: string;
  readonly azureAdObjectId?: string;
  readonly isApplicationUser?: boolean;
  readonly roles?: readonly string[];
  readonly teams?: readonly string[];
}
