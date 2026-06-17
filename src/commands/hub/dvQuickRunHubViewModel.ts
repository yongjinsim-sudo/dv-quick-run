import { getHubCapabilities, investigationPlaybooks, philosophy, productDirection, whatsNew } from "./dvQuickRunHubContent.js";
import { applyCapabilityContextStates, buildInvestigationContinuationModel } from "./dvQuickRunHubContext.js";
import type { DvQuickRunHubViewModel, HubEvidenceWorkspaceInfo } from "./dvQuickRunHubTypes.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";
import { formatEntitlementSupporterTag, type EntitlementContext } from "../../product/capabilities/entitlementTypes.js";
import { resolveSnapshotWorkspace } from "../../product/comparison/snapshotWorkspaceService.js";

const emptyInvestigationContext: InvestigationContext = {
  id: "hub-empty-context",
  source: "unknown",
  lastUpdatedUtc: ""
};

function buildEvidenceWorkspaceInfo(): HubEvidenceWorkspaceInfo {
  const resolution = resolveSnapshotWorkspace();

  if (!resolution.available) {
    return {
      available: false,
      reason: resolution.reason ?? "Create an Evidence Workspace to capture and organise investigation artifacts."
    };
  }

  const workspaceName = resolution.workspaceRoot?.fsPath
    ? resolution.workspaceRoot.fsPath.split(/[\\/]/).filter(Boolean).pop()
    : undefined;

  return {
    available: true,
    workspaceName,
    snapshotsPath: resolution.snapshotsRoot?.fsPath,
    comparisonsPath: resolution.comparisonsRoot?.fsPath,
    reportsPath: resolution.reportsRoot?.fsPath
  };
}

export function buildDvQuickRunHubViewModel(
  context: InvestigationContext = emptyInvestigationContext,
  entitlement: EntitlementContext = { plan: "free" }
): DvQuickRunHubViewModel {
  const supporterBadges = entitlement.supporterTags?.map(formatEntitlementSupporterTag) ?? [];

  return {
    title: "DV Quick Run Hub",
    supporterBadges,
    subtitle: "Operational investigation playbooks, capability discovery, and calm product direction inside VS Code.",
    sectionLinks: [
      { label: "Current Context", anchor: "current-context" },
      { label: "Evidence Workspace", anchor: "evidence-workspace" },
      { label: "Access Context", anchor: "access-context" },
      { label: "Investigation Playbooks", anchor: "playbooks" },
      { label: "Capabilities", anchor: "capabilities" },
      { label: "DV ForgeLab", anchor: "dvforgelab-ecosystem" },
      { label: "What's New", anchor: "whats-new" },
      { label: "Product Direction", anchor: "direction" },
      { label: "Why It Works This Way", anchor: "philosophy" }
    ],
    investigationContinuation: buildInvestigationContinuationModel(context),
    evidenceWorkspace: buildEvidenceWorkspaceInfo(),
    playbooks: [...investigationPlaybooks],
    capabilities: applyCapabilityContextStates(getHubCapabilities(entitlement.plan), context)
      .filter((capability) => capability.id !== "cross-environment-comparison"),
    whatsNew: [...whatsNew],
    productDirection: [...productDirection],
    philosophy: [...philosophy]
  };
}
