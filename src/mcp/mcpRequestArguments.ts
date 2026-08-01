import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export function stringArg(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function environmentUrl(
  args: Record<string, unknown>,
  config: DvqrMcpRuntimeConfiguration
): string | undefined {
  return stringArg(args, "environmentUrl")?.replace(/\/+$/, "") ?? config.environmentUrl;
}

export function validateEnvironmentUrl(
  args: Record<string, unknown>,
  config: DvqrMcpRuntimeConfiguration
): { readonly ok: true; readonly environmentUrl: string } | {
  readonly ok: false;
  readonly code: "EnvironmentRequired" | "InvalidArguments";
  readonly message: string;
} {
  const baseEnvironmentUrl = environmentUrl(args, config);
  if (!baseEnvironmentUrl) {
    return {
      ok: false,
      code: "EnvironmentRequired",
      message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call."
    };
  }
  if (!/^https:\/\//i.test(baseEnvironmentUrl)) {
    return {
      ok: false,
      code: "InvalidArguments",
      message: "environmentUrl must use HTTPS."
    };
  }
  return { ok: true, environmentUrl: baseEnvironmentUrl };
}
