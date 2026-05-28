export const defaultEnvironmentIdentityTokens = [
  "dev",
  "sit",
  "uat",
  "test",
  "tst",
  "perf",
  "preprod",
  "pre-prod",
  "np",
  "nonprod",
  "non-prod",
  "prod",
  "production",
  "qa",
  "sandbox",
  "sbx"
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

  const tokenSet = new Set(environmentTokens.map(normalizeEnvironmentToken).filter(Boolean));
  const parts = original
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .split("_")
    .filter(Boolean);

  const { remainingParts, removedTokens } = removeBoundaryEnvironmentTokens(parts, tokenSet);

  return {
    original,
    normalized: remainingParts.join("_"),
    removedTokens
  };
}

function removeBoundaryEnvironmentTokens(
  parts: readonly string[],
  tokenSet: ReadonlySet<string>
): { readonly remainingParts: readonly string[]; readonly removedTokens: readonly string[] } {
  const remainingParts = [...parts];
  const removedTokens: string[] = [];

  while (remainingParts.length > 0 && tokenSet.has(remainingParts[0])) {
    removedTokens.push(remainingParts.shift() ?? "");
  }

  while (remainingParts.length > 0 && tokenSet.has(remainingParts[remainingParts.length - 1])) {
    removedTokens.push(remainingParts.pop() ?? "");
  }

  return {
    remainingParts,
    removedTokens: removedTokens.filter(Boolean)
  };
}

function normalizeEnvironmentToken(token: string): string {
  return token.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
