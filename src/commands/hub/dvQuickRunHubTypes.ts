import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";

export type CapabilityStatus = "available" | "preview" | "future";
export type CapabilityContextKind = "selfContained" | "query" | "resultViewer" | "selectedRow" | "runtimeEvidence" | "entity" | "editorSelection";
export type CapabilityContextStateKind = "launchable" | "availableInContext" | "requiresContext" | "informational";

export interface InvestigationPlaybookStep {
  label: string;
  description: string;
  commandId?: string;
  relatedSurface?: string;
}

export interface InvestigationPlaybook {
  id: string;
  title: string;
  summary: string;
  whenToUse: string[];
  flow: InvestigationPlaybookStep[];
  relatedCapabilities: string[];
  safetyNotes?: string[];
}

export interface CapabilityContextRequirement {
  kind: CapabilityContextKind;
  label: string;
  unavailableReason: string;
  recommendedSurface: string;
}

export interface CapabilityContextState {
  kind: CapabilityContextStateKind;
  label: string;
  detail: string;
  recommendedSurface?: string;
  launchable: boolean;
}

export interface CapabilityInfo {
  id: string;
  title: string;
  group: string;
  summary: string;
  operationalUseCase: string;
  relatedPlaybooks: string[];
  commandId?: string;
  actionLabel?: string;
  launchNote?: string;
  howToUse?: string[];
  contextRequirement?: CapabilityContextRequirement;
  contextState?: CapabilityContextState;
  status: CapabilityStatus;
  sinceVersion?: string;
}

export interface ProductDirectionInfo {
  title: string;
  summary: string;
}

export interface HubSectionLink {
  label: string;
  anchor: string;
}

export type InvestigationTrustStateKind = "active" | "recoverable" | "historical" | "stale" | "empty";

export interface InvestigationTrustState {
  kind: InvestigationTrustStateKind;
  label: string;
  detail: string;
}

export interface InvestigationContinuationItem {
  label: string;
  value: string;
}


export interface InvestigationContinuationAction {
  label: string;
  detail: string;
  surface: string;
  commandId?: string;
  commandArgs?: string[];
  actionLabel?: string;
}

export interface InvestigationTimelineStep {
  label: string;
  detail: string;
}

export interface InvestigationContinuationModel {
  hasContext: boolean;
  trustState: InvestigationTrustState;
  title: string;
  summary: string;
  items: InvestigationContinuationItem[];
  actions: InvestigationContinuationAction[];
  timeline: InvestigationTimelineStep[];
  context?: InvestigationContext;
}

export interface DvQuickRunHubViewModel {
  title: string;
  supporterBadges: string[];
  subtitle: string;
  sectionLinks: HubSectionLink[];
  investigationContinuation: InvestigationContinuationModel;
  playbooks: InvestigationPlaybook[];
  capabilities: CapabilityInfo[];
  whatsNew: string[];
  productDirection: ProductDirectionInfo[];
  philosophy: string[];
}
