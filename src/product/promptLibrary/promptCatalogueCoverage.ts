import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import { DVQR_PROMPT_CATALOGUE } from "./promptCatalogue.js";
import { DVQR_PROMPT_CATEGORIES } from "./promptCategories.js";
import type { DvqrPromptCatalogueCoverageReport } from "./promptLibraryTypes.js";

// These are intentionally not starter prompts. They are lower-level, confirmation-sensitive,
// lifecycle-specific, or semantic projection tools that are reached through guided investigation
// rather than exposed as primary copy/paste journeys.
export const DVQR_INTENTIONALLY_UNCOVERED_PROMPT_TOOLS: readonly string[] = [
  "dvqr_list_business_paths",
  "dvqr_get_business_path",
  "dvqr_save_business_path",
  "dvqr_remove_business_path",
  "dvqr_revalidate_business_path",
  "dvqr_test_business_path",
  "dvqr_execute_custom_api",
  "dvqr_bootstrap_investigation",
  "dvqr_get_investigation_focus_suggestions",
  "dvqr_confirm_investigation_intent",
  "dvqr_update_investigation_intent",
  "dvqr_generate_mini_rca_checkpoint",
  "dvqr_list_investigations",
  "dvqr_pause_investigation",
  "dvqr_resume_investigation",
  "dvqr_explain_investigation_evidence",
  "dvqr_get_supporting_evidence",
  "dvqr_get_contradictory_evidence",
  "dvqr_get_missing_evidence",
  "dvqr_explain_contributor",
  "dvqr_get_investigation_readiness",
  "dvqr_explain_investigation_readiness",
  "dvqr_get_investigation_evidence_gaps",
  "dvqr_explain_confidence",
  "dvqr_acquire_mechanism_context",
  "dvqr_acquire_timeline_context",
  "dvqr_get_investigation_gaps",
  "dvqr_get_contributor_availability",
  "dvqr_get_evidence_recommendations"
];

export function createDvqrPromptCatalogueCoverageReport(): DvqrPromptCatalogueCoverageReport {
  const coveredTools = new Set(DVQR_PROMPT_CATALOGUE.map((prompt) => prompt.capabilityTool));
  const intentional = new Set(DVQR_INTENTIONALLY_UNCOVERED_PROMPT_TOOLS);
  const allTools = DVQR_LIVE_MCP_TOOLS.map((tool) => tool.name);
  const uncoveredToolNames = allTools.filter((name) => !coveredTools.has(name) && !intentional.has(name));
  const inbound = new Set(DVQR_PROMPT_CATALOGUE.flatMap((prompt) => prompt.followUpPromptIds));

  return {
    totalPromptCount: DVQR_PROMPT_CATALOGUE.length,
    totalToolCount: allTools.length,
    coveredToolCount: coveredTools.size,
    intentionallyUncoveredToolNames: allTools.filter((name) => !coveredTools.has(name) && intentional.has(name)),
    uncoveredToolNames,
    categories: DVQR_PROMPT_CATEGORIES.map((category) => {
      const prompts = DVQR_PROMPT_CATALOGUE.filter((prompt) => prompt.categoryId === category.id);
      return {
        categoryId: category.id,
        promptCount: prompts.length,
        freePromptCount: prompts.filter((prompt) => prompt.tier === "free").length,
        proPromptCount: prompts.filter((prompt) => prompt.tier === "pro").length,
        coveredToolCount: new Set(prompts.map((prompt) => prompt.capabilityTool)).size
      };
    }),
    terminalPromptIds: DVQR_PROMPT_CATALOGUE.filter((prompt) => prompt.followUpPromptIds.length === 0).map((prompt) => prompt.id),
    promptIdsWithoutInboundJourney: DVQR_PROMPT_CATALOGUE.filter((prompt) => !inbound.has(prompt.id)).map((prompt) => prompt.id)
  };
}
