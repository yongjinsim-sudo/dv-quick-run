export type CustomApiOperationKind = "Action" | "Function";

export type CustomApiBindingKind = "Bound" | "Unbound" | "Unknown";

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
}

export interface CustomApiDefinition {
  id: string;
  uniqueName: string;
  displayName?: string;
  description?: string;
  operationKind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  bindingType?: number;
  boundEntityLogicalName?: string;
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
}

export interface CustomApiCatalogueRow {
  uniqueName: string;
  displayName: string;
  operationKind: CustomApiOperationKind;
  bindingKind: CustomApiBindingKind;
  boundEntityLogicalName: string;
  requestParameterCount: number;
  responsePropertyCount: number;
  requiredParameterCount: number;
  isPrivate: string;
  executePrivilegeName: string;
  allowedCustomProcessingStepType: string;
  description: string;
}
