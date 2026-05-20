export type OperationalProfileBand = "none" | "low" | "moderate" | "high" | "veryHigh" | "partial";

export type OperationalProfileEvidenceKind =
  | "pluginRegistration"
  | "relationship"
  | "attribute"
  | "asyncOperation"
  | "flow"
  | "workflow"
  | "managedState"
  | "businessRule"
  | "audit";

export interface OperationalProfileEvidenceItem {
  kind: OperationalProfileEvidenceKind;
  label: string;
  value: string;
  detail?: string;
  actionId?: string;
}

export type OperationalProfileGuidancePriority = "informational" | "moderate" | "high";

export type OperationalProfileGuidanceCategory =
  | "pluginRegistrationDensity"
  | "relationshipDensity"
  | "metadataFootprint"
  | "asyncOperationActivity"
  | "workflowParticipation"
  | "flowParticipation"
  | "managedStateNuance"
  | "businessRuleParticipation"
  | "realtimeWorkflowParticipation"
  | "auditParticipation"
  | "generalInvestigation";

export interface OperationalProfileGuidanceItem {
  category: OperationalProfileGuidanceCategory;
  priority: OperationalProfileGuidancePriority;
  title: string;
  message: string;
  evidenceDimensionIds: string[];
}

export type OperationalProfileNavigationPriority = "primary" | "secondary";

export interface OperationalProfileNavigationAction {
  actionId: string;
  label: string;
  description: string;
  priority: OperationalProfileNavigationPriority;
  evidenceDimensionIds: string[];
}

export type OperationalProfileFutureSurfaceAvailability = "freeRoadmap" | "proRoadmap";

export interface OperationalProfileFutureSurface {
  id: string;
  label: string;
  description: string;
  availability: OperationalProfileFutureSurfaceAvailability;
}

export interface OperationalProfileDimension {
  id: string;
  label: string;
  band: OperationalProfileBand;
  valueLabel: string;
  explanation: string;
  whyItMatters: string;
  evidenceStateLabel: string;
  intensityPercent: number;
  stateKind?: "density" | "managed" | "context";
  evidence: OperationalProfileEvidenceItem[];
}

import type { OperationalContextViewModel } from "../operationalContext/operationalContextTypes.js";

export interface OperationalProfileModel {
  kind: "entityOperationalProfile";
  entityLogicalName: string;
  entityDisplayName: string;
  headlineBand: OperationalProfileBand;
  headlineLabel: string;
  summary: string;
  dimensions: OperationalProfileDimension[];
  evidence: OperationalProfileEvidenceItem[];
  guidance: OperationalProfileGuidanceItem[];
  navigationActions: OperationalProfileNavigationAction[];
  futureSurfaces: OperationalProfileFutureSurface[];
  operationalContext?: OperationalContextViewModel;
  /** @deprecated Use guidance for typed model-driven rendering. Kept for existing surfaces. */
  investigationGuidance: string[];
  invariants: {
    entityScoped: true;
    explicitlyUserTriggered: true;
    advisoryOnly: true;
    evidenceBacked: true;
  };
}

export interface OperationalProfileInput {
  entityLogicalName: string;
  entityDisplayName?: string;
  synchronousPluginStepCount?: number;
  totalPluginStepCount?: number;
  relationshipCount?: number;
  attributeCount?: number;
  asyncOperationCount7d?: number;
  distinctAsyncOperationCount7d?: number;
  flowReferenceCount?: number;
  activeWorkflowCount?: number;
  businessRuleCount?: number;
  realTimeWorkflowCount?: number;
  auditingEnabled?: boolean;
  isManaged?: boolean;
  isPartiallyManaged?: boolean;
  managedDetail?: string;
  operationalContext?: OperationalContextViewModel;
}
