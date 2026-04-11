export type BinderActionId =
  | "continueTraversal"
  | "runTraversalBatch"
  | "runTraversalOptimizedBatch"
  | "previewAddTop"
  | "previewAddSelect";

export interface BinderSuggestion {
  text: string;
  actionId: BinderActionId;
  payload?: Record<string, unknown>;
}
