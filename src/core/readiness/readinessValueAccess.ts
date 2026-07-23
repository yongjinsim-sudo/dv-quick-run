import type {
  ContributorReadinessState,
  EvidenceQualityDimension,
  EvidenceQualityState,
  JsonValue,
  ReadonlyJsonObject,
  ReadinessContributorRole
} from "./readinessContracts.js";

const CONTRIBUTOR_STATES: readonly ContributorReadinessState[] = [
  "Available", "Partial", "PermissionLimited", "Missing", "NotConsulted", "Unsupported", "Stale"
];
const CONTRIBUTOR_ROLES: readonly ReadinessContributorRole[] = ["Primary", "Required", "Recommended", "Optional"];
const QUALITY_STATES: readonly EvidenceQualityState[] = ["Sufficient", "Limited", "Unknown", "NotApplicable"];

export function isJsonObject(value: JsonValue | undefined | unknown): value is ReadonlyJsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function readBoolean(value: JsonValue | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readStringArray(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function readContributorState(value: JsonValue | undefined): ContributorReadinessState | undefined {
  return typeof value === "string" && CONTRIBUTOR_STATES.includes(value as ContributorReadinessState)
    ? value as ContributorReadinessState
    : undefined;
}

export function readContributorRole(value: JsonValue | undefined): ReadinessContributorRole | undefined {
  return typeof value === "string" && CONTRIBUTOR_ROLES.includes(value as ReadinessContributorRole)
    ? value as ReadinessContributorRole
    : undefined;
}

export function readQualityState(
  contributor: ReadonlyJsonObject,
  dimension: EvidenceQualityDimension
): EvidenceQualityState | undefined {
  const directKey = `${dimension.charAt(0).toLowerCase()}${dimension.slice(1)}State`;
  const direct = contributor[directKey];
  if (typeof direct === "string" && QUALITY_STATES.includes(direct as EvidenceQualityState)) {
    return direct as EvidenceQualityState;
  }

  const quality = contributor.quality;
  if (!isJsonObject(quality)) {
    return undefined;
  }
  const nested = quality[dimension] ?? quality[dimension.toLowerCase()];
  return typeof nested === "string" && QUALITY_STATES.includes(nested as EvidenceQualityState)
    ? nested as EvidenceQualityState
    : undefined;
}

export function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(ordinalCompare);
}
