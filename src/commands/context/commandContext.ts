import * as vscode from "vscode";
import { getTenantId } from "../../utils/config.js";
import { getDataverseAccessToken } from "../../auth/azureCliAuth.js";
import { DataverseClient } from "../../services/dataverseClient.js";
import { EnvironmentContext } from "../../services/environmentContext.js";



export type CommandContext = {
  ext: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  envContext: EnvironmentContext;

  // Environment-driven config
  getBaseUrl(): Promise<string>;
  getScope(): string;

  // Auth + client
  getToken(scope: string): Promise<string>;
  getClient(): DataverseClient;
};

export function createCommandContext(
  ext: vscode.ExtensionContext,
  envContext: EnvironmentContext
): CommandContext {
  const output = vscode.window.createOutputChannel("DV Quick Run");

  return {
    ext,
    output,
    envContext,

    async getBaseUrl(): Promise<string> {
      return envContext.getBaseUrl().replace(/\/+$/, "");
    },

    getScope(): string {
      return envContext.getScope();
    },

    async getToken(scope: string): Promise<string> {
      return await getDataverseAccessToken(scope, getTenantId());
    },

    getClient(): DataverseClient {
      return new DataverseClient(envContext.getBaseUrl().replace(/\/+$/, ""));
    }
  };
}
