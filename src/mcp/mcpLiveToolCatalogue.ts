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
  {
    name: "dvqr_discover_operational_anchors",
    title: "Understand Business Capabilities",
    description: "Discover business capabilities, rank operational anchors, separate governance, scheduling, coordination and execution roles, and identify downstream work-item evidence from bounded Dataverse metadata. Does not claim runtime data exists.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable"],
      properties: {
        sourceTable: { type: "string", description: "Logical name of the investigation source table, such as contact or account." },
        maxDepth: { type: "integer", minimum: 1, maximum: 5, default: 3 },
        maxResults: { type: "integer", minimum: 1, maximum: 20, default: 8 },
        maxTablesInspected: { type: "integer", minimum: 10, maximum: 100, default: 60 },
        environmentUrl: { type: "string" }
      }
    }
  },
  {
    name: "dvqr_resolve_navigation_property",
    title: "Resolve Navigation Property",
    description: "Resolve exact Dataverse navigation properties and lookup value fields between verified source and target tables. Never generate a query from an unresolved or guessed navigation name; use only metadata-verified matches.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "targetTable"],
      properties: {
        sourceTable: { type: "string" }, targetTable: { type: "string" }, guessedProperty: { type: "string" },
        environmentUrl: { type: "string" }
      }
    }
  },
  {
    name: "dvqr_find_relationship_paths",
    title: "Find Relationship Paths",
    description: "Discover and deterministically rank bounded Dataverse relationship paths using verified metadata. Does not claim that paths contain business data.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "targetTable"],
      properties: {
        sourceTable: { type: "string" }, targetTable: { type: "string" }, relationshipHint: { type: "string", description: "Optional exact lookup logical name, navigation property, or relationship schema name that the selected path must honour." },
        maxDepth: { type: "integer", minimum: 1, maximum: 6, default: 4 },
        maxPaths: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        environmentUrl: { type: "string" }
      }
    }
  },
  {
    name: "dvqr_generate_relationship_query",
    title: "Generate Relationship Query",
    description: "Generate bounded OData query templates only from a metadata-verified relationship path. Prefer relationshipHint when the user names a lookup, navigation property, or relationship schema. Use pathId only when copied exactly from dvqr_find_relationship_paths; never construct or guess a pathId. If an exact hint cannot be verified, return no query and never substitute or invent a placeholder navigation.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "targetTable"],
      properties: {
        sourceTable: { type: "string" }, targetTable: { type: "string" }, pathId: { type: "string", description: "Optional opaque path identifier copied exactly from dvqr_find_relationship_paths. Do not construct or guess this value. When the user names a relationship, use relationshipHint instead." }, relationshipHint: { type: "string", description: "Preferred when the user names a lookup logical name, navigation property, or relationship schema. The selected path must honour this exact intent." }, sourceRecordId: { type: "string" },
        maxDepth: { type: "integer", minimum: 1, maximum: 6, default: 4 },
        maxRecordsPerStep: { type: "integer", minimum: 1, maximum: 20, default: 5 },
        environmentUrl: { type: "string" }
      }
    }
  },
  {
    name: "dvqr_probe_relationship_path",
    title: "Probe Relationship Path",
    description: "Explicitly execute bounded, read-only evidence-guided traversal for one source record. Without pathId or relationshipHint, DVQR probes diverse metadata path families, optionally expands generic target concepts such as task to related custom tables, and returns separate metadata and runtime-observed recommendations.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "targetTable", "sourceRecordId"],
      properties: {
        sourceTable: { type: "string" }, targetTable: { type: "string" }, sourceRecordId: { type: "string" }, pathId: { type: "string" }, relationshipHint: { type: "string", description: "Optional exact lookup logical name, navigation property, or relationship schema name that the selected path must honour." },
        maxDepth: { type: "integer", minimum: 1, maximum: 6, default: 4 },
        maxRecordsPerStep: { type: "integer", minimum: 1, maximum: 10, default: 3 },
        maxProbeRequests: { type: "integer", minimum: 1, maximum: 20, default: 8, description: "Maximum Dataverse GET requests across all candidate paths." },
        maxFamilies: { type: "integer", minimum: 1, maximum: 8, default: 4, description: "Maximum materially different relationship families to consider." },
        maxCandidatePaths: { type: "integer", minimum: 1, maximum: 12, default: 6 },
        expandTargetConcept: { type: "boolean", description: "When true, deterministically include related target tables. Defaults to true for generic task/tasks targets and false otherwise." },
        environmentUrl: { type: "string" }
      }
    }
  },
  {
    name: "dvqr_explain_lookup",
    title: "Explain Dataverse Lookup",
    description: "Explain a standard or polymorphic lookup using exact attribute targets, target-qualified navigation properties, value property and runtime annotations.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "lookup"],
      properties: { sourceTable: { type: "string" }, lookup: { type: "string" }, environmentUrl: { type: "string" } }
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
