import { DvqrMcpLiveCapabilityPolicy, DVQR_MCP_COMMERCIAL_BOUNDARY } from "./mcpLiveCapabilityPolicy.js";
import { DVQR_LIVE_MCP_TOOLS } from "./mcpLiveToolCatalogue.js";

export function createDvqrMcpCapabilityPayload(proEnabled: boolean) {
  const policy = new DvqrMcpLiveCapabilityPolicy(proEnabled);
  return {
    contractVersion: "dvqr-mcp-capabilities-v1",
    product: "DV Quick Run",
    releaseVersion: "0.15.6",
    transport: "stdio",
    mode: "local-read-only",
    commercialBoundary: DVQR_MCP_COMMERCIAL_BOUNDARY,
    proEnabled,
    implementedTools: policy.projectAll(DVQR_LIVE_MCP_TOOLS),
    toolSelectionGuidance: {
      customApis: [
        "If the user asks what a named Custom API does, asks to explain it, or asks why or when to use it, call dvqr_explain_custom_api.",
        "If the user asks for the exact definition, parameters, response properties or metadata call scaffold of one named Custom API, call dvqr_get_custom_api_definition.",
        "Never substitute dvqr_get_custom_api_definition for an explanation or practical-usage request.",
        "If the user asks to compare two or more named Custom APIs, call dvqr_compare_custom_apis rather than calling Explain repeatedly.",
        "If the user asks which individual Custom API or APIs fit a capability and does not ask for a design or ordered workflow, call dvqr_recommend_custom_apis.",
        "If the user asks to design, architect, assemble, sequence, improve, review or compare an architecture, solution, workflow, pipeline, stage order, alternatives or multi-API design, call dvqr_recommend_solution_architecture directly.",
        "For architecture requests, do not call dvqr_recommend_custom_apis first and do not manually assemble a design from shortlist or definition results.",
        "Pass the user's original architecture goal unchanged. Do not broaden unsupported domain or technology terms into adjacent supported concepts.",
        "Recommendation honours explicit exclusions, reports confidence and may return no strong fit rather than promoting weak lexical matches.",
        "Use dvqr_discover_custom_apis only for inventory, filtering and search.",
        "Before live Custom API execution, call dvqr_preview_custom_api_execution and review the exact short-lived, single-use preview session.",
        "Stop after preview and ask the user to reply exactly EXECUTE in a new message. Then call dvqr_execute_custom_api with the returned previewId. Preview sessions are short-lived, single-use, and cannot be replayed. Pass 2 executes public global generate-only Actions only.",
        "After a completed or failed Custom API execution, call dvqr_interpret_custom_api_execution to classify the outcome, analyse outputs and recommend evidence-backed next steps without re-executing or contacting Dataverse.",
        "Do not reconstruct Custom API definitions, comparisons or recommendations through dvqr_execute_odata, saved result files or terminal processing."
      ]
    },
    deferredCapabilities: [
      "FetchXML generation from verified paths",
      "Bound Custom API execution, Functions, complex parameters and mutation-capable operation execution",
      "Execution Profile projection",
      "DVQR Score projection",
      "Timeline, Cross-Environment Diff and Mini RCA orchestration"
    ],
    limitations: [
      "No PATCH, DELETE or workspace mutation tools are registered. POST is restricted to explicitly confirmed, short-lived single-use preview sessions for public global generate-only Custom API Actions.",
      "OData execution uses Azure CLI authentication and requires an explicit local Dataverse environment.",
      "On Windows, low-level Node fetch failures retry through a bounded PowerShell transport using the same reviewed method, route and body.",
      "Pro readiness calls require DVQR_MCP_PRO_ENABLED=true until packaged entitlement reuse is connected."
    ]
  };
}
