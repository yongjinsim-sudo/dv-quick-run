export interface DvqrMcpRuntimeConfiguration {
  readonly environmentUrl?: string;
  readonly tenantId?: string;
  readonly proEnabled: boolean;
  readonly requestTimeoutMs: number;
}

function normalizeEnvironmentUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return undefined;
  }
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error("DVQR_MCP_ENVIRONMENT_URL must be an HTTPS Dataverse environment URL.");
  }
  return trimmed;
}

export function loadDvqrMcpRuntimeConfiguration(env: NodeJS.ProcessEnv = process.env): DvqrMcpRuntimeConfiguration {
  const timeout = Number(env.DVQR_MCP_REQUEST_TIMEOUT_MS ?? "30000");
  return {
    environmentUrl: normalizeEnvironmentUrl(env.DVQR_MCP_ENVIRONMENT_URL),
    tenantId: env.DVQR_MCP_TENANT_ID?.trim() || undefined,
    proEnabled: env.DVQR_MCP_PRO_ENABLED?.trim().toLowerCase() === "true",
    requestTimeoutMs: Number.isFinite(timeout) && timeout >= 1000 ? timeout : 30000
  };
}
