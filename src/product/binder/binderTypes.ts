import type { InsightTier } from "./insightExecutionContext.js";

export type BinderActionId =
  | "continueTraversal"
  | "runTraversalBatch"
  | "runTraversalOptimizedBatch"
  | "previewAddTop"
  | "previewAddSelect"
  | "previewODataFilter"
  | "requestResultInsights"
  | "requestExecutionInsights";

export type BinderRecommendationSource =
  | "traversal"
  | "batch"
  | "queryShape"
  | "resultShape"
  | "queryDoctor"
  | "performance"
  | "execution";

export interface BinderSuggestion {
  text: string;
  actionId: BinderActionId;
  confidence: number;
  reason: string;
  source: BinderRecommendationSource;
  payload?: Record<string, unknown>;
  /** Execution tier used by the Insight Drawer to keep future providers budget-aware. */
  tier?: InsightTier;
  /** True when the current entitlement may execute the recommended action from the insights surface. */
  canApply?: boolean;
  /** User-facing label for an executable insights action. */
  applyLabel?: string;
}
