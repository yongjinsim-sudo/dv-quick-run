import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import type { DvqrEvidenceAcquisition, DvqrEvidenceKind, DvqrEvidenceMatrixEntry } from "./promptLibraryTypes.js";

const relationshipTools = new Set([
  "dvqr_discover_operational_anchors",
  "dvqr_resolve_navigation_property",
  "dvqr_find_relationship_paths",
  "dvqr_discover_business_paths",
  "dvqr_generate_relationship_query",
  "dvqr_explain_lookup"
]);

const relationshipRuntimeTools = new Set(["dvqr_validate_business_paths", "dvqr_probe_relationship_path"]);
const customApiRuntimeTools = new Set(["dvqr_preview_custom_api_execution", "dvqr_execute_custom_api", "dvqr_interpret_custom_api_execution"]);
const readinessTools = new Set([
  "dvqr_assess_investigation_readiness",
  "dvqr_get_investigation_readiness",
  "dvqr_explain_investigation_readiness",
  "dvqr_get_missing_evidence",
  "dvqr_get_evidence_recommendations",
  "dvqr_get_investigation_gaps",
  "dvqr_get_investigation_evidence_gaps",
  "dvqr_explain_confidence"
]);
const miniRcaTools = new Set(["dvqr_generate_mini_rca", "dvqr_generate_mini_rca_checkpoint", "dvqr_get_mini_rca"]);

function evidenceKind(toolName: string): DvqrEvidenceKind {
  if (toolName === "dvqr_list_capabilities") return "capability-discovery";
  if (toolName === "dvqr_get_operational_profile") return "operational-profile";
  if (toolName === "dvqr_explain_odata" || toolName === "dvqr_generate_relationship_query") return "query-shape";
  if (toolName === "dvqr_execute_odata") return "runtime-read";
  if (relationshipRuntimeTools.has(toolName)) return "relationship-runtime";
  if (relationshipTools.has(toolName)) return "relationship-metadata";
  if (toolName.includes("custom_api")) return customApiRuntimeTools.has(toolName) ? "custom-api-runtime" : "custom-api-metadata";
  if (readinessTools.has(toolName)) return "investigation-readiness";
  if (miniRcaTools.has(toolName)) return "mini-rca";
  if (toolName.includes("evidence") || toolName.includes("mechanism_context") || toolName.includes("timeline_context")) return "investigation-evidence";
  if (toolName.includes("investigation")) return "investigation-state";
  return "metadata";
}

function acquisition(toolName: string): DvqrEvidenceAcquisition {
  if (toolName === "dvqr_list_capabilities" || toolName === "dvqr_explain_odata") return "none";
  if (toolName === "dvqr_execute_odata" || relationshipRuntimeTools.has(toolName) || toolName === "dvqr_execute_custom_api") return "runtime-execution";
  if (toolName.startsWith("dvqr_get_") || toolName.startsWith("dvqr_list_") || toolName.startsWith("dvqr_explain_") || toolName.startsWith("dvqr_summarize_")) {
    return toolName.includes("investigation") || toolName.includes("mini_rca") ? "persisted-read" : "live-read";
  }
  if (toolName.startsWith("dvqr_start_investigation") || toolName.startsWith("dvqr_continue_investigation") || toolName.startsWith("dvqr_confirm_investigation") || toolName.startsWith("dvqr_update_investigation") || toolName.startsWith("dvqr_pause_investigation") || toolName.startsWith("dvqr_resume_investigation") || toolName.startsWith("dvqr_acquire_") || toolName.startsWith("dvqr_assess_investigation") || toolName.startsWith("dvqr_generate_mini_rca")) {
    return "persisted-write";
  }
  if (toolName === "dvqr_preview_custom_api_execution") return "none";
  return "live-read";
}

function boundaries(kind: DvqrEvidenceKind): readonly string[] {
  switch (kind) {
    case "operational-profile":
      return ["Operational density is not health, quality, security, performance, business value or root cause.", "Observed participation does not prove causality."];
    case "relationship-metadata":
      return ["Metadata-valid does not mean runtime-viable.", "Relationship reachability does not establish business preference or effective access."];
    case "relationship-runtime":
      return ["Observed runtime reachability does not prove causality or organisation-wide business preference.", "Empty and access-limited outcomes must remain distinct."];
    case "custom-api-runtime":
      return ["Preview is not execution.", "Runtime success does not establish business correctness, safety or approval."];
    case "investigation-readiness":
      return ["Readiness is tied to the persisted evidence fingerprint and may become stale.", "Readiness does not establish root cause."];
    case "mini-rca":
      return ["Mini RCA is a bounded hypothesis checkpoint, not root-cause proof.", "Supported, weakened and unresolved hypotheses remain distinct."];
    case "investigation-evidence":
      return ["One provider result is bounded evidence, not causal proof.", "Persisted evidence must retain provider and boundary semantics."];
    case "investigation-state":
      return ["Persisted DVQR state is authoritative for managed progression.", "Only the canonical continuation surface advances strategy state."];
    case "runtime-read":
      return ["A bounded read result is an observation from that request only.", "No Dataverse mutation authority is implied."];
    default:
      return ["Return only evidence supported by the selected capability; do not manufacture missing facts."];
  }
}

export function createDvqrPromptEvidenceMatrix(): readonly DvqrEvidenceMatrixEntry[] {
  return DVQR_LIVE_MCP_TOOLS.map((tool) => {
    const kind = evidenceKind(tool.name);
    const mode = acquisition(tool.name);
    return {
      id: `tool:${tool.name}`,
      toolName: tool.name,
      toolTitle: tool.title,
      tier: tool.tier,
      evidenceKind: kind,
      acquisition: mode,
      mutatesDataverse: false,
      persistsLocalInvestigationState: mode === "persisted-write",
      interpretationBoundary: boundaries(kind)
    };
  });
}
