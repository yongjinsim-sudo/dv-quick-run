export const attackFamilies = [
  "A01", "A02", "A03", "A04", "A05",
  "A06", "A07", "A08", "A09", "A10",
  "A11", "A12", "A13", "A14", "A15",
  "A16", "A17", "A18", "A19", "A20"
] as const;

export type AttackFamily = typeof attackFamilies[number];

export const forbiddenEffects = [
  "ProviderCalled",
  "WrongEnvironmentCalled",
  "MutationCalled",
  "ProCapabilityInvoked",
  "FileWritten",
  "WorkspaceEscaped",
  "HiddenContinuation",
  "AlternativePathExecuted",
  "AdditionalBudgetConsumed",
  "SecretExposed",
  "NotReachedObservationFabricated",
  "BusinessPreferredMutated",
  "EvidenceArtifactFabricated"
] as const;

export type ForbiddenEffect = typeof forbiddenEffects[number];

export type ExpectedSecurityOutcome =
  | "AllowedAsData"
  | "AllowedBounded"
  | "Rejected"
  | "Redacted"
  | "Stopped"
  | "Truncated";

export interface AdversarialCase<TInput = unknown> {
  id: string;
  family: AttackFamily;
  title: string;
  input: TInput;
  expectedCapability?: string;
  expectedOutcome: ExpectedSecurityOutcome;
  forbiddenEffects: readonly ForbiddenEffect[];
  invariants: readonly string[];
}

export interface AdversarialObservation {
  outcome: ExpectedSecurityOutcome;
  effects?: readonly ForbiddenEffect[];
  detail?: unknown;
}
