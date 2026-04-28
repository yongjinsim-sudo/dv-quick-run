export type BinderActionId =
  | "continueTraversal"
  | "runTraversalBatch"
  | "runTraversalOptimizedBatch"
  | "previewAddTop"
  | "previewAddSelect"
  | "previewODataFilter";

export type BinderRecommendationSource =
  | "traversal"
  | "batch"
  | "queryShape"
  | "resultShape"
  | "queryDoctor";

export interface BinderSuggestion {
  text: string;
  actionId: BinderActionId;
  confidence: number;
  reason: string;
  source: BinderRecommendationSource;
  payload?: Record<string, unknown>;
  /** True when the current entitlement may execute the recommended action from the insights surface. */
  canApply?: boolean;
  /** User-facing label for an executable insights action. */
  applyLabel?: string;
}
