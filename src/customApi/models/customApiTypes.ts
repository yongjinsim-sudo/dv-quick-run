export type CustomApiOperationKind = "Action" | "Function";

export type CustomApiBindingKind = "Bound" | "Unbound" | "Unknown";

export type CustomApiBoundTargetKind = "none" | "entity" | "collection" | "unknown";

export interface CustomApiRequestParameter {
  id?: string;
  uniqueName: string;
  displayName?: string;
  logicalName?: string;
  type?: string;
  typeLabel?: string;
  typeCategory?: string;
  typeDescription?: string;
  executionSupport?: "preview-ready" | "inspect-only";
  executionSupportLabel?: string;
  executionSupportReason?: string;
  isOptional?: boolean;
  logicalEntityName?: string;
}

export interface CustomApiResponseProperty {
  id?: string;
  uniqueName: string;
  displayName?: string;
  logicalName?: string;
  type?: string;
  typeLabel?: string;
  typeCategory?: string;
  typeDescription?: string;
}

export type CustomApiExecutionEligibilityState =
  | "executable"
  | "preview-only-not-found"
  | "preview-only-private"
  | "preview-only-unsupported-parameters"
  | "preview-only-bound-context-required"
  | "unknown-validation-unavailable";

export interface CustomApiExecutionEligibility {
  state: CustomApiExecutionEligibilityState;
  label: string;
  reason: string;
  odataName?: string;
  odataQualifiedName?: string;
  odataInvocationName?: string;
  odataKind?: CustomApiOperationKind;
  odataBindingKind?: CustomApiBindingKind;
  odataBoundTargetKind?: CustomApiBoundTargetKind;
  odataBoundEntityLogicalName?: string;
  odataBoundEntitySetName?: string;
  odataBindingParameterName?: string;
}

export type CustomApiExecutionCapabilityMode =
  | "executable"
  | "preview-only"
  | "inspect-only"
  | "validation-unavailable";

export interface CustomApiExecutionPolicyDecision {
  policyKind: "aiExecution";
  classification: "ai-related" | "non-ai";
  allowed: boolean;
  severity: "info" | "warning" | "blocked";
  reason: string;
  trustModel?: "probabilistic-generated-content";
  humanReviewRecommended?: boolean;
  generatedContentWarning?: boolean;
  externalProcessingPossible?: boolean;
}

export type CustomApiExecutionState =
  | "executable"
  | "preview-ready"
  | "partially-preview-ready"
  | "preview-only"
  | "stale"
  | "denied"
  | "failed"
  | "completed";

export interface CustomApiExecutionCapability {
  mode: CustomApiExecutionCapabilityMode;
  state: CustomApiExecutionState;
  label: string;
  reason: string;
  canPreview: boolean;
  canExecute: boolean;
  executionMethod?: "GET" | "POST";
  operationKind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  boundTargetKind?: CustomApiBoundTargetKind;
  boundTargetLabel?: string;
  boundTargetReason?: string;
  executionPolicy?: CustomApiExecutionPolicyDecision;
  actionReadiness?: import("../execution/actionExecutionReadiness.js").ActionExecutionReadiness;
}

export interface CustomApiDefinition {
  id: string;
  uniqueName: string;
  displayName?: string;
  description?: string;
  operationKind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  bindingType?: number;
  boundTargetKind?: CustomApiBoundTargetKind;
  boundTargetLabel?: string;
  boundTargetReason?: string;
  boundEntityLogicalName?: string;
  boundEntitySetName?: string;
  bindingParameterName?: string;
  executePrivilegeName?: string;
  allowedCustomProcessingStepType?: number;
  isPrivate?: boolean;
  requestParameters: CustomApiRequestParameter[];
  responseProperties: CustomApiResponseProperty[];
  previewReadyParameterCount?: number;
  inspectOnlyParameterCount?: number;
  executionReadiness?: "preview-ready" | "partial" | "inspect-only";
  executionReadinessLabel?: string;
  executionReadinessReason?: string;
  executionEligibility?: CustomApiExecutionEligibility;
  executionCapability?: CustomApiExecutionCapability;
  executionPolicy?: CustomApiExecutionPolicyDecision;
  actionReadiness?: import("../execution/actionExecutionReadiness.js").ActionExecutionReadiness;
}

export interface CustomApiCatalogueRow {
  uniqueName: string;
  displayName: string;
  operationKind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  boundTargetKind: CustomApiBoundTargetKind;
  boundTargetLabel: string;
  boundEntityLogicalName: string;
  boundEntitySetName: string;
  requestParameterCount: number;
  responsePropertyCount: number;
  requiredParameterCount: number;
  isPrivate: string;
  executePrivilegeName: string;
  allowedCustomProcessingStepType: string;
  description: string;
}
