export type DvqrLiveMcpFreeHandlerId =
  | "listCapabilities"
  | "explainOData"
  | "executeOData"
  | "searchMetadata"
  | "getEntityMetadata"
  | "discoverCustomApis"
  | "getCustomApiDefinition"
  | "explainCustomApi"
  | "compareCustomApis"
  | "recommendCustomApis"
  | "recommendSolutionArchitecture"
  | "checkCustomApiExecution"
  | "previewCustomApiExecution"
  | "executeCustomApi"
  | "interpretCustomApiExecution"
  | "discoverOperationalAnchors"
  | "resolveNavigationProperty"
  | "findRelationshipPaths"
  | "generateRelationshipQuery"
  | "probeRelationshipPath"
  | "explainLookup";

export type DvqrLiveMcpToolHandler =
  | { readonly kind: "free"; readonly id: DvqrLiveMcpFreeHandlerId }
  | { readonly kind: "pro"; readonly internalName: string };

export interface DvqrLiveMcpToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly tier: "free" | "pro";
  readonly inputSchema: Record<string, unknown>;
  readonly handler: DvqrLiveMcpToolHandler;
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
    handler: { kind: "free", id: "listCapabilities" },
    title: "List DVQR MCP Capabilities",
    description: "List implemented Free and Pro DVQR MCP capabilities and their authority boundaries.",
    tier: "free",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  },
  {
    name: "dvqr_explain_odata",
    handler: { kind: "free", id: "explainOData" },
    title: "Explain OData Query",
    description: "Parse and explain a Dataverse OData query without executing it.",
    tier: "free",
    inputSchema: querySchema
  },
  {
    name: "dvqr_execute_odata",
    handler: { kind: "free", id: "executeOData" },
    title: "Execute Read-only OData",
    description: "Execute one read-only Dataverse OData GET using Azure CLI authentication. Do NOT use this tool to invoke Dataverse Actions, Functions or Custom APIs, and do not pass a Custom API route here. For Custom APIs, use dvqr_preview_custom_api_execution followed only by dvqr_execute_custom_api after explicit confirmation. No mutation methods are available.",
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
    handler: { kind: "free", id: "searchMetadata" },
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
    handler: { kind: "free", id: "getEntityMetadata" },
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
    name: "dvqr_discover_custom_apis",
    handler: { kind: "free", id: "discoverCustomApis" },
    title: "Discover Custom APIs",
    description: "List or search Dataverse Custom APIs. Use this for inventory questions such as 'Which Custom APIs are available?' Prefer it over raw customapis OData queries, saved result files, terminal processing or manual paging. Pass query as an empty string to list all public Actions and Functions; omit the other filters to include every operation and binding kind. Results are compact and directly answerable; use continuationToken for another page. Do not use this tool for one named API: use dvqr_explain_custom_api for what-it-does or usage questions, and dvqr_get_custom_api_definition for exact metadata questions.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Text filter across unique name, display name, description and bound table. Use an empty string to list all matching public Custom APIs." },
        operationKind: { type: "string", enum: ["Action", "Function"] },
        bindingKind: { type: "string", enum: ["Global", "Entity", "EntityCollection"], description: "Optional binding filter. Omit to include all binding kinds." },
        includePrivate: { type: "boolean", default: false },
        maxResults: { type: "integer", minimum: 1, maximum: 200, default: 50 },
        detailLevel: { type: "string", enum: ["names", "summary"], default: "names", description: "names returns the smallest directly answerable inventory projection. summary also includes display name and description." },
        continuationToken: { type: "string", description: "Opaque token returned by the previous discovery page. Reuse the same filters when continuing." },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  {
    name: "dvqr_explain_custom_api",
    handler: { kind: "free", id: "explainCustomApi" },
    title: "Explain What a Custom API Does",
    description: "Explain what exactly one named Dataverse Custom API does and how to understand or use it. ALWAYS choose this tool when the user says explain, what does it do, why use it, when should I use it, should I use it, help me understand it, or asks for practical meaning. Trigger examples: 'Explain AIReply', 'What does AIReply do?', 'When should I use AISummarize?' and 'Help me understand this Custom API'. Do not use dvqr_get_custom_api_definition for those explanation or usage-intent prompts. This deterministic view separates metadata facts from interpretation, explains Action/Function and binding semantics, describes inputs and outputs, presents a metadata-derived HTTP shape and states the execution safety boundary. It does not validate or execute the operation.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["uniqueName"],
      properties: {
        uniqueName: { type: "string", description: "Exact Custom API unique name whose purpose and practical meaning should be explained." },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  {
    name: "dvqr_compare_custom_apis",
    handler: { kind: "free", id: "compareCustomApis" },
    title: "Compare Custom APIs",
    description: "Compare 2 to 10 exact Dataverse Custom API unique names using one metadata snapshot. ALWAYS choose this tool for prompts such as 'Compare AIReply vs AISummarize', 'What is the difference between these Custom APIs?' or 'Which of these named APIs fits better?'. Returns aligned purpose, operation, binding, input, output, best-fit and unsuitable-use dimensions. Do not make several dvqr_explain_custom_api calls and compare them manually. This is deterministic guidance and does not validate execution.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["uniqueNames"],
      properties: {
        uniqueNames: { type: "array", minItems: 2, maxItems: 10, uniqueItems: true, items: { type: "string" }, description: "Two to ten exact Custom API unique names to compare." },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  {
    name: "dvqr_recommend_custom_apis",
    handler: { kind: "free", id: "recommendCustomApis" },
    title: "Recommend Custom APIs for a Goal",
    description: "Return a ranked capability shortlist of individual public Dataverse Custom APIs for a natural-language goal. ALWAYS choose this tool only when the user asks which API or APIs fit a capability, without asking for an architecture or ordered workflow. Examples: 'I need to translate customer emails', 'Which API should I use to draft replies?' and 'Which individual APIs support customer service?'. DO NOT use this tool when the user asks to design, architect, assemble, sequence, improve, review or compare an end-to-end solution, workflow, pipeline, stage order or multi-API architecture; call dvqr_recommend_solution_architecture instead. Returns deterministic ranked matches, confidence, score evidence, exclusion handling and workflow roles from one metadata snapshot. It suppresses weak lexical matches, honours explicit exclusions in the goal, and may return no strong fit rather than guessing. Do not repeatedly call discovery or explain tools to assemble recommendations manually. Does not validate or execute operations.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["goal"],
      properties: {
        goal: { type: "string", description: "Natural-language goal, task or solution capability to match against public Custom API metadata." },
        maxResults: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  {
    name: "dvqr_recommend_solution_architecture",
    handler: { kind: "free", id: "recommendSolutionArchitecture" },
    title: "Recommend a Custom API Solution Architecture",
    description: "Design a metadata-backed end-to-end solution pipeline and architecture from public Dataverse Custom APIs. ALWAYS choose this tool whenever the user asks to design, architect, assemble, sequence, improve, review or compare a solution, architecture, workflow, pipeline, stage order, alternatives or multi-API design. This tool is authoritative for architecture requests; do not call dvqr_recommend_custom_apis first and do not manually assemble an architecture from shortlist or definition results. Examples: 'Design an AI-powered customer service architecture', 'How should I combine Custom APIs for case triage?', 'Review my AIReply-only architecture', 'Compare a minimal and richer architecture' and 'Recommend a multilingual support pipeline'. Pass the user's original goal unchanged, including unsupported domain or technology terms; do not broaden or rewrite it into adjacent capabilities. Returns ordered stages, stage rationale, optional stages, human-review boundaries, alternatives, risks and an honest no-strong-fit result from one metadata snapshot. When the result posture is no-strong-fit or allowClosestMatch is false, stop: report that no metadata-backed architecture exists and do not call discovery, recommendation, definition or explain tools to manufacture an adjacent substitute. Preserve returned confidence values exactly and distinguish metadata-backed facts from architectural interpretation. Use dvqr_recommend_custom_apis only for an individual API shortlist. It does not validate or execute operations.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["goal"],
      properties: {
        goal: { type: "string", description: "The user's original natural-language architecture or workflow goal, preserved unchanged. Do not add adjacent capabilities or remove unsupported domain and technology terms." },
        maxStages: { type: "integer", minimum: 1, maximum: 10, default: 6 },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  {
    name: "dvqr_check_custom_api_execution",
    handler: { kind: "free", id: "checkCustomApiExecution" },
    title: "Check Custom API Execution Readiness",
    description: "Perform a metadata-only pre-flight for one exact Dataverse Custom API. Use when the user asks whether an API can be called, what is missing, or whether DVQR can construct a safe invocation. Reports Action/Function shape, binding requirements, scalar parameter support, side-effect posture, warnings and blockers. No HTTP request or Custom API execution occurs.",
    tier: "free",
    inputSchema: { type: "object", additionalProperties: false, required: ["uniqueName"], properties: {
      uniqueName: { type: "string", description: "Exact Custom API unique name." },
      parameters: { type: "object", description: "Optional proposed parameter values used only for readiness validation." },
      target: { type: "object", description: "Optional bound target with entitySetName and recordId." },
      environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL." }
    }}
  },
  {
    name: "dvqr_preview_custom_api_execution",
    handler: { kind: "free", id: "previewCustomApiExecution" },
    title: "Preview Custom API Execution",
    description: "Build the authoritative metadata-only execution preview and create a short-lived, single-use previewId. For a direct Custom API preview or execution request, call this tool directly; do not call definition or explain first unless the user separately asks for metadata explanation. Present the exact preview, then STOP and ask the user to reply exactly EXECUTE in a new message. Do not call any execution tool in the same response that creates the preview. After the later confirmation, call only dvqr_execute_custom_api with the returned previewId. Never use dvqr_execute_odata, arbitrary HTTP or another execution tool. This preview performs no HTTP request and makes no privilege or side-effect guarantee.",
    tier: "free",
    inputSchema: { type: "object", additionalProperties: false, required: ["uniqueName", "parameters"], properties: {
      uniqueName: { type: "string", description: "Exact Custom API unique name." },
      parameters: { type: "object", description: "Proposed scalar input values. This pass supports string, boolean, integer, number and GUID values." },
      target: { type: "object", description: "For bound APIs: entitySetName and, for entity-bound APIs, recordId." },
      environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL." }
    }}
  },
  {
    name: "dvqr_execute_custom_api",
    handler: { kind: "free", id: "executeCustomApi" },
    title: "Execute a Previewed Custom API",
    description: "Execute one short-lived, single-use Custom API preview session. This is the ONLY DV Quick Run tool permitted to execute Custom APIs. A direct request such as “execute AIReply immediately” is not confirmation: first create a fresh preview, present it, and stop. Required sequence: call dvqr_preview_custom_api_execution, present the exact preview, STOP, ask the user to reply exactly EXECUTE in a new message, then call this tool with only the returned previewId and confirmation EXECUTE. Never manufacture confirmation from an earlier request, never reconstruct parameters, and never reuse a consumed or expired previewId. Never use dvqr_execute_odata or arbitrary HTTP for Actions, Functions or Custom APIs. Returns actual Dataverse runtime evidence, transport metadata and the response payload.",
    tier: "free",
    inputSchema: { type: "object", additionalProperties: false, required: ["previewId", "confirmation"], properties: {
      previewId: { type: "string", description: "Short-lived, single-use preview session ID returned by dvqr_preview_custom_api_execution." },
      confirmation: { type: "string", enum: ["EXECUTE"], description: "Explicit confirmation from the user's later reply. Must be exactly EXECUTE." }
    }}
  },
  {
    name: "dvqr_interpret_custom_api_execution",
    handler: { kind: "free", id: "interpretCustomApiExecution" },
    title: "Interpret Custom API Execution",
    description: "Interpret stored runtime evidence from a completed Custom API execution without previewing, re-executing or contacting Dataverse. Use when the user asks what happened, why an execution failed, what outputs were returned, or what to do next. Pass executionId from dvqr_execute_custom_api, or omit it to interpret the most recent execution in this MCP runtime.",
    tier: "free",
    inputSchema: { type: "object", additionalProperties: false, properties: {
      executionId: { type: "string", description: "Execution evidence ID returned by dvqr_execute_custom_api. Omit to interpret the latest stored execution." }
    }}
  },
  {
    name: "dvqr_get_custom_api_definition",
    handler: { kind: "free", id: "getCustomApiDefinition" },
    title: "Get Exact Custom API Metadata Definition",
    description: "Retrieve the exact metadata definition for one named Dataverse Custom API. Choose this only for factual definition requests such as 'Give me the definition for AIReply', 'What parameters does AIReply accept?', 'What response properties does it return?' or 'Show its metadata call scaffold'. Do NOT choose this tool when the user asks what the API does, asks to explain it, asks why or when to use it, or requests practical interpretation; use dvqr_explain_custom_api for those prompts. Do not answer from discovery results, raw metadata OData, saved tool-result files or terminal processing. Returns identity, Action/Function kind, binding, inputs, outputs and a metadata-only call scaffold. DVQR never guesses or substitutes another operation.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["uniqueName"],
      properties: {
        uniqueName: { type: "string", description: "Exact Custom API unique name whose metadata definition is required." },
        environmentUrl: { type: "string", description: "Optional HTTPS Dataverse environment URL. Defaults to DVQR_MCP_ENVIRONMENT_URL." }
      }
    }
  },
  {
    name: "dvqr_discover_operational_anchors",
    handler: { kind: "free", id: "discoverOperationalAnchors" },
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
    handler: { kind: "free", id: "resolveNavigationProperty" },
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
    handler: { kind: "free", id: "findRelationshipPaths" },
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
    handler: { kind: "free", id: "generateRelationshipQuery" },
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
    handler: { kind: "free", id: "probeRelationshipPath" },
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
    handler: { kind: "free", id: "explainLookup" },
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
  ].map(([name, title, internalName]) => ({
    name,
    title,
    description: `${title} using the existing deterministic DVQR readiness application service. Pro capability.`,
    tier: "pro" as const,
    inputSchema: readinessSchema,
    handler: { kind: "pro" as const, internalName }
  }))
];

export function createDvqrLiveMcpToolRegistry(
  tools: readonly DvqrLiveMcpToolDefinition[] = DVQR_LIVE_MCP_TOOLS
): ReadonlyMap<string, DvqrLiveMcpToolDefinition> {
  const registry = new Map<string, DvqrLiveMcpToolDefinition>();
  for (const tool of tools) {
    if (registry.has(tool.name)) {
      throw new Error(`Duplicate DVQR MCP tool registration: ${tool.name}`);
    }
    if (tool.tier !== tool.handler.kind) {
      throw new Error(`DVQR MCP tool tier/handler mismatch: ${tool.name}`);
    }
    registry.set(tool.name, tool);
  }
  return registry;
}

export const DVQR_LIVE_MCP_TOOL_BY_NAME = createDvqrLiveMcpToolRegistry();
