export type OperationalProfileBand = "none" | "low" | "moderate" | "high" | "veryHigh" | "partial";

export type OperationalProfileEvidenceKind =
  | "pluginRegistration"
  | "relationship"
  | "attribute"
  | "asyncOperation"
  | "flow"
  | "workflow"
  | "managedState";

export interface OperationalProfileEvidenceItem {
  kind: OperationalProfileEvidenceKind;
  label: string;
  value: string;
  detail?: string;
  actionId?: string;
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
  stateKind?: "density" | "managed";
  evidence: OperationalProfileEvidenceItem[];
}

export interface OperationalProfileModel {
  kind: "entityOperationalProfile";
  entityLogicalName: string;
  entityDisplayName: string;
  headlineBand: OperationalProfileBand;
  headlineLabel: string;
  summary: string;
  dimensions: OperationalProfileDimension[];
  evidence: OperationalProfileEvidenceItem[];
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
  isManaged?: boolean;
  isPartiallyManaged?: boolean;
  managedDetail?: string;
}
