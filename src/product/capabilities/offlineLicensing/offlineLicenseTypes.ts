import type { CapabilityId } from "../capabilityIds.js";
export const offlineLicenseKind = "dvqr-offline-license-v1";

export const offlineGrantTypes = [
  "offline",
  "mvp",
  "founder",
  "evaluation",
  "preview"
] as const;

export type OfflineGrantType = (typeof offlineGrantTypes)[number];

export interface OfflineLicensePayload {
  licenseId: string;
  edition: "pro";
  grantType: OfflineGrantType;
  issuedAt: string;
  expiresAt: string | null;
  capabilities: CapabilityId[];
  holder?: string;
  note?: string;
}

export interface SignedOfflineLicenseFile {
  kind: typeof offlineLicenseKind;
  payload: OfflineLicensePayload;
  signature: string;
}

export type OfflineLicenseVerificationStatus = "valid" | "invalid" | "expired";

export interface OfflineLicenseVerificationResult {
  status: OfflineLicenseVerificationStatus;
  license?: SignedOfflineLicenseFile;
  message?: string;
}
