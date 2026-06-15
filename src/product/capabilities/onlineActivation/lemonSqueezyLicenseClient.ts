import type { EntitlementStatus, EntitlementSupporterTag } from "../entitlementTypes.js";

export interface LemonSqueezyLicenseKeyPayload {
  id?: number | string;
  status?: string;
  key?: string;
  expires_at?: string | null;
}

export interface LemonSqueezyLicenseInstancePayload {
  id?: string;
  name?: string;
}

export interface LemonSqueezyActivateLicenseResponse {
  activated?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicenseKeyPayload | null;
  instance?: LemonSqueezyLicenseInstancePayload | null;
  meta?: Record<string, unknown> | null;
}

export interface LemonSqueezyValidateLicenseResponse {
  valid?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicenseKeyPayload | null;
  instance?: LemonSqueezyLicenseInstancePayload | null;
  meta?: Record<string, unknown> | null;
}

export interface LemonSqueezyDeactivateLicenseResponse {
  deactivated?: boolean;
  error?: string | null;
  license_key?: LemonSqueezyLicenseKeyPayload | null;
  meta?: Record<string, unknown> | null;
}

export interface OnlineLicenseActivationResult {
  status: Extract<EntitlementStatus, "valid" | "invalid" | "expired" | "unavailable">;
  expiresAt: Date | null;
  provider: "lemonSqueezy";
  providerLicenseId?: string;
  providerInstanceId?: string;
  providerProductId?: string;
  providerVariantId?: string;
  customerName?: string;
  customerEmail?: string;
  supporterTags?: EntitlementSupporterTag[];
  message: string;
}

export interface OnlineLicenseDeactivationResult {
  deactivated: boolean;
  status: Extract<EntitlementStatus, "valid" | "invalid" | "expired" | "unavailable">;
  message: string;
}

export interface OnlineLicenseActivationClient {
  activateLicense(licenseKey: string, instanceName: string): Promise<OnlineLicenseActivationResult>;
  validateLicense(licenseKey: string, instanceId?: string): Promise<OnlineLicenseActivationResult>;
  deactivateLicense(licenseKey: string, instanceId: string): Promise<OnlineLicenseDeactivationResult>;
}

export interface LemonSqueezyLicenseClientOptions {
  activationEndpoint?: string;
  validationEndpoint?: string;
  deactivationEndpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  pathfinderVariantIds?: string[];
}

const defaultActivationEndpoint = "https://api.lemonsqueezy.com/v1/licenses/activate";
const defaultValidationEndpoint = "https://api.lemonsqueezy.com/v1/licenses/validate";
const defaultDeactivationEndpoint = "https://api.lemonsqueezy.com/v1/licenses/deactivate";
const defaultActivationTimeoutMs = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeString(value);
}

function normalizeDate(value: unknown): Date | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function readMetaId(meta: Record<string, unknown> | null | undefined, key: string): string | undefined {
  if (meta === null || meta === undefined) {
    return undefined;
  }

  return normalizeId(meta[key]);
}

function readMetaString(meta: Record<string, unknown> | null | undefined, key: string): string | undefined {
  if (meta === null || meta === undefined) {
    return undefined;
  }

  return normalizeString(meta[key]);
}

