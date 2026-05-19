import type { CustomApiBindingKind, CustomApiBoundTargetKind, CustomApiDefinition, CustomApiOperationKind } from "../customApi/models/customApiTypes.js";

export interface CapabilityExplorerMetric {
  id: string;
  label: string;
  value: number;
  detail: string;
  tone: "primary" | "action" | "function" | "visibility";
  icon: string;
}

export interface CapabilityExplorerCustomApiRow {
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

export interface CapabilityExplorerAccessRestrictionViewModel {
  title: string;
  message: string;
  principalId: string;
  missingPrivilege: string;
  entityLogicalName: string;
  statusCode: string;
  correlationId: string;
}

export interface CapabilityExplorerViewModel {
  title: string;
  subtitle: string;
  environmentName: string;
  environmentUrl: string;
  generatedAt: string;
  metrics: CapabilityExplorerMetric[];
  customApis: CapabilityExplorerCustomApiRow[];
  customApiCount: number;
  boundCount: number;
  unboundCount: number;
  privateCount: number;
  publicCount: number;
  actionCount: number;
  functionCount: number;
  definitions: CustomApiDefinition[];
  accessRestriction?: CapabilityExplorerAccessRestrictionViewModel;
}
