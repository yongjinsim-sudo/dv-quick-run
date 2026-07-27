import type { DvqrMcpToolDefinitionV1 } from "./mcpContracts.js";

export const DVQR_MCP_TOOL_NAMES = {
  assessInvestigationReadiness: "dvqr.assessInvestigationReadiness",
  retrieveInvestigationGaps: "dvqr.retrieveInvestigationGaps",
  retrieveContributorAvailability: "dvqr.retrieveContributorAvailability",
  retrieveEvidenceRecommendations: "dvqr.retrieveEvidenceRecommendations"
} as const;

export type DvqrMcpToolName = typeof DVQR_MCP_TOOL_NAMES[keyof typeof DVQR_MCP_TOOL_NAMES];

const readinessRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request"],
  properties: {
    request: {
      type: "object",
      description: "Canonical investigation-readiness-request-v1 payload."
    }
  }
} as const;

export const DVQR_MCP_TOOL_CATALOGUE: readonly DvqrMcpToolDefinitionV1[] = [
  {
    name: DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness,
    title: "Assess Investigation Readiness",
    description: "Assess how responsibly DVQR can interpret the supplied canonical investigation evidence. This tool is deterministic, read-only, and acquires no evidence.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "investigation-readiness-v1 | investigation-readiness-error-v1"
  },
  {
    name: DVQR_MCP_TOOL_NAMES.retrieveInvestigationGaps,
    title: "Retrieve Investigation Gaps",
    description: "Assess the supplied canonical investigation evidence and return the canonical evidence-gap collection without renaming, reranking, or reinterpretation.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "InvestigationGapV1[] | investigation-readiness-error-v1"
  },
  {
    name: DVQR_MCP_TOOL_NAMES.retrieveContributorAvailability,
    title: "Retrieve Contributor Availability",
    description: "Assess the supplied canonical investigation evidence and return canonical contributor readiness states without semantic transformation.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "ContributorReadinessV1[] | investigation-readiness-error-v1"
  },
  {
    name: DVQR_MCP_TOOL_NAMES.retrieveEvidenceRecommendations,
    title: "Retrieve Evidence Recommendations",
    description: "Assess the supplied canonical investigation evidence and return bounded evidence-acquisition recommendations. Recommendations remain advisory and human-authorised.",
    readOnly: true,
    inputSchema: readinessRequestSchema,
    outputContract: "EvidenceRecommendationV1[] | investigation-readiness-error-v1"
  }
];
