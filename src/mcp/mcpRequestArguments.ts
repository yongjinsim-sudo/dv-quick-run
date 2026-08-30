import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export function stringArg(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEnvironmentAuthority(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function environmentUrl(
  args: Record<string, unknown>,
  config: DvqrMcpRuntimeConfiguration
): string | undefined {
  const configured = config.environmentUrl?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return stringArg(args, "environmentUrl")?.replace(/\/+$/, "");
}

export function validateEnvironmentAuthority(
  args: Record<string, unknown>,
  config: DvqrMcpRuntimeConfiguration
): { readonly ok: true } | {
  readonly ok: false;
  readonly code: "EnvironmentAuthorityMismatch";
  readonly message: string;
} {
  const configured = normalizeEnvironmentAuthority(config.environmentUrl);
  const supplied = normalizeEnvironmentAuthority(stringArg(args, "environmentUrl"));
  if (configured && supplied && supplied !== configured) {
    return {
      ok: false,
      code: "EnvironmentAuthorityMismatch",
      message: "environmentUrl cannot override the active canonical MCP environment."
    };
  }
  return { ok: true };
}

export function validateEnvironmentUrl(
  args: Record<string, unknown>,
  config: DvqrMcpRuntimeConfiguration
): { readonly ok: true; readonly environmentUrl: string } | {
  readonly ok: false;
  readonly code: "EnvironmentRequired" | "InvalidArguments";
  readonly message: string;
} {
  const supplied = stringArg(args, "environmentUrl")?.replace(/\/+$/, "");
  if (supplied && !/^https:\/\//i.test(supplied)) {
    return {
      ok: false,
      code: "InvalidArguments",
      message: "environmentUrl must use HTTPS."
    };
  }
  const authority = validateEnvironmentAuthority(args, config);
  if (!authority.ok) {
    return { ok: false, code: "InvalidArguments", message: authority.message };
  }
  const baseEnvironmentUrl = environmentUrl(args, config);
  if (!baseEnvironmentUrl) {
    return {
      ok: false,
      code: "EnvironmentRequired",
      message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call."
    };
  }
  return { ok: true, environmentUrl: baseEnvironmentUrl };
}
