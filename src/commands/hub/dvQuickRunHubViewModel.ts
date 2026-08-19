import { getHubCapabilities, investigationPlaybooks, philosophy, productDirection, whatsNew } from "./dvQuickRunHubContent.js";
import { applyCapabilityContextStates, buildInvestigationContinuationModel } from "./dvQuickRunHubContext.js";
import type { DvQuickRunHubViewModel, HubEvidenceWorkspaceInfo } from "./dvQuickRunHubTypes.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";
import { formatEntitlementSupporterTag, type EntitlementContext } from "../../product/capabilities/entitlementTypes.js";
import { resolveSnapshotWorkspace } from "../../product/comparison/snapshotWorkspaceService.js";
import { getLocalMcpStatusSnapshot } from "../../runtime/localMcpLifecycle.js";

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
    subtitle: "Understand Dataverse architecture, run bounded evidence workflows, and continue persisted professional investigations from one calm home screen.",
    sectionLinks: [
      { label: "Local MCP", anchor: "local-mcp" },
      { label: "Start Here", anchor: "getting-started" },
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
    localMcp: {
      ...getLocalMcpStatusSnapshot(),
      lifecycle: "VS Code-managed stdio process, started on demand and remembered per workspace",
      authentication: "Azure CLI tenant session for v0.16.0 metadata, bounded queries, Operational Profile, Custom API execution, and managed investigation evidence acquisition"
    },
    playbooks: [...investigationPlaybooks],
    capabilities: applyCapabilityContextStates(getHubCapabilities(entitlement.plan), context)
      .filter((capability) => capability.id !== "cross-environment-comparison"),
    whatsNew: [...whatsNew],
    productDirection: [...productDirection],
    philosophy: [...philosophy]
  };
}
