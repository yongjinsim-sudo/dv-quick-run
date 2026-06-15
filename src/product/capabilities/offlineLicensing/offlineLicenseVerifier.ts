import { createPublicKey, type KeyObject, verify } from "crypto";
import { capabilityIds, type CapabilityId } from "../capabilityIds.js";
import { offlineGrantTypes, offlineLicenseKind, type OfflineGrantType, type OfflineLicensePayload, type OfflineLicenseVerificationResult, type SignedOfflineLicenseFile } from "./offlineLicenseTypes.js";
import { canonicalJson } from "./canonicalJson.js";

// Public verification key for signed offline licenses. The corresponding private
// signing key must remain outside the extension and outside public repositories.
export const defaultOfflineLicensePublicKeyPem = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAqxGj/q0z7dLqqE3x4K/U
LHyNkWAno0mlg8Os4eV8GZYtwYBzaSTrZZ8GpNvr5FXd2Xp6VG+XxOog8o94L2Mt
wMlnhBwpJxZfVZEzD1lGLtydpq8fq6C2KUr395qgUiK0fvSKdgOWOuvm9vvZ4Mao
toEx8P2wA2PAOuupxYs7/q1TWFMZBjOTdhQw8V0kYURdzrxm8d0tKzyHZIzerP2q
mJsKkdwt8tEOfoG2xlgTr+byao7JN0d05PEuWLtlJutsM5xrxdWC8XYxSdHbnpl1
lsffnOLogn/egJfNrT1yd/asXDmUaQGt+zQ3hVWig3g4aawrm42z53DDRn+bYiuo
mUXXvSIydhgiDFguwgrUsNA9qH4C0rNs9yu4tWrg1KGKKggx9Db/PqIDIMoioc3W
4kSXvJFCTN39q4kl9aNbpMAYmb3DyzZFsVAcUsyJtec2dQXd+RMDeunICz+Z+spj
sTpg+S50iFT2hIujWMMBunxBgO77QMjG5ikn6H0pmWSH2pEhfvh6z7c9PNayu4Dq
DnF5AfLCIaOMIFUIT8NGYEJPCYDXdmZAK9cyd3JNxWvYZd+lKoiA7QlsdZPAlb3h
TqRZb+3XFd8OE0+gGZGRYFCH7he5reRqzus135qI394BFOSnwoeMFSVa1yhKUWR1
aJUOuUx02Wj7ZGzQ6Mc9GDMCAwEAAQ==
-----END PUBLIC KEY-----`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === "string" && capabilityIds.includes(value as CapabilityId);
}

function isOfflineGrantType(value: unknown): value is OfflineGrantType {
  return typeof value === "string" && offlineGrantTypes.includes(value as OfflineGrantType);
}

function normalizeIsoString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function normalizeExpiresAt(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return normalizeIsoString(value);
}

function resolveSignatureAlgorithm(publicKey: KeyObject): string | null {
  return publicKey.asymmetricKeyType === "rsa" ? "RSA-SHA256" : null;
}

function normalizePayload(value: unknown): OfflineLicensePayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.licenseId !== "string" || value.licenseId.trim().length === 0) {
    return undefined;
  }

  if (value.edition !== "pro" || !isOfflineGrantType(value.grantType)) {
    return undefined;
  }

  const issuedAt = normalizeIsoString(value.issuedAt);
  const expiresAt = normalizeExpiresAt(value.expiresAt);

  if (issuedAt === undefined || expiresAt === undefined || !Array.isArray(value.capabilities)) {
    return undefined;
  }

  const capabilities: CapabilityId[] = [];

  for (const capability of value.capabilities) {
    if (isCapabilityId(capability) && !capabilities.includes(capability)) {
      capabilities.push(capability);
    }
  }

  if (capabilities.length === 0) {
    return undefined;
  }

  const payload: OfflineLicensePayload = {
    licenseId: value.licenseId.trim(),
    edition: "pro",
    grantType: value.grantType,
    issuedAt,
    expiresAt: expiresAt ?? null,
    capabilities
  };

  if (typeof value.holder === "string" && value.holder.trim().length > 0) {
    payload.holder = value.holder.trim();
  }
  if (typeof value.note === "string" && value.note.trim().length > 0) {
    payload.note = value.note.trim();
  }


  return payload;
}

export function parseSignedOfflineLicense(raw: string): SignedOfflineLicenseFile | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.kind !== offlineLicenseKind || typeof parsed.signature !== "string") {
    return undefined;
  }

  const payload = normalizePayload(parsed.payload);

  if (payload === undefined || parsed.signature.trim().length === 0) {
    return undefined;
  }

  return {
    kind: offlineLicenseKind,
    payload,
    signature: parsed.signature.trim()
  };
}

export function verifySignedOfflineLicense(input: {
  raw: string;
  publicKeyPem?: string;
  now?: Date;
}): OfflineLicenseVerificationResult {
  const license = parseSignedOfflineLicense(input.raw);

  if (license === undefined) {
    return {
      status: "invalid",
      message: "Offline license file was not readable. DVQR has continued in Free mode."
    };
  }

  let signatureValid = false;

  try {
    const publicKey = createPublicKey(input.publicKeyPem ?? defaultOfflineLicensePublicKeyPem);

    signatureValid = verify(
      resolveSignatureAlgorithm(publicKey),
      Buffer.from(canonicalJson(license.payload), "utf8"),
      publicKey,
      Buffer.from(license.signature, "base64")
    );
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return {
      status: "invalid",
      message: "Offline license signature could not be verified. DVQR has continued in Free mode."
    };
  }

  const now = input.now ?? new Date();

  if (license.payload.expiresAt !== null && Date.parse(license.payload.expiresAt) <= now.getTime()) {
    return {
      status: "expired",
      license,
      message: "Offline license has expired. DVQR has continued in Free mode."
    };
  }

  return {
    status: "valid",
    license
  };
}
