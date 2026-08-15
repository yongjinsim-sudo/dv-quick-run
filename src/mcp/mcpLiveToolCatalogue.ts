export type DvqrLiveMcpFreeHandlerId =
  | "listCapabilities"
  | "explainOData"
  | "executeOData"
  | "searchMetadata"
  | "getEntityMetadata"
  | "getOperationalProfile"
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
  | "discoverBusinessPaths"
  | "validateBusinessPaths"
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
  required: ["investigationId"],
  properties: {
    investigationId: { type: "string", description: "Persisted DVQR investigation ID. The live managed route builds and persists readiness internally; never supply an internal readiness request envelope." },
    actionId: { type: "string", description: "Required execution token from the exact current recommendedAction. Deterministic readiness execution is rejected when this token is absent, stale, or belongs to another action." }
  }
};

export const DVQR_LIVE_MCP_TOOLS: readonly DvqrLiveMcpToolDefinition[] = [
  {
    name: "dvqr_list_capabilities",
    handler: { kind: "free", id: "listCapabilities" },
    title: "List DVQR MCP Capabilities",
    description: "INVESTIGATION WORKFLOW DISCOVERY. List implemented Free and Pro DVQR MCP capabilities, authority boundaries, and the canonical investigation workflow. When the user asks to investigate, troubleshoot, perform root-cause analysis, inspect missing related records, assess readiness, or generate a Mini RCA, use dvqr_start_investigation as the primary entry point.",
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
    name: "dvqr_get_operational_profile",
    handler: { kind: "free", id: "getOperationalProfile" },
    title: "Get Operational Profile",
    description: "Build the canonical DVQR Operational Profile and DVQR Score for one Dataverse table using bounded read-only evidence. Use this for Operational Profile, DVQR Score, score-contributor, or why-is-the-score-high questions. The score is a calibrated normalization of weighted operational evidence; weighted contributions are points, not percentages and do not arithmetically sum to the displayed 0-100 score. It is an operational-density investigation signal, never a health, quality, security, performance, business-value, or root-cause score.",
    tier: "free",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["table"],
      properties: {
        table: { type: "string", description: "Dataverse table logical name, for example account or opportunity." },
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
    description: "Discover business capabilities, rank operational anchors, separate governance, scheduling, coordination and execution roles, and identify downstream work-item evidence from bounded Dataverse metadata. This is a standalone exploratory tool: its output is not automatically attached to a persisted investigation. Use dvqr_acquire_investigation_evidence for investigation-owned evidence. Does not claim runtime data exists.",
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
    name: "dvqr_discover_business_paths",
    handler: { kind: "free", id: "discoverBusinessPaths" },
    title: "Discover Business Paths",
    description: "Pass 10.1.1 metadata-only business-path discovery with depth-diverse candidate generation. Use when the user wants likely multi-hop business routes between two Dataverse tables rather than merely the shortest relationship. Direct relationships remain baseline candidates but do not suppress plausible deeper workflow routes. Discovers only metadata-verified paths, then ranks them using deterministic structural and business-semantic signals from table and relationship metadata. It does NOT query records, prove runtime viability, or mark any route business-preferred. Use dvqr_find_relationship_paths for exact relationship-shape questions; use this tool when the business flow itself is the question.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "targetTable"],
      properties: {
        sourceTable: { type: "string", description: "Logical name of the business-flow source table, such as contact." },
        targetTable: { type: "string", description: "Logical name of the desired downstream business table, such as msemr_careplanactivity or task." },
        maxDepth: { type: "integer", minimum: 2, maximum: 6, default: 5 },
        maxPaths: { type: "integer", minimum: 1, maximum: 20, default: 8 },
        environmentUrl: { type: "string" }
      }
    }
  },
  {
    name: "dvqr_validate_business_paths",
    handler: { kind: "free", id: "validateBusinessPaths" },
    title: "Validate Business Paths",
    description: "Pass 10.2 bounded runtime validation for Pass 10.1 business-path candidates, hardened by Pass 10.2.1 resilience. Starting from one real source record, it discovers a broad metadata-valid candidate pool, executes selected candidates independently hop-by-hop, records bounded observed continuation counts and exact breakpoints, exposes when a count reached the observation limit so it is not mistaken for an exact total, preserves access-denied/execution failures as indeterminate candidate outcomes instead of aborting the cohort, and explicitly marks budget-limited candidates NotTested. Direct relationships remain runtime baselines. Runtime preference is evidence for this source record only and never persistent organisational truth.",
    tier: "free",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["sourceTable", "targetTable", "sourceRecordId"],
      properties: {
        sourceTable: { type: "string" },
        targetTable: { type: "string" },
        sourceRecordId: { type: "string", description: "Real Dataverse source-record GUID used for bounded hop-by-hop validation." },
        maxDepth: { type: "integer", minimum: 2, maximum: 6, default: 5 },
        maxCandidates: { type: "integer", minimum: 1, maximum: 8, default: 5 },
        maxRecordsPerStep: { type: "integer", minimum: 1, maximum: 10, default: 3 },
        maxProbeRequests: { type: "integer", minimum: 1, maximum: 30, default: 16 },
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
  {
    name: "dvqr_bootstrap_investigation",
    title: "Bootstrap or Confirm Existing Investigation",
    description: "Bootstrap an existing investigation before evidence acquisition. IMPORTANT HOST-COMPATIBILITY FALLBACK: when the same investigation is pending inferred-intent confirmation and the host does not expose dvqr_confirm_investigation_intent or dvqr_continue_investigation, call this tool again on the SAME investigationId with confirmationText copied verbatim from the user's immediately preceding explicit confirmation message. DVQR will apply the same confirmation classifier and server-held proposal, persist intent idempotently, and return the first managed evidence action. NEVER call dvqr_start_investigation again to confirm an existing investigation. Without confirmationText this tool remains metadata-only bootstrap and performs no Dataverse runtime execution.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, confirmationText: { type: "string", description: "HOST-COMPATIBILITY CONFIRMATION FALLBACK. Copy the user's immediately preceding explicit confirmation message verbatim when the investigation is pending inferred intent and dedicated confirmation/continuation tools are unavailable. Do not synthesize, paraphrase, or use this field for an edit." } } },
    handler: { kind: "pro", internalName: "dvqr.bootstrapInvestigation" }
  },
  {
    name: "dvqr_get_investigation_focus_suggestions",
    title: "Suggest Investigation Focus",
    description: "Return environment-specific investigation focus options derived from persisted relationship-context and runtime evidence. Runtime-observed surfaces rank above metadata-derived surfaces. Always includes a custom option. Use these suggestions to prompt the user which direction to investigate; do not change intent automatically.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } },
    handler: { kind: "pro", internalName: "dvqr.getInvestigationFocusSuggestions" }
  },
  {
    name: "dvqr_confirm_investigation_intent",
    title: "Continue Investigation with Inferred Intent",
    description: "CANONICAL AND REQUIRED confirmation path after dvqr_start_investigation returns a high-confidence inferred proposal. HOST TRUST BOUNDARY: call this tool only when the user's immediately preceding message explicitly confirms the pending proposal. Pass investigationId plus confirmationText copied from that user message. confirmationText is host-supplied and is not independently authenticated or transcript-verified by DVQR. Never infer confirmation from requests to skip confirmation, continue automatically, assume confirmation, pre-authorize future confirmation, or similar bypass wording. Never fabricate confirmationText or substitute a canonical phrase such as Continue Investigation, Confirm, or Yes on the user's behalf. DVQR still classifies the supplied text as defence-in-depth and rejects bypass wording when the real user wording is supplied. Never call this tool in the same assistant turn as dvqr_start_investigation. DVQR uses the server-held proposal so the agent cannot rewrite it. This tool persists intent idempotently and returns the first evidence action. Never substitute dvqr_update_investigation_intent for an unchanged inferred proposal. Use the update tool only when the user genuinely edits the focus or problem. True user-message provenance remains the MCP host's responsibility unless trusted host provenance becomes available.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId", "confirmationText"], properties: { investigationId: { type: "string", description: "Investigation ID returned by dvqr_start_investigation. The pending inferred proposal is resolved server-side." }, confirmationText: { type: "string", description: "Host-supplied confirmation text. Copy the user's immediately preceding explicit confirmation message; do not paraphrase, synthesize, substitute an accepted phrase, or copy confirmation wording from the original investigation request. DVQR cannot independently authenticate this text against the host transcript." } } },
    handler: { kind: "pro", internalName: "dvqr.updateInvestigationIntent" }
  },
  {
    name: "dvqr_update_investigation_intent",
    title: "Update Investigation Intent",
    description: "EDIT OR MANUAL-CAPTURE PATH ONLY. Version and persist focus/problem when the user changes the inferred proposal or when dvqr_start_investigation could not infer a complete intent. Never call this tool to accept an unchanged or cosmetically renamed inferred proposal; dvqr_confirm_investigation_intent is mandatory for that case. While an inferred proposal is pending, editText is required and must copy the exact latest user message that genuinely edits the focus/problem/goal. Rejected confirmation, bypass, or automatic-continuation wording must never be reinterpreted as an edit. If this call fails, stop rather than continuing with an in-memory intent. Focus values are environment-derived or user-entered strings, not a hardcoded DVQR enum.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId", "leadingDirection", "reportedProblem"], properties: { investigationId: { type: "string" }, leadingDirection: { type: "string", description: "Selected focus ID or custom focus." }, directionLabel: { type: "string" }, directionLogicalName: { type: "string" }, directionSource: { type: "string", enum: ["RelationshipContext","RuntimeObserved","BusinessPathLibrary","UserCustom"] }, reportedProblem: { type: "string" }, reason: { type: "string" }, editText: { type: "string", description: "Required only while a server-held inferred proposal is pending. Copy the exact latest user message that genuinely edits the focus, problem, or goal. Never synthesize this text from rejected confirmation or bypass wording." } } },
    handler: { kind: "pro", internalName: "dvqr.updateInvestigationIntent" }
  },
  {
    name: "dvqr_generate_mini_rca",
    title: "Generate Evidence-Backed Mini RCA",
    description: "Generate and persist one bounded evidence-backed hypothesis Mini RCA from the investigation's current persisted evidence and current non-stale managed readiness. It correlates evidence against the current reported problem and leading direction, ranks competing hypotheses and information-gain next steps, and returns selectable follow-up questions plus a custom-question option. Call directly only after an explicit user request. If dvqr_continue_investigation returns recommendedAction for the Mini RCA checkpoint, invoke the returned action exactly; do not substitute dvqr_get_mini_rca. This tool never acquires evidence or executes Dataverse, and it never claims root cause or causality.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } },
    handler: { kind: "pro", internalName: "dvqr.generateMiniRca" }
  },
  {
    name: "dvqr_generate_mini_rca_checkpoint",
    title: "Generate Mini RCA Checkpoint",
    description: "FIRST-CLASS STRATEGY HANDOFF for the Mini RCA checkpoint. Generate and persist the same bounded evidence-backed Mini RCA artifact as dvqr_generate_mini_rca, using the investigation's current persisted evidence and current non-stale managed readiness. Use this exact tool when dvqr_continue_investigation returns it in recommendedAction. Do not substitute dvqr_get_mini_rca, which is retrieval-only. This alias does not create a second Mini RCA implementation and never acquires evidence or executes Dataverse. Deterministic execution requires actionId from the exact current recommendedAction integrity block.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, actionId: { type: "string", description: "Required execution token from the exact current Mini RCA checkpoint recommendedAction." } } },
    handler: { kind: "pro", internalName: "dvqr.generateMiniRca" }
  },
  {
    name: "dvqr_get_mini_rca",
    title: "Get Investigation Mini RCA",
    description: "Return the latest or requested persisted managed Mini RCA artifact. This read-only tool does not regenerate the artifact, reassess readiness, acquire evidence or execute Dataverse.",
    tier: "pro",
    inputSchema: { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, artifactId: { type: "string" } } },
    handler: { kind: "pro", internalName: "dvqr.getMiniRca" }
  },
  ...[
    ["dvqr_start_investigation", "Create Persistent Investigation", "dvqr.startInvestigation", { type: "object", additionalProperties: false, required: ["question"], properties: { question: { type: "string", description: "The user's investigation question. An explicit <entity/table> plus canonical Dataverse GUID in the question is bound as a Record subject automatically and the GUID is masked before persistence. Start returns a prepared Investigation Brief and then requires an explicit user confirmation or edit before evidence." }, title: { type: "string" }, type: { type: "string", enum: ["record", "table", "relationship", "general"], description: "Optional. Prefer omitting this field unless one of the exact supported values applies; DVQR will infer the investigation shape." }, subject: { type: "object", additionalProperties: false, properties: { kind: { type: "string" }, logicalName: { type: "string" }, table: { type: "string", description: "Convenience alias for logicalName." }, recordId: { type: "string", description: "Optional record GUID. DVQR stores only a masked form." }, recordIdMasked: { type: "string" }, displayLabel: { type: "string" } } }, environmentUrl: { type: "string" } } }],
    ["dvqr_get_investigation", "Load Persistent Investigation", "dvqr.getInvestigation", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_list_investigations", "List Persistent Investigations", "dvqr.listInvestigations", { type: "object", additionalProperties: false, properties: { environmentId: { type: "string" }, status: { type: "string" } } }],
    ["dvqr_get_investigation_strategy", "Show Investigation Strategy", "dvqr.getInvestigationStrategy", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, environmentUrl: { type: "string" } } }],
    ["dvqr_continue_investigation", "Continue One Investigation Step", "dvqr.continueInvestigation", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, environmentUrl: { type: "string" }, confirmationText: { type: "string", description: "HOST-COMPATIBILITY FALLBACK ONLY. When this investigation is pending an inferred intent and the dedicated confirmation tool is not exposed by the MCP host, copy the immediately preceding explicit user confirmation message here verbatim. DVQR applies the same confirmation classifier and server-held proposal as dvqr_confirm_investigation_intent. Never synthesize this value or use it for an edit." }, executeRecommendedMiniRca: { type: "boolean", description: "RESTRICTED HOST-SURFACE FALLBACK ONLY. Set true only after the user explicitly authorizes the current recommended Mini RCA generation action and the dedicated dvqr_generate_mini_rca_checkpoint/dvqr_generate_mini_rca tool is unavailable on the host surface. DVQR first re-reads the canonical continuation recommendation and executes only if that exact recommendation is Mini RCA generation. It never executes evidence acquisition, readiness, Timeline, mechanism, Plugin Execution, or any other action." } } }],
    ["dvqr_pause_investigation", "Pause Investigation", "dvqr.pauseInvestigation", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_resume_investigation", "Resume Investigation", "dvqr.resumeInvestigation", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" }, environmentUrl: { type: "string" } } }],
    ["dvqr_summarize_investigation", "Summarize Investigation", "dvqr.summarizeInvestigation", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_list_investigation_evidence", "List Investigation Evidence", "dvqr.listInvestigationEvidence", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_explain_investigation_evidence", "Explain Investigation Evidence", "dvqr.explainInvestigationEvidence", { type: "object", additionalProperties: false, required: ["investigationId","evidenceId"], properties: { investigationId: { type: "string" }, evidenceId: { type: "string" } } }],
    ["dvqr_get_supporting_evidence", "Get Supporting Evidence", "dvqr.getSupportingEvidence", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_get_contradictory_evidence", "Get Contradictory Evidence", "dvqr.getContradictoryEvidence", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_get_missing_evidence", "Get Missing Evidence", "dvqr.getMissingEvidence", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_explain_contributor", "Explain Contributor", "dvqr.explainContributor", { type: "object", additionalProperties: false, required: ["investigationId","contributorId"], properties: { investigationId: { type: "string" }, contributorId: { type: "string" } } }],
    ["dvqr_get_investigation_readiness", "Get Investigation Readiness", "dvqr.getInvestigationReadiness", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_explain_investigation_readiness", "Explain Investigation Readiness", "dvqr.explainInvestigationReadiness", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_get_investigation_evidence_gaps", "Get Investigation Evidence Gaps", "dvqr.getInvestigationEvidenceGaps", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_explain_confidence", "Explain Investigation Confidence", "dvqr.explainConfidence", { type: "object", additionalProperties: false, required: ["investigationId"], properties: { investigationId: { type: "string" } } }],
    ["dvqr_acquire_investigation_evidence", "Acquire One Investigation Evidence Item", "dvqr.recordInvestigationEvidence", { type: "object", additionalProperties: false, required: ["investigationId","providerId"], properties: { investigationId: { type: "string" }, actionId: { type: "string", description: "Required execution token from the exact current recommendedAction. Deterministic evidence execution is rejected when absent, stale, or mismatched." }, providerId: { type: "string", enum: ["metadata", "relationship-context", "runtime-relationship", "business-path-runtime", "mechanism-context", "timeline-context", "plugin-execution-understanding"], description: "Exactly one registered provider. Use metadata for schema facts, relationship-context for bounded metadata-derived business surfaces, runtime-relationship for a legacy bounded ranked-anchor probe, business-path-runtime for hop-by-hop validation of ranked business paths, mechanism-context for bounded post-Mini-RCA audit/execution-history context over an explicit target/time window, timeline-context for a bounded executable chronological ledger across audit/async/plug-in observations, or plugin-execution-understanding to follow an observed PluginTrace handoff using the persisted mechanism target/window. If a managed provider returns UnsupportedSubject, repair or restart the managed investigation subject; do not substitute standalone evidence tools because their results are not journalled." }, sourceRecordId: { type: "string", description: "Required for runtime-relationship and business-path-runtime. Representative source record GUID belonging to the investigation subject. Dataverse canonical 8-4-4-4-12 hexadecimal GUIDs are accepted without imposing RFC version/variant nibble restrictions. Used only for one bounded probe; persisted evidence masks it." }, targetTable: { type: "string", description: "Required for business-path-runtime, mechanism-context and timeline-context. Optional for runtime-relationship, where DVQR otherwise uses ranked relationship-context anchors." }, fromIso: { type: "string", description: "Required for mechanism-context and timeline-context. Inclusive ISO timestamp starting the explicit evidence window." }, toIso: { type: "string", description: "Required for mechanism-context and timeline-context. Inclusive ISO timestamp ending the explicit evidence window." }, boundaryRequestText: { type: "string", description: "Required for mechanism-context and timeline-context. Exact current user temporal instruction. It may contain explicit ISO values or a clear relative boundary such as 'last 30 days'. Relative requests may be resolved to fromIso/toIso, but provenance must remain UserRelativeBoundary." }, maxDepth: { type: "number" }, maxCandidates: { type: "number" }, maxRecordsPerStep: { type: "number" }, maxProbeRequests: { type: "number" }, environmentUrl: { type: "string" } } }],
    ["dvqr_acquire_mechanism_context", "Acquire Managed Mechanism Context", "dvqr.recordInvestigationEvidence", { type: "object", additionalProperties: false, required: ["investigationId","targetTable","fromIso","toIso","boundaryRequestText"], properties: { investigationId: { type: "string" }, targetTable: { type: "string", description: "Persisted target table for the managed mechanism boundary." }, fromIso: { type: "string", description: "Inclusive explicit ISO timestamp starting the mechanism evidence boundary." }, toIso: { type: "string", description: "Inclusive explicit ISO timestamp ending the mechanism evidence boundary." }, boundaryRequestText: { type: "string", description: "Exact current user temporal instruction. Absolute ISO text is UserAbsoluteBoundary; explicit relative wording such as 'last 30 days' is UserRelativeBoundary and may be resolved deterministically." }, environmentUrl: { type: "string" } } }],
    ["dvqr_acquire_timeline_context", "Acquire Managed Timeline Context", "dvqr.recordInvestigationEvidence", { type: "object", additionalProperties: false, required: ["investigationId","targetTable","fromIso","toIso","boundaryRequestText"], properties: { investigationId: { type: "string" }, targetTable: { type: "string", description: "Persisted or evidence-backed target table for the managed timeline boundary." }, fromIso: { type: "string", description: "Inclusive ISO timestamp starting the explicit timeline boundary." }, toIso: { type: "string", description: "Inclusive ISO timestamp ending the explicit timeline boundary." }, boundaryRequestText: { type: "string", description: "Exact current user temporal instruction. Absolute ISO text is UserAbsoluteBoundary; explicit relative wording such as 'last 30 days' is UserRelativeBoundary and may be resolved deterministically." }, environmentUrl: { type: "string" } } }],
    ["dvqr_assess_investigation_readiness", "Assess Investigation Readiness", "dvqr.assessInvestigationReadiness", readinessSchema],
    ["dvqr_get_investigation_gaps", "Low-Level Readiness Engine Gaps", "dvqr.retrieveInvestigationGaps"],
    ["dvqr_get_contributor_availability", "Get Contributor Availability", "dvqr.retrieveContributorAvailability"],
    ["dvqr_get_evidence_recommendations", "Get Evidence Recommendations", "dvqr.retrieveEvidenceRecommendations"]
  ].map(([name, title, internalName, schema]) => ({
    name: name as string,
    title: title as string,
    description: name === "dvqr_start_investigation"
      ? "PRIMARY INVESTIGATION ENTRY POINT. Always call this tool first whenever the user asks to investigate or troubleshoot a Dataverse record, table, relationship, missing record, unexpected behaviour, evidence gap, readiness issue, Mini RCA, or root-cause question. Do not search for another investigation entry point and do not call bootstrap, metadata evidence, relationship evidence, runtime evidence, readiness, continuation, or Mini RCA first. This tool creates and persists exactly one DVQR investigation, automatically performs bounded metadata-only Preparation and Bootstrap, and returns an Investigation Brief with environment-aware focus suggestions and reasons. Preparation performs no runtime record query and persists no investigation evidence. After the brief, STOP and wait for a subsequent user message to continue with or edit the inferred intent. Do not persist intent or acquire evidence in the same response. CRITICAL CONTINUATION RULE: once an investigationId has been created, NEVER call dvqr_start_investigation again for a later 'Continue Investigation', 'Confirm', 'Proceed', or equivalent confirmation message. Preserve the original investigationId. SERVER GUARD: while that same Record investigation is pending confirmation, a repeated start for the same transient record ID is session-idempotent even when the host supplies only question/title and the record GUID is resolved from the opening question and returns the original prepared response instead of creating another investigation. On a subsequent explicit confirmation message, prefer dvqr_confirm_investigation_intent with confirmationText copied verbatim from that latest user message. If the MCP host does not expose that dedicated tool, call dvqr_continue_investigation on the SAME investigationId with confirmationText copied verbatim. If the host also does not expose continuation but does expose dvqr_bootstrap_investigation, call dvqr_bootstrap_investigation on the SAME investigationId with confirmationText copied verbatim; this is the guaranteed visible bootstrap fallback observed on restricted host surfaces. Use dvqr_update_investigation_intent only for genuinely edited or low-confidence manual intent. When the question explicitly contains an entity/table plus GUID, DVQR binds it as a Record subject and masks the GUID before persistence. SUBJECT BINDING RULE: pass subject.logicalName only when the user supplied the exact logical name or it came from a DVQR metadata result; do not invent a schema name from a display label. If the host supplies a logical name that conflicts with DVQR's bounded question-label resolution, DVQR records and surfaces the correction rather than silently trusting the host guess. If later managed evidence reports UnsupportedSubject, stop the managed workflow and repair/restart the subject instead of switching to standalone evidence tools. Example: User: Investigate Contact <GUID>. Assistant: call dvqr_start_investigation."
      : name === "dvqr_get_investigation"
        ? "Load one persisted DVQR investigation by its exact investigationId. This is read-only and never advances or completes a strategy step. Treat a successful result as authoritative. Do not claim the capability is unavailable and do not launch evidence acquisition."
        : name === "dvqr_list_investigations"
          ? "List persisted DVQR investigations. Treat the returned list, including an empty list, as authoritative. Do not reconstruct a list from chat history and do not claim the capability is unavailable after a successful call."
          : name === "dvqr_get_investigation_strategy"
            ? "Read-only authoritative persisted-state fallback. Return the deterministic strategy and exact current step plus managedVerification, managedCompletionHistory, managedReadiness, managedMiniRcaCheckpoint, currentIntent, miniRcaArtifactRefs and stateConsistency from the same investigation journal. Prefer dvqr_get_investigation when the host exposes it; when an optimized host omits that tool, use this result instead of focus suggestions or conversational reconstruction. Never describe this read as continuing, advancing or completing the investigation. Only dvqr_continue_investigation may advance strategy state. Do not call any recommended capability automatically. No evidence acquisition or execution is authorised."
            : name === "dvqr_continue_investigation"
              ? "Prerequisite: dvqr_start_investigation completed. Normally investigation intent is already persisted before this tool advances strategy. HOST-COMPATIBILITY FALLBACK: if the investigation is still pending inferred-intent confirmation because the host did not expose dvqr_confirm_investigation_intent, this tool may receive confirmationText copied verbatim from the immediately preceding explicit user confirmation message. DVQR then applies the same confirmation classifier and server-held proposal used by the dedicated confirmation tool and returns the first bounded evidence action; it does not bypass or weaken confirmation. Never synthesize confirmationText and never use this fallback for an edit. Otherwise return the exact next planned investigation action after reconciling persisted bootstrap, intent and evidence. Every executable deterministic Record strategy step returns recommendedAction.kind=ToolCall with a versioned integrity actionId. Invoke recommendedAction.tool with recommendedAction.arguments plus only any requiredHostArguments resolved from the specified transient host source when the user has authorized that step. The actionId binds the exact tool, persisted-safe arguments, strategy step and current evidence fingerprint. Execute one exact tool call for that boundary, then stop and return to persisted DVQR state before any further managed action; do not alter providerId/targetTable, treat the abstract presentedStep.capability as a public MCP tool name, search semantically for a similar tool, substitute a retrieval tool, or chain additional managed actions. HOST-SURFACE MINI RCA FALLBACK: if this continuation returns recommendedAction.tool=dvqr_generate_mini_rca_checkpoint (or dvqr_generate_mini_rca) but that dedicated generator is not exposed by the host, and the user has explicitly authorized that exact action, call dvqr_continue_investigation again on the SAME investigationId with executeRecommendedMiniRca=true. DVQR rechecks the live canonical recommendation and will execute only Mini RCA generation; it rejects every other recommended action. Do not use this flag speculatively or for evidence/readiness actions. When all deterministic steps are satisfied and the latest Mini RCA checkpoint matches current non-stale managed readiness, DVQR returns completion.state=InvestigationComplete as the authoritative stop signal. At that point recommendedAction is absent: repeated continuation must not reacquire evidence or regenerate Mini RCA. DVQR may still return optionalActions for explicit user-directed branches such as managed Timeline; optionalActions do not make the investigation incomplete, are not auto-run recommendations, and execute only after the user explicitly selects the branch. Raw source record GUIDs remain transient host arguments and must not be persisted merely for orchestration. When the user asks to continue, call this tool directly rather than searching capabilities or reloading the investigation. For a Record investigation whose persisted intent has a concrete directionLogicalName/target table, managed business-path-runtime evidence targeting that table is the required runtime provider for strategy completion; legacy runtime-relationship evidence remains journal evidence but does not complete that target-aware step. Use runtime-relationship only when no concrete target is available. Runtime execution still requires explicit user authority. Example: User: Continue investigation. Assistant: call dvqr_continue_investigation."
              : name === "dvqr_assess_investigation_readiness"
                ? "Prerequisite: dvqr_start_investigation completed, intent persisted, and required evidence acquired. Assess and persist readiness for one investigation by passing only investigationId. Call this directly before dvqr_generate_mini_rca. After mechanism-context is persisted, the prior managed readiness is explicitly stale; call this tool again to create a fresh mechanism-aware readiness snapshot before an explicit Mini RCA regeneration. Readiness assessment never recollects Audit, async-operation, plug-in-trace, runtime-path or metadata evidence. Do not call contributor helpers, get-investigation, list capabilities, or guess internal request envelopes instead. For record and table investigations DVQR stores a managed readiness result. A low-level canonical request remains accepted only for supported Timeline or Cross-Environment readiness profiles."
              : name === "dvqr_get_investigation_readiness"
                ? "Return the stored readiness result for one persisted investigation, whether canonical or managed. Accept only the investigationId argument. If readiness has not been assessed, return an authoritative NotAssessed empty state with no evidence, gaps or confidence claims and recommend Continue investigation. Do not search the workspace, guess a request contract, or call readiness assessment tools automatically."
              : name === "dvqr_explain_investigation_readiness"
                ? "Explain the stored readiness result. If none exists, return an authoritative NotAssessed explanation and recommend Continue investigation. Do not ask the user for an internal readiness request contract."
              : name === "dvqr_generate_mini_rca"
                ? "Prerequisite: dvqr_start_investigation completed, intent persisted, required evidence acquired, and a current persisted readiness assessment exists. Generate and persist one bounded evidence-backed hypothesis Mini RCA only after an explicit user request. If readiness is missing or stale, call dvqr_assess_investigation_readiness with only investigationId, then retry once; never infer readiness from evidence or search for substitute tools. After mechanism-context changes the evidence set, an explicit later generation creates a new frozen checkpoint from the reassessed persisted evidence; it must not recollect Audit, async-operation, plug-in-trace, runtime-path or metadata evidence. Surface hypotheses, evidence, missing evidence and bounded follow-ups. Do not acquire evidence, execute Dataverse, or claim root cause. Reuse an existing artifact when evidence and substantive readiness are unchanged."
              : name === "dvqr_get_mini_rca"
                ? "Return the latest or requested persisted managed Mini RCA artifact. This is read-only and does not regenerate, reassess readiness, or acquire evidence."
              : name === "dvqr_acquire_mechanism_context"
                ? "FIRST-CLASS POST-CHECKPOINT MECHANISM HANDOFF. Use this tool directly when the persisted Record strategy recommends creation/transition mechanism evidence after the first Mini RCA checkpoint. It routes to the same canonical managed mechanism-context provider as dvqr_acquire_investigation_evidence(providerId=mechanism-context). Requires investigationId, persisted targetTable, resolved fromIso/toIso, and boundaryRequestText copied from the user's temporal instruction. Explicit relative wording such as 'last 30 days' may be resolved deterministically and is recorded as UserRelativeBoundary; never invent a time boundary when the user supplied none. Do not substitute dvqr_acquire_mechanism_evidence: that is an abstract strategy capability label, not a public MCP tool."
              : name === "dvqr_acquire_timeline_context"
                ? "FIRST-CLASS OPTIONAL TIMELINE HANDOFF. Use this tool only after the first Mini RCA checkpoint when the user explicitly chooses a managed timeline/chronology branch. It persists exactly one timeline-context evidence artifact using the same canonical managed evidence provider as dvqr_acquire_investigation_evidence(providerId=timeline-context). Requires investigationId, targetTable, resolved fromIso/toIso and boundaryRequestText copied from the user's temporal instruction. Explicit relative wording may be resolved deterministically and recorded as UserRelativeBoundary. Reuse a mechanism window only when the investigator explicitly chooses that same chronology boundary; never invent or widen a window merely to obtain more events. Timeline is optional and does not appear as a mandatory persisted strategy step. Persisting it stales managed readiness/checkpoint and therefore requires readiness reassessment before Mini RCA regeneration. Never substitute plugin-execution-understanding for Timeline. Temporal ordering, adjacency and proximity do not establish triggering or causality."
              : name === "dvqr_acquire_investigation_evidence"
                ? "For an explicit acquire metadata, relationship-context, or runtime evidence request, call this tool directly without listing capabilities, continuing the investigation, or assessing readiness first. Acquire and persist exactly one bounded evidence item through one registered provider, reconcile the strategy against the persisted result, then STOP. Supported providerId values are metadata, relationship-context, runtime-relationship, business-path-runtime, mechanism-context, timeline-context and plugin-execution-understanding. runtime-relationship requires the first-class sourceRecordId argument. With an explicit target it performs one bounded probe; without one it probes up to three ranked business surfaces and stops on the first observed target rows or budget exhaustion. Never substitute standalone OData as equivalent investigation evidence; standalone execution is not persisted, journalled, deduplicated or reconciled into the investigation. Report mappings as provider-level contributions, not canonical readiness contributors. Relationship Context reuses bounded Operational Anchors discovery but never proves runtime participation. Runtime Relationship consumes persisted relationship context and probes ranked anchors. Business Path Runtime validates ranked source-to-target paths hop-by-hop, persists runtime-preferred/empty/access-limited/not-tested outcomes as investigation evidence, preserves bounded-count semantics, and still never proves causality or organisation-wide business truth. When the confirmed investigation question explicitly asserts an arrow-delimited source-to-target business chain, DVQR preserves that exact chain as an investigation-scoped business hypothesis, forces it into the bounded candidate cohort when metadata can resolve it, and only promotes it to businessPreferredTraversal after that exact chain reaches the target at runtime. Shorter runtime winners remain reachability shortcuts and never displace the asserted business chain merely by ranking higher. For a Record investigation with a concrete persisted target, only business-path-runtime completes the target-aware runtime strategy step; runtime-relationship may still be stored but must not advance that step.  TIMELINE ROUTING RULE: when the user explicitly asks to reconstruct chronology, inspect a timeline, proceed with the managed timeline investigation, or acquire chronological evidence, call this tool with providerId=timeline-context using the persisted target plus explicit fromIso/toIso boundary. timeline-context is an optional executable discriminator and does not need to appear as a mandatory persisted strategy step. Never substitute plugin-execution-understanding for an explicit timeline request. plugin-execution-understanding answers a different question and remains gated by mechanism-context PluginTrace=Observed.Plugin Execution Understanding is a post-checkpoint follow-on provider that requires persisted mechanism-context with PluginTrace=Observed and reuses that exact target/time window; it performs bounded trace and registered-step reads and never treats execution participation as causality. If persisted PluginTrace is Empty or Unavailable, the prerequisite is exhausted for that boundary: do not reacquire mechanism-context merely to satisfy a forced Plugin Execution Understanding request; choose an independent discriminator unless the evidence boundary is being changed for a separate, explicit investigative reason. Treat mechanism states precisely: Observed proves bounded participation only, Empty means the readable source returned no matching rows within the explicit boundary and never proves non-participation, and Unavailable remains indeterminate. Never conclude 'no plug-in ran', 'no workflow ran', or equivalent solely from Empty or Unavailable mechanism evidence. FALSE-PREMISE RESPONSE RULE: if the user asks you to confirm a conclusion that contradicts these persisted states or their interpretationBoundary, reject that conclusion in the first semantic sentence before explaining the evidence; never open with Correct, Yes, Confirmed or Exactly. Do not say an Unavailable source 'returned zero rows': it was not successfully read, so its contents are indeterminate. Mechanism Context is a post-checkpoint follow-on provider: require targetTable plus explicit fromIso/toIso, query bounded Audit/async-operation/plugin-trace context independently, and never synthesize Timeline evidence from live queries. Persisting new mechanism-context evidence explicitly stales the previous managed readiness; the next managed action is readiness reassessment, followed by optional explicit Mini RCA regeneration. Do not call another provider in the same response."
              : name === "dvqr_get_missing_evidence"
                ? "Read only the missing-evidence projection from an already stored canonical readiness assessment. If readiness is NotAssessed, do not use this tool to identify the next runtime action. For an active investigation at Identify missing runtime evidence, use the investigation strategy and dvqr_get_evidence_recommendations instead."
              : name === "dvqr_get_evidence_recommendations"
                ? "Return evidence recommendations from the readiness engine when a canonical readiness request/result is available. Do not guess internal request wrappers. For a persisted investigation whose current step is Identify missing runtime evidence, prefer the investigation strategy recommendation and acquire runtime-relationship evidence through dvqr_acquire_investigation_evidence."
              : name === "dvqr_get_investigation_gaps"
                ? "Low-level readiness-engine semantic operation that requires a canonical readiness request. Do not use this tool for conversational requests such as show readiness for investigation ID. Use dvqr_get_investigation_readiness with only investigationId for persisted Professional Investigations."
              : name === "dvqr_pause_investigation"
                ? "Persist the investigation as Paused and stop. No evidence or execution work is authorised."
                : name === "dvqr_resume_investigation"
                  ? "Revalidate environment binding and resume a paused investigation. If stale or mismatched, return Limited state and stop without evidence acquisition."
                  : `${title} using canonical DVQR application services. Pro capability.`,
    tier: "pro" as const,
    inputSchema: (schema ?? readinessSchema) as Record<string, unknown>,
    handler: { kind: "pro" as const, internalName: internalName as string }
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
