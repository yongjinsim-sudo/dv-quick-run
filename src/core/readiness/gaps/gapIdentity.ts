import { createHash } from "crypto";
import { canonicalizeReadinessJson } from "../serialization/readinessCanonicalJson.js";
import type { ReadonlyJsonObject } from "../readinessContracts.js";
import { uniqueSorted } from "../readinessValueAccess.js";

export function buildReadinessGapId(
  subject: ReadonlyJsonObject,
  ruleId: string,
  contributorIds: readonly string[]
): string {
  const semanticIdentity = canonicalizeReadinessJson({
    subject,
    ruleId,
    contributorIds: uniqueSorted(contributorIds)
  });
  const digest = createHash("sha256").update(semanticIdentity, "utf8").digest("hex").slice(0, 20);
  return `readiness-gap:${ruleId}:${digest}`;
}
