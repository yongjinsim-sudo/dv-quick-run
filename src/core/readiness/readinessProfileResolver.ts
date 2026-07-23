import {
  createReadinessError,
  type InvestigationKind,
  type InvestigationReadinessErrorV1,
  type InvestigationReadinessProfileReferenceV1
} from "./readinessContracts.js";
import type { InvestigationReadinessProfileV1 } from "./readinessProfile.js";
import { CROSS_DIFF_READINESS_PROFILE_V1 } from "./profiles/crossDiffReadinessProfileV1.js";
import { TIMELINE_READINESS_PROFILE_V1 } from "./profiles/timelineReadinessProfileV1.js";

const PROFILES: readonly InvestigationReadinessProfileV1[] = [
  TIMELINE_READINESS_PROFILE_V1,
  CROSS_DIFF_READINESS_PROFILE_V1
];

export type ReadinessProfileResolution =
  | { readonly ok: true; readonly profile: InvestigationReadinessProfileV1 }
  | { readonly ok: false; readonly error: InvestigationReadinessErrorV1 };

export function listReadinessProfiles(): readonly InvestigationReadinessProfileV1[] {
  return PROFILES;
}

export function resolveReadinessProfile(
  reference: InvestigationReadinessProfileReferenceV1,
  investigationKind?: InvestigationKind
): ReadinessProfileResolution {
  const profileById = PROFILES.find((profile) => profile.profileId === reference.profileId);
  if (!profileById) {
    return {
      ok: false,
      error: createReadinessError(
        "InvalidInput",
        `Unknown readiness profile \`${reference.profileId}\`.`,
        ["Use a profile identifier returned by the versioned readiness profile catalogue."]
      )
    };
  }

  if (profileById.version !== reference.version) {
    return {
      ok: false,
      error: createReadinessError(
        "UnsupportedProfileVersion",
        `Readiness profile \`${reference.profileId}\` does not support version \`${reference.version}\`.`,
        [`Supported version: ${profileById.version}.`]
      )
    };
  }

  if (investigationKind && profileById.investigationKind !== investigationKind) {
    return {
      ok: false,
      error: createReadinessError(
        "InvalidInput",
        `Readiness profile \`${reference.profileId}\` does not apply to investigation kind \`${investigationKind}\`.`,
        [`Expected investigation kind: ${profileById.investigationKind}.`]
      )
    };
  }

  return { ok: true, profile: profileById };
}
