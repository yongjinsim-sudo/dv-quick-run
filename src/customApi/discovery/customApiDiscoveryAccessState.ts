import type { CustomApiAccessRestrictionDetails } from "./customApiAccessRestriction.js";

let latestRestriction: CustomApiAccessRestrictionDetails | undefined;
let latestEnvironmentUrl = "";

export function setCustomApiDiscoveryAccessRestriction(environmentUrl: string | undefined, restriction: CustomApiAccessRestrictionDetails): void {
  latestEnvironmentUrl = environmentUrl ?? "";
  latestRestriction = restriction;
}

export function clearCustomApiDiscoveryAccessRestriction(environmentUrl: string | undefined): void {
  if (!latestRestriction) {
    return;
  }

  const normalizedEnvironmentUrl = environmentUrl ?? "";
  if (!latestEnvironmentUrl || latestEnvironmentUrl === normalizedEnvironmentUrl) {
    latestRestriction = undefined;
    latestEnvironmentUrl = "";
  }
}

export function getCustomApiDiscoveryAccessRestriction(environmentUrl: string | undefined): CustomApiAccessRestrictionDetails | undefined {
  if (!latestRestriction) {
    return undefined;
  }

  const normalizedEnvironmentUrl = environmentUrl ?? "";
  if (latestEnvironmentUrl && normalizedEnvironmentUrl && latestEnvironmentUrl !== normalizedEnvironmentUrl) {
    return undefined;
  }

  return latestRestriction;
}
