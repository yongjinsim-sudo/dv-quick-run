export interface DvqrLiveMcpToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly tier: "free" | "pro";
  readonly inputSchema: Record<string, unknown>;
}

const querySchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", description: "OData query path such as accounts?$select=name&$top=5." }
  }
};

const readinessSchema = {
  type: "object",
  additionalProperties: false,
  required: ["request"],
  properties: { request: { type: "object", description: "Canonical investigation-readiness-request-v1 payload." } }
};

export const DVQR_LIVE_MCP_TOOLS: readonly DvqrLiveMcpToolDefinition[] = [
  {
    name: "dvqr_list_capabilities",
    title: "List DVQR MCP Capabilities",
    description: "List implemented Free and Pro DVQR MCP capabilities and their authority boundaries.",
    tier: "free",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  },
  {
    name: "dvqr_explain_odata",
    title: "Explain OData Query",
    description: "Parse and explain a Dataverse OData query without executing it.",
    tier: "free",
    inputSchema: querySchema
  },
  {
    name: "dvqr_execute_odata",
    title: "Execute Read-only OData",
    description: "Execute one read-only Dataverse OData GET using Azure CLI authentication. No mutation methods are available.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: querySchema.properties.query,
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." },
        maxRecords: { type: "integer", minimum: 1, maximum: 500, default: 100 }
      }
    }
  },
  {
    name: "dvqr_search_metadata",
    title: "Search Dataverse Metadata",
    description: "Deterministically search and rank Dataverse tables by logical name, schema name, display name, description and explicit Dataverse concept aliases. Use this instead of inventing EntityDefinitions filters.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Natural-language metadata search such as employee, customer, security, appointment or revenue." },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." },
        maxResults: { type: "integer", minimum: 1, maximum: 50, default: 10 }
      }
    }
  },
  {
    name: "dvqr_get_entity_metadata",
    title: "Get Entity Metadata",
    description: "Retrieve bounded, read-only Dataverse entity definition metadata.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["logicalName"],
      properties: {
        logicalName: { type: "string" },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  ...[
    ["dvqr_assess_investigation_readiness", "Assess Investigation Readiness", "dvqr.assessInvestigationReadiness"],
    ["dvqr_get_investigation_gaps", "Get Investigation Gaps", "dvqr.retrieveInvestigationGaps"],
    ["dvqr_get_contributor_availability", "Get Contributor Availability", "dvqr.retrieveContributorAvailability"],
    ["dvqr_get_evidence_recommendations", "Get Evidence Recommendations", "dvqr.retrieveEvidenceRecommendations"]
  ].map(([name, title]) => ({
    name,
    title,
    description: `${title} using the existing deterministic DVQR readiness application service. Pro capability.`,
    tier: "pro" as const,
    inputSchema: readinessSchema
  }))
];

export const DVQR_PUBLIC_TO_INTERNAL_TOOL = new Map<string, string>([
  ["dvqr_assess_investigation_readiness", "dvqr.assessInvestigationReadiness"],
  ["dvqr_get_investigation_gaps", "dvqr.retrieveInvestigationGaps"],
  ["dvqr_get_contributor_availability", "dvqr.retrieveContributorAvailability"],
  ["dvqr_get_evidence_recommendations", "dvqr.retrieveEvidenceRecommendations"]
]);
