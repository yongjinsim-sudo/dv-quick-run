export interface InvestigationComparisonContext {
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly entityLogicalName?: string;
}

export interface InvestigationComparisonResult {
  readonly title: string;
  readonly summary: string;
  readonly evidence: readonly string[];
}

export interface InvestigationComparisonProvider {
  compare(context: InvestigationComparisonContext): Promise<InvestigationComparisonResult | undefined>;
}
