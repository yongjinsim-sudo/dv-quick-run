export const defaultEnvironmentIdentityTokens = [
  "dev",
  "sit",
  "uat",
  "test",
  "perf",
  "preprod",
  "pre-prod",
  "np",
  "nonprod",
  "non-prod",
  "prod",
  "production"
] as const;

export interface IdentityNormalizationResult {
  readonly original: string;
  readonly normalized: string;
  readonly removedTokens: readonly string[];
}

export function normalizeIdentityName(
  value: string | undefined,
  environmentTokens: readonly string[] = defaultEnvironmentIdentityTokens
): IdentityNormalizationResult | undefined {
  const original = (value ?? "").trim();
  if (!original) {
    return undefined;
  }

  const tokenSet = new Set(environmentTokens.map((token) => token.toLowerCase()));
  const parts = original
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .split("_")
    .filter(Boolean);

  const removedTokens: string[] = [];
  const normalizedParts = parts.filter((part) => {
    const shouldRemove = tokenSet.has(part);
    if (shouldRemove) {
      removedTokens.push(part);
    }

    return !shouldRemove;
  });

  return {
    original,
    normalized: normalizedParts.join("_"),
    removedTokens
  };
}