function readDeepId(value: unknown, keys: readonly string[], depth = 0): string | undefined {
  if (depth > 6 || value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readDeepId(item, keys, depth + 1);

      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const direct = normalizeId(value[key]);

    if (direct !== undefined) {
      return direct;
    }
  }

  for (const nested of Object.values(value)) {
    const found = readDeepId(nested, keys, depth + 1);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function readProviderVariantId(meta: Record<string, unknown> | null | undefined, responseBody: unknown): string | undefined {
  return readMetaId(meta, "variant_id")
    ?? readMetaId(meta, "variantId")
    ?? readDeepId(responseBody, ["variant_id", "variantId"]);
}

const defaultAllowedProductNames = [
  "DV Quick Run Pro"
];

function normalizeComparableText(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

function readProviderProductId(meta: Record<string, unknown> | null | undefined, responseBody: unknown): string | undefined {
  return readMetaId(meta, "product_id")
    ?? readMetaId(meta, "productId")
    ?? readDeepId(responseBody, ["product_id", "productId"]);
}

function readProviderProductName(meta: Record<string, unknown> | null | undefined, responseBody: unknown): string | undefined {
  return readMetaString(meta, "product_name")
    ?? readMetaString(meta, "productName")
    ?? readDeepString(responseBody, ["product_name", "productName", "product"]);
}

function readDeepString(value: unknown, keys: readonly string[], depth = 0): string | undefined {
  if (depth > 6 || value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readDeepString(item, keys, depth + 1);

      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const direct = normalizeString(value[key]);

    if (direct !== undefined) {
      return direct;
    }
  }

  for (const nested of Object.values(value)) {
    const found = readDeepString(nested, keys, depth + 1);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function isAllowedDvqrProduct(productId: string | undefined, productName: string | undefined): boolean {
  // Product IDs can legitimately differ between Lemon Squeezy test/live copies.
  // Product names are public, stable checkout metadata returned by the License API.
  // This prevents a valid license key for another Lemon Squeezy product from
  // unlocking DV Quick Run Pro while avoiding any private Store API key dependency.
  const normalizedProductName = normalizeComparableText(productName);

  return normalizedProductName !== undefined
    && defaultAllowedProductNames.map(normalizeComparableText).includes(normalizedProductName);
}

function mapLicenseStatus(status: string | undefined): Extract<EntitlementStatus, "valid" | "invalid" | "expired"> {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "inactive":
      return "valid";
    case "expired":
      return "expired";
    case "disabled":
    default:
      return "invalid";
  }
}


function normalizeOnlineActivationFailureMessage(rawMessage: string | undefined, fallback: string): string {
  if (rawMessage === undefined) {
    return fallback;
  }

  const normalized = rawMessage.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.includes("license_key") || normalized.includes("license key") || normalized.includes("not found")) {
    return "DVQR Pro activation failed. Please verify your activation key and try again.";
  }

  if (normalized.includes("expired")) {
    return "DVQR Pro activation failed because the activation key has expired.";
  }

  if (normalized.includes("disabled") || normalized.includes("inactive")) {
    return "DVQR Pro activation failed because this activation key is not currently active.";
  }

  return fallback;
}

function normalizeOnlineVerificationFailureMessage(rawMessage: string | undefined, fallback: string): string {
  if (rawMessage === undefined) {
    return fallback;
  }

  const normalized = rawMessage.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.includes("license_key") || normalized.includes("license key") || normalized.includes("not found")) {
    return "DVQR Pro could not verify the stored activation. DVQR has continued using available local entitlement state.";
  }

  if (normalized.includes("expired")) {
    return "DVQR Pro activation has expired. DVQR has continued in Free mode.";
  }

  if (normalized.includes("disabled") || normalized.includes("inactive")) {
    return "DVQR Pro activation is not currently active. DVQR has continued in Free mode.";
  }

  return fallback;
}

function normalizeOnlineDeactivationFailureMessage(rawMessage: string | undefined, fallback: string): string {
  if (rawMessage === undefined) {
    return fallback;
  }

  const normalized = rawMessage.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.includes("license_key") || normalized.includes("license key") || normalized.includes("not found") || normalized.includes("instance")) {
    return "DVQR Pro deactivation could not be completed online. You can still clear the local activation on this machine.";
  }

  return fallback;
}

function buildSupporterTagsForVariant(variantId: string | undefined, pathfinderVariantIds: readonly string[]): EntitlementSupporterTag[] | undefined {
  if (variantId === undefined || !pathfinderVariantIds.includes(variantId)) {
    return undefined;
  }

  return ["Pathfinder"];
}

function buildUnavailableResult(message: string): OnlineLicenseActivationResult {
  return {
    status: "unavailable",
    expiresAt: null,
    provider: "lemonSqueezy",
    message
  };
}

export class LemonSqueezyLicenseClient implements OnlineLicenseActivationClient {
  private readonly activationEndpoint: string;
  private readonly validationEndpoint: string;
  private readonly deactivationEndpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly pathfinderVariantIds: readonly string[];

  constructor(options: LemonSqueezyLicenseClientOptions = {}) {
    this.activationEndpoint = options.activationEndpoint ?? defaultActivationEndpoint;
    this.validationEndpoint = options.validationEndpoint ?? defaultValidationEndpoint;
    this.deactivationEndpoint = options.deactivationEndpoint ?? defaultDeactivationEndpoint;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? defaultActivationTimeoutMs;
    this.pathfinderVariantIds = [...new Set((options.pathfinderVariantIds ?? []).map((value) => value.trim()).filter(Boolean))];
  }

  async activateLicense(licenseKey: string, instanceName: string): Promise<OnlineLicenseActivationResult> {
    const trimmedLicenseKey = licenseKey.trim();

    if (trimmedLicenseKey.length === 0) {
      return {
        status: "invalid",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: "DVQR Pro activation key was empty. DVQR has continued in Free mode."
      };
    }

    const form = new URLSearchParams();
    form.set("license_key", trimmedLicenseKey);
    form.set("instance_name", instanceName);

    const payload = await this.postForm(this.activationEndpoint, form);

    if (payload.kind === "unavailable") {
      return buildUnavailableResult(payload.message);
    }

    if (!isRecord(payload.body)) {
      return {
        status: "invalid",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: "Online activation response was not valid. DVQR has continued in Free mode."
      };
    }

    const activationResponse = payload.body as LemonSqueezyActivateLicenseResponse;
    const activationError = normalizeString(activationResponse.error);

    if (!payload.ok || activationResponse.activated !== true) {
      return {
        status: payload.ok ? "invalid" : "unavailable",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: normalizeOnlineActivationFailureMessage(activationError, "DVQR Pro activation failed. Please verify your activation key and try again.")
      };
    }

    return this.mapSuccessfulLicensePayload(activationResponse.license_key, activationResponse.instance, activationResponse.meta, activationResponse, "DVQR Pro activated. Pro capabilities are now available locally.");
  }

  async validateLicense(licenseKey: string, instanceId?: string): Promise<OnlineLicenseActivationResult> {
    const trimmedLicenseKey = licenseKey.trim();

    if (trimmedLicenseKey.length === 0) {
      return {
        status: "invalid",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: "Stored DVQR Pro activation key was empty. DVQR has continued in Free mode."
      };
    }

    const form = new URLSearchParams();
    form.set("license_key", trimmedLicenseKey);

    if (instanceId !== undefined && instanceId.trim().length > 0) {
      form.set("instance_id", instanceId.trim());
    }

    const payload = await this.postForm(this.validationEndpoint, form);

    if (payload.kind === "unavailable") {
      return buildUnavailableResult("Online Pro verification is temporarily unavailable. DVQR continues using the last verified entitlement where possible.");
    }

    if (!isRecord(payload.body)) {
      return {
        status: "invalid",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: "Online verification response was not valid. DVQR has continued in Free mode."
      };
    }

    const validationResponse = payload.body as LemonSqueezyValidateLicenseResponse;
    const validationError = normalizeString(validationResponse.error);

    if (!payload.ok || validationResponse.valid !== true) {
      return {
        status: payload.ok ? "invalid" : "unavailable",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: normalizeOnlineVerificationFailureMessage(validationError, "DVQR Pro could not be verified. DVQR has continued using available local entitlement state.")
      };
    }

    return this.mapSuccessfulLicensePayload(validationResponse.license_key, validationResponse.instance, validationResponse.meta, validationResponse, "DVQR Pro verified. Pro capabilities remain available locally.");
  }

  async deactivateLicense(licenseKey: string, instanceId: string): Promise<OnlineLicenseDeactivationResult> {
    const trimmedLicenseKey = licenseKey.trim();
    const trimmedInstanceId = instanceId.trim();

    if (trimmedLicenseKey.length === 0 || trimmedInstanceId.length === 0) {
      return {
        deactivated: false,
        status: "invalid",
        message: "DVQR Pro deactivation requires local activation details."
      };
    }

    const form = new URLSearchParams();
    form.set("license_key", trimmedLicenseKey);
    form.set("instance_id", trimmedInstanceId);

    const payload = await this.postForm(this.deactivationEndpoint, form);

    if (payload.kind === "unavailable") {
      return {
        deactivated: false,
        status: "unavailable",
        message: "Online Pro deactivation is temporarily unavailable. DVQR has not changed the local entitlement."
      };
    }

    if (!isRecord(payload.body)) {
      return {
        deactivated: false,
        status: "invalid",
        message: "Online deactivation response was not valid. DVQR has not changed the local entitlement."
      };
    }

    const deactivationResponse = payload.body as LemonSqueezyDeactivateLicenseResponse;
    const deactivationError = normalizeString(deactivationResponse.error);

    if (!payload.ok || deactivationResponse.deactivated !== true) {
      return {
        deactivated: false,
        status: payload.ok ? "invalid" : "unavailable",
        message: normalizeOnlineDeactivationFailureMessage(deactivationError, "DVQR Pro deactivation could not be completed online. DVQR has not changed the local entitlement.")
      };
    }

    return {
      deactivated: true,
      status: "valid",
      message: "DVQR Pro deactivated for this machine. DVQR has continued in Free mode."
    };
  }

  private async postForm(endpoint: string, form: URLSearchParams): Promise<{ kind: "ok"; ok: boolean; body: unknown } | { kind: "unavailable"; message: string }> {
    let response: Response;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      };


      response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: form.toString(),
        signal: abortController.signal
      });
    } catch {
      return {
        kind: "unavailable",
        message: "Online licensing service was unavailable. DVQR has continued using available local entitlement state."
      };
    } finally {
      clearTimeout(timeout);
    }

    try {
      return {
        kind: "ok",
        ok: response.ok,
        body: await response.json()
      };
    } catch {
      return {
        kind: "unavailable",
        message: "Online licensing response was not readable. DVQR has continued using available local entitlement state."
      };
    }
  }

  private mapSuccessfulLicensePayload(
    rawLicenseKey: unknown,
    rawInstance: unknown,
    meta: Record<string, unknown> | null | undefined,
    responseBody: unknown,
    successMessage: string
  ): OnlineLicenseActivationResult {
    const licenseKeyPayload = isRecord(rawLicenseKey) ? rawLicenseKey as LemonSqueezyLicenseKeyPayload : undefined;
    const instancePayload = isRecord(rawInstance) ? rawInstance as LemonSqueezyLicenseInstancePayload : undefined;
    const licenseStatus = mapLicenseStatus(normalizeString(licenseKeyPayload?.status));
    const expiresAt = normalizeDate(licenseKeyPayload?.expires_at);

    if (expiresAt === undefined) {
      return {
        status: "invalid",
        expiresAt: null,
        provider: "lemonSqueezy",
        message: "DVQR Pro activation expiry could not be interpreted. DVQR has continued in Free mode."
      };
    }

    const providerProductId = readProviderProductId(meta, responseBody);
    const providerProductName = readProviderProductName(meta, responseBody);
    const providerVariantId = readProviderVariantId(meta, responseBody);
    const supporterTags = buildSupporterTagsForVariant(providerVariantId, this.pathfinderVariantIds);

    if (!isAllowedDvqrProduct(providerProductId, providerProductName)) {
      return {
        status: "invalid",
        expiresAt: null,
        provider: "lemonSqueezy",
        providerLicenseId: normalizeId(licenseKeyPayload?.id),
        providerInstanceId: normalizeString(instancePayload?.id),
        providerProductId,
        providerVariantId,
        customerName: readMetaString(meta, "customer_name"),
        customerEmail: readMetaString(meta, "customer_email"),
        message: "This activation key is not for DV Quick Run Pro. DVQR has continued in Free mode."
      };
    }

    if (licenseStatus !== "valid") {
      return {
        status: licenseStatus,
        expiresAt: expiresAt ?? null,
        provider: "lemonSqueezy",
        providerLicenseId: normalizeId(licenseKeyPayload?.id),
        providerInstanceId: normalizeString(instancePayload?.id),
        providerProductId,
        providerVariantId,
        customerName: readMetaString(meta, "customer_name"),
        customerEmail: readMetaString(meta, "customer_email"),
        supporterTags,
        message: licenseStatus === "expired"
          ? "DVQR Pro activation has expired. DVQR has continued in Free mode."
          : "DVQR Pro activation is not active. DVQR has continued in Free mode."
      };
    }

    return {
      status: "valid",
      expiresAt: expiresAt ?? null,
      provider: "lemonSqueezy",
      providerLicenseId: normalizeId(licenseKeyPayload?.id),
      providerInstanceId: normalizeString(instancePayload?.id),
      providerProductId,
      providerVariantId,
      customerName: readMetaString(meta, "customer_name"),
      customerEmail: readMetaString(meta, "customer_email"),
      supporterTags,
      message: successMessage
    };
  }
}
