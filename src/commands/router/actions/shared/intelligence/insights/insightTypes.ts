import type { ConfidenceBand } from "../scoring/confidenceBanding.js";

export interface InsightReason {
  code: string;
  message: string;
}

export interface RankedInsightCandidate<T> {
  item: T;
  score: number;
  confidence: ConfidenceBand;
  reasons: InsightReason[];
}
