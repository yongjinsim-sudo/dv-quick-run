import { getHubCapabilities, investigationPlaybooks, philosophy, productDirection, whatsNew } from "./dvQuickRunHubContent.js";
import { applyCapabilityContextStates, buildInvestigationContinuationModel } from "./dvQuickRunHubContext.js";
import type { DvQuickRunHubViewModel } from "./dvQuickRunHubTypes.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";
import type { EntitlementContext } from "../../product/capabilities/entitlementTypes.js";

const emptyInvestigationContext: InvestigationContext = {
  id: "hub-empty-context",
  source: "unknown",
  lastUpdatedUtc: ""
};

export function buildDvQuickRunHubViewModel(
  context: InvestigationContext = emptyInvestigationContext,
  entitlement: EntitlementContext = { plan: "free" }
): DvQuickRunHubViewModel {
  return {
    title: "DV Quick Run Hub",
    subtitle: "Operational investigation playbooks, capability discovery, and calm product direction inside VS Code.",
    sectionLinks: [
      { label: "Current Context", anchor: "current-context" },
      { label: "Access Context", anchor: "access-context" },
      { label: "Investigation Playbooks", anchor: "playbooks" },
      { label: "Capabilities", anchor: "capabilities" },
      { label: "What's New", anchor: "whats-new" },
      { label: "Product Direction", anchor: "direction" },
      { label: "Why It Works This Way", anchor: "philosophy" }
    ],
    investigationContinuation: buildInvestigationContinuationModel(context),
    playbooks: [...investigationPlaybooks],
    capabilities: applyCapabilityContextStates(getHubCapabilities(entitlement.plan), context),
    whatsNew: [...whatsNew],
    productDirection: [...productDirection],
    philosophy: [...philosophy]
  };
}
