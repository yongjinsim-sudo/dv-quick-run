import type { DataverseClient } from "../../services/dataverseClient.js";

export type OperationalContextSubjectType = "entity" | "record" | "capability" | "principal" | "environment";

export interface OperationalContextSubject {
  type: OperationalContextSubjectType;
  logicalName?: string;
  displayName?: string;
  id?: string;
  environmentId?: string;
}

export type OperationalContextEvidenceType =
  | "SolutionParticipation"
  | "AccessRestriction"
  | "MissingPrivilege"
  | "RuntimeActor"
  | "Owner"
  | "AutomationParticipation"
  | "CapabilityParticipation"
  | "OperationalDependency"
  | "ProviderUnavailable";

export type OperationalContextSource =
  | "dataverse"
  | "metadata"
  | "runtimeResponse"
  | "providedContext"
  | "provider";

export type OperationalContextScope = "currentSubject" | "oneHopRelated" | "currentPrincipal" | "currentEnvironment";

export type OperationalContextConfidence = "direct" | "inferred-from-metadata" | "related" | "unknown";

export type OperationalContextEmphasis = "neutral" | "notable" | "caution";

export interface OperationalContextEvidence {
  subject: OperationalContextSubject;
  evidenceType: OperationalContextEvidenceType;
  title: string;
  summary: string;
  source: OperationalContextSource;
  scope: OperationalContextScope;
  confidence: OperationalContextConfidence;
  emphasis?: OperationalContextEmphasis;
  query?: string;
  raw?: unknown;
}

export interface OperationalContextProviderRequest {
  subject: OperationalContextSubject;
  maxExpansionDepth: 0 | 1;
  allowSemanticExpansion?: boolean;
  dataverse?: {
    client: DataverseClient;
    token: string;
  };
}

export interface OperationalContextProviderResult {
  providerId: string;
  label: string;
  evidence: OperationalContextEvidence[];
  unavailableReason?: string;
}

export interface OperationalContextProvider {
  id: string;
  label: string;
  collect(request: OperationalContextProviderRequest): Promise<OperationalContextProviderResult>;
}

export interface OperationalContextSectionViewModel {
  id: string;
  label: string;
  summary: string;
  evidence: OperationalContextEvidence[];
  unavailableReason?: string;
}

export interface OperationalContextViewModel {
  subject: OperationalContextSubject;
  sections: OperationalContextSectionViewModel[];
  guardrails: string[];
}
