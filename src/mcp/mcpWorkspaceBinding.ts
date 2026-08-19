import * as path from "path";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export interface McpWorkspaceBindingAvailable {
  readonly available: true;
  readonly workspaceRoot: string;
  readonly businessPathDirectory: string;
  readonly source: "DVQR_MCP_WORKSPACE_ROOT";
}

export interface McpWorkspaceBindingUnavailable {
  readonly available: false;
  readonly source: "Unavailable";
  readonly reason: string;
}

export type McpWorkspaceBinding =
  | McpWorkspaceBindingAvailable
  | McpWorkspaceBindingUnavailable;

export function resolveMcpWorkspaceBinding(
  config: Pick<DvqrMcpRuntimeConfiguration, "workspaceRoot">
): McpWorkspaceBinding {
  const configured = config.workspaceRoot?.trim();
  if (!configured) {
    return {
      available: false,
      source: "Unavailable",
      reason: "Managed Business Paths require an explicit VS Code workspace root. DVQR_MCP_WORKSPACE_ROOT was not supplied by the MCP host."
    };
  }

  const workspaceRoot = path.resolve(configured);
  return {
    available: true,
    workspaceRoot,
    businessPathDirectory: path.join(workspaceRoot, ".dvforgelab", "dvqr", "business-paths"),
    source: "DVQR_MCP_WORKSPACE_ROOT"
  };
}

export function requireMcpWorkspaceBinding(
  config: Pick<DvqrMcpRuntimeConfiguration, "workspaceRoot">
): McpWorkspaceBindingAvailable {
  const binding = resolveMcpWorkspaceBinding(config);
  if (!binding.available) {
    throw new Error(binding.reason);
  }
  return binding;
}
