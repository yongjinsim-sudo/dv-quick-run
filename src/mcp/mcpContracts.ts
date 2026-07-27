import type { JsonValue, ReadonlyJsonObject } from "../core/readiness/readinessContracts.js";

export const DVQR_MCP_CONTRACT_VERSION = "dvqr-mcp-foundation-v1" as const;

export type DvqrMcpErrorCode =
  | "ToolNotFound"
  | "InvalidArguments"
  | "CapabilityUnavailable"
  | "ApplicationError"
  | "InternalError";

export interface DvqrMcpErrorV1 {
  readonly contractVersion: typeof DVQR_MCP_CONTRACT_VERSION;
  readonly code: DvqrMcpErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly limitations: readonly string[];
}

export interface DvqrMcpToolDefinitionV1 {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly readOnly: true;
  readonly inputSchema: ReadonlyJsonObject;
  readonly outputContract: string;
}

export interface DvqrMcpToolCallV1 {
  readonly name: string;
  readonly arguments?: ReadonlyJsonObject;
}

export interface DvqrMcpToolSuccessV1 {
  readonly contractVersion: typeof DVQR_MCP_CONTRACT_VERSION;
  readonly ok: true;
  readonly toolName: string;
  readonly structuredContent: JsonValue;
}

export interface DvqrMcpToolFailureV1 {
  readonly contractVersion: typeof DVQR_MCP_CONTRACT_VERSION;
  readonly ok: false;
  readonly toolName: string;
  readonly error: DvqrMcpErrorV1;
}

export type DvqrMcpToolResultV1 = DvqrMcpToolSuccessV1 | DvqrMcpToolFailureV1;

export interface DvqrMcpCapabilityManifestV1 {
  readonly contractVersion: typeof DVQR_MCP_CONTRACT_VERSION;
  readonly product: "DV Quick Run";
  readonly releaseVersion: string;
  readonly mode: "local-read-only-foundation";
  readonly transport: "unbound";
  readonly mutationAuthority: "none";
  readonly evidenceAcquisition: "none";
  readonly tools: readonly DvqrMcpToolDefinitionV1[];
  readonly limitations: readonly string[];
}
