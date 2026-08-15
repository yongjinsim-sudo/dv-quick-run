export type DvqrPromptTier = "free" | "pro";

export type DvqrPromptJourneyStage =
  | "discover"
  | "understand"
  | "query"
  | "navigate"
  | "investigate"
  | "verify";

export type DvqrPromptCategoryId =
  | "environment-understanding"
  | "metadata-query"
  | "relationships-traversal"
  | "custom-apis"
  | "operational-profile"
  | "managed-investigation";

export interface DvqrPromptCategory {
  readonly id: DvqrPromptCategoryId;
  readonly title: string;
  readonly description: string;
  readonly order: number;
}

export interface DvqrPromptParameterDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly placeholder: string;
  readonly required: boolean;
  readonly example?: string;
}

export interface DvqrPromptDefinition {
  readonly id: string;
  readonly categoryId: DvqrPromptCategoryId;
  readonly journeyStage: DvqrPromptJourneyStage;
  readonly title: string;
  readonly description: string;
  readonly template: string;
  readonly parameters: readonly DvqrPromptParameterDefinition[];
  readonly capabilityTool: string;
  readonly tier: DvqrPromptTier;
  readonly evidenceMatrixRefs: readonly string[];
  readonly prerequisitePromptIds: readonly string[];
  readonly followUpPromptIds: readonly string[];
  readonly tags: readonly string[];
}

export type DvqrEvidenceKind =
  | "capability-discovery"
  | "metadata"
  | "operational-profile"
  | "query-shape"
  | "runtime-read"
  | "relationship-metadata"
  | "relationship-runtime"
  | "custom-api-metadata"
  | "custom-api-runtime"
  | "investigation-state"
  | "investigation-evidence"
  | "investigation-readiness"
  | "mini-rca";

export type DvqrEvidenceAcquisition =
  | "none"
  | "live-read"
  | "runtime-execution"
  | "persisted-read"
  | "persisted-write";

export interface DvqrEvidenceMatrixEntry {
  readonly id: string;
  readonly toolName: string;
  readonly toolTitle: string;
  readonly tier: DvqrPromptTier;
  readonly evidenceKind: DvqrEvidenceKind;
  readonly acquisition: DvqrEvidenceAcquisition;
  readonly mutatesDataverse: false;
  readonly persistsLocalInvestigationState: boolean;
  readonly interpretationBoundary: readonly string[];
}

export interface DvqrRenderedPrompt {
  readonly promptId: string;
  readonly text: string;
  readonly missingRequiredParameters: readonly string[];
  readonly isReady: boolean;
}

export interface DvqrPromptSearchOptions {
  readonly query?: string;
  readonly categoryId?: DvqrPromptCategoryId;
  readonly tier?: DvqrPromptTier;
  readonly journeyStage?: DvqrPromptJourneyStage;
}


export interface DvqrPromptCategoryCoverage {
  readonly categoryId: DvqrPromptCategoryId;
  readonly promptCount: number;
  readonly freePromptCount: number;
  readonly proPromptCount: number;
  readonly coveredToolCount: number;
}

export interface DvqrPromptCatalogueCoverageReport {
  readonly totalPromptCount: number;
  readonly totalToolCount: number;
  readonly coveredToolCount: number;
  readonly intentionallyUncoveredToolNames: readonly string[];
  readonly uncoveredToolNames: readonly string[];
  readonly categories: readonly DvqrPromptCategoryCoverage[];
  readonly terminalPromptIds: readonly string[];
  readonly promptIdsWithoutInboundJourney: readonly string[];
}
