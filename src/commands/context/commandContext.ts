import * as vscode from "vscode";
import { getBaseUrl, getTenantId } from "../../utils/config.js";
import { getDataverseAccessToken } from "../../auth/azureCliAuth.js";
import { DataverseClient } from "../../services/dataverseClient.js";

export type CommandContext = {
  ext: vscode.ExtensionContext;
  output: vscode.OutputChannel;

  // Normalized config
  getBaseUrl(): Promise<string>;
  getScope(baseUrl: string): string;

  // Auth + client
  getToken(scope: string): Promise<string>;
  getClient(baseUrl: string): DataverseClient;
};

function deriveScopeFromBaseUrl(baseUrl: string): string {
  // baseUrl: https://orgxxxx.api.crm6.dynamics.com/api/data/v9.2
  // scope  : https://orgxxxx.api.crm6.dynamics.com/.default
  const m = baseUrl.match(/^(https:\/\/[^/]+)\//i);
  if (!m) {throw new Error(`Cannot derive scope from baseUrl: ${baseUrl}`);}
  return `${m[1]}/.default`;
}

export function createCommandContext(ext: vscode.ExtensionContext): CommandContext {
  const output = vscode.window.createOutputChannel("DV Quick Run");

  return {
    ext,
    output,

    async getBaseUrl(): Promise<string> {
      // Keep your existing behavior: prompt and persist if missing
      const baseUrl = (await getBaseUrl()).replace(/\/+$/, "");
      return baseUrl;
    },

    getScope(baseUrl: string): string {
      return deriveScopeFromBaseUrl(baseUrl);
    },

    async getToken(scope: string): Promise<string> {
      // Keep tenantId behavior
      return await getDataverseAccessToken(scope, getTenantId());
    },

    getClient(baseUrl: string): DataverseClient {
      return new DataverseClient(baseUrl);
    }
  };
}