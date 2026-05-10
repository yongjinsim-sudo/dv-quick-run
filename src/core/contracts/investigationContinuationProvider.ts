export type InvestigationSurface =
  | "resultViewer"
  | "executionInsights"
  | "operationalProfile"
  | "guidedTraversal"
  | "explain"
  | "unknown";

export interface InvestigationContinuationContext {
  readonly sourceSurface: InvestigationSurface;
  readonly targetSurface?: InvestigationSurface;
  readonly entityLogicalName?: string;
  readonly recordId?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly description?: string;
}

export interface InvestigationContinuationAction {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly targetSurface: InvestigationSurface;
  readonly enabled: boolean;
  readonly premiumOnly?: boolean;
}

export interface InvestigationContinuationProvider {
  getContinuationActions(context: InvestigationContinuationContext): readonly InvestigationContinuationAction[];
}
