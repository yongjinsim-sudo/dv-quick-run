import {
  investigationReadinessSemanticOperations,
  type InvestigationReadinessRequestV1,
  type InvestigationReadinessResponseV1,
  type ReadonlyJsonObject
} from "../core/readiness/index.js";
import {
  DVQR_MCP_CONTRACT_VERSION,
  type DvqrMcpErrorV1,
  type DvqrMcpToolResultV1
} from "./mcpContracts.js";
import { DVQR_MCP_TOOL_NAMES, type DvqrMcpToolName } from "./mcpToolCatalogue.js";

export interface DvqrMcpReadinessOperations {
  assessInvestigationReadiness(request: InvestigationReadinessRequestV1): InvestigationReadinessResponseV1;
  retrieveInvestigationGaps(response: InvestigationReadinessResponseV1): unknown;
  retrieveContributorAvailability(response: InvestigationReadinessResponseV1): unknown;
  retrieveEvidenceRecommendations(response: InvestigationReadinessResponseV1): unknown;
}

function error(code: DvqrMcpErrorV1["code"], message: string, limitations: readonly string[] = []): DvqrMcpErrorV1 {
  return {
    contractVersion: DVQR_MCP_CONTRACT_VERSION,
    code,
    message,
    retryable: false,
    limitations: [...limitations]
  };
}

function isObject(value: unknown): value is ReadonlyJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestFromArguments(argumentsValue: ReadonlyJsonObject | undefined): InvestigationReadinessRequestV1 | DvqrMcpErrorV1 {
  if (!argumentsValue || !isObject(argumentsValue.request)) {
    return error(
      "InvalidArguments",
      "A canonical readiness request is required at arguments.request.",
      ["No investigation assessment was performed."]
    );
  }
  return argumentsValue.request as unknown as InvestigationReadinessRequestV1;
}

export class DvqrMcpApplicationAdapter {
  public constructor(
    private readonly operations: DvqrMcpReadinessOperations = investigationReadinessSemanticOperations
  ) {}

  public call(toolName: DvqrMcpToolName, argumentsValue?: ReadonlyJsonObject): DvqrMcpToolResultV1 {
    const request = requestFromArguments(argumentsValue);
    if ("retryable" in request) {
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: false,
        toolName,
        error: request
      };
    }

    try {
      const response = this.operations.assessInvestigationReadiness(request);
      const structuredContent = this.project(toolName, response);
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: true,
        toolName,
        structuredContent: structuredContent as never
      };
    } catch {
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: false,
        toolName,
        error: error(
          "InternalError",
          "DVQR could not complete the read-only semantic operation.",
          ["No evidence was acquired or modified."]
        )
      };
    }
  }

  private project(toolName: DvqrMcpToolName, response: InvestigationReadinessResponseV1): unknown {
    switch (toolName) {
      case DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness:
        return response;
      case DVQR_MCP_TOOL_NAMES.retrieveInvestigationGaps:
        return this.operations.retrieveInvestigationGaps(response);
      case DVQR_MCP_TOOL_NAMES.retrieveContributorAvailability:
        return this.operations.retrieveContributorAvailability(response);
      case DVQR_MCP_TOOL_NAMES.retrieveEvidenceRecommendations:
        return this.operations.retrieveEvidenceRecommendations(response);
    }
  }
}
