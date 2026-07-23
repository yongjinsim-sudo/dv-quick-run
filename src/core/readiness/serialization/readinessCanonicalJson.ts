import { createHash } from "crypto";
import type { InvestigationReadinessRequestV1 } from "../readinessContracts.js";
import { resolveReadinessProfile } from "../readinessProfileResolver.js";
import { isJsonObject, ordinalCompare } from "../readinessValueAccess.js";

const EXCLUDED_FINGERPRINT_FIELDS = new Set(["generatedUtc"]);

function canonicalizeValue(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical readiness JSON does not support non-finite numbers.");
    }
    return JSON.stringify(value);
  }

  if (typeof value !== "object") {
    throw new TypeError(`Canonical readiness JSON does not support values of type ${typeof value}.`);
  }

  if (ancestors.has(value)) {
    throw new TypeError("Canonical readiness JSON does not support cyclic values.");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${Array.from(value, (item) => canonicalizeValue(item, ancestors)).join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical readiness JSON supports plain objects only.");
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError("Canonical readiness JSON does not support symbol-keyed properties.");
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeValue(item, ancestors)}`).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeReadinessJson(value: unknown): string {
  return canonicalizeValue(value, new Set<object>());
}

export function semanticReadinessRequest(
  request: InvestigationReadinessRequestV1
): Record<string, unknown> {
  const canonicalContributor = (value: unknown): unknown => {
    if (!isJsonObject(value)) {
      return value;
    }
    return {
      ...value,
      ...(Array.isArray(value.evidenceRefs)
        ? { evidenceRefs: [...value.evidenceRefs].sort((left, right) => ordinalCompare(canonicalizeReadinessJson(left), canonicalizeReadinessJson(right))) }
        : {})
    };
  };
  const byIdentity = (left: unknown, right: unknown): number => {
    const leftId = isJsonObject(left) && typeof left.id === "string" ? left.id : canonicalizeReadinessJson(left);
    const rightId = isJsonObject(right) && typeof right.id === "string" ? right.id : canonicalizeReadinessJson(right);
    return ordinalCompare(leftId, rightId);
  };
  const input = request.investigationInput;
  const understanding = request.understandingBundle;
  const profileResolution = resolveReadinessProfile(request.profile, input.kind);
  const contributorOrder = new Map(
    profileResolution.ok
      ? profileResolution.profile.contributorRules.map((rule, index) => [rule.contributorId, index])
      : []
  );
  const byContributorIdentity = (left: unknown, right: unknown): number => {
    const leftId = isJsonObject(left) && typeof left.id === "string" ? left.id : canonicalizeReadinessJson(left);
    const rightId = isJsonObject(right) && typeof right.id === "string" ? right.id : canonicalizeReadinessJson(right);
    const leftRank = contributorOrder.get(leftId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = contributorOrder.get(rightId) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || ordinalCompare(leftId, rightId);
  };
  return {
    ...Object.fromEntries(Object.entries(request).filter(([key]) => !EXCLUDED_FINGERPRINT_FIELDS.has(key))),
    investigationInput: {
      ...input,
      evidence: [...input.evidence].sort(byIdentity),
      contributors: [...input.contributors].map(canonicalContributor).sort(byContributorIdentity),
      ...(input.notes ? { notes: [...input.notes].sort(ordinalCompare) } : {})
    },
    understandingBundle: {
      ...understanding,
      ...(Array.isArray(understanding.limitations)
        ? { limitations: [...understanding.limitations].sort((left, right) => ordinalCompare(String(left), String(right))) }
        : {})
    }
  };
}

export function fingerprintReadinessRequest(request: InvestigationReadinessRequestV1): string {
  const canonical = canonicalizeReadinessJson(semanticReadinessRequest(request));
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}
