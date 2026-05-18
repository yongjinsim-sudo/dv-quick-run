import type { CustomApiDefinition } from "../customApi/models/customApiTypes.js";
import type { CapabilityExplorerCustomApiRow, CapabilityExplorerMetric, CapabilityExplorerViewModel } from "./capabilityExplorerTypes.js";

interface CapabilityExplorerEnvironmentContext {
  name?: string;
  url?: string;
}

function displayText(value: string | undefined): string {
  return value?.trim() || "—";
}

function displayOptionalText(value: string | undefined): string {
  return value?.trim() || "";
}

function displayBoolean(value: boolean | undefined): string {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "";
}

function displayNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "";
}

function countRequiredParameters(definition: CustomApiDefinition): number {
  return definition.requestParameters.filter((parameter) => parameter.isOptional !== true).length;
}

function buildCustomApiRow(definition: CustomApiDefinition): CapabilityExplorerCustomApiRow {
  return {
    uniqueName: definition.uniqueName,
    displayName: displayOptionalText(definition.displayName) || definition.uniqueName,
    operationKind: definition.operationKind,
    bindingKind: definition.bindingKind,
    boundTargetKind: definition.boundTargetKind ?? (definition.bindingKind === "Bound" ? "unknown" : "none"),
    boundTargetLabel: displayText(definition.boundTargetLabel),
    boundEntityLogicalName: displayText(definition.boundEntityLogicalName),
    boundEntitySetName: displayText(definition.boundEntitySetName || definition.executionEligibility?.odataBoundEntitySetName),
    requestParameterCount: definition.requestParameters.length,
    responsePropertyCount: definition.responseProperties.length,
    requiredParameterCount: countRequiredParameters(definition),
    isPrivate: displayBoolean(definition.isPrivate),
    executePrivilegeName: displayOptionalText(definition.executePrivilegeName),
    allowedCustomProcessingStepType: displayNumber(definition.allowedCustomProcessingStepType),
    description: displayOptionalText(definition.description)
  };
}

function buildMetrics(definitions: readonly CustomApiDefinition[]): CapabilityExplorerMetric[] {
  const customApiCount = definitions.length;
  const boundCount = definitions.filter((definition) => definition.bindingKind === "Bound").length;
  const unboundCount = definitions.filter((definition) => definition.bindingKind === "Unbound").length;
  const actionCount = definitions.filter((definition) => definition.operationKind === "Action").length;
  const functionCount = definitions.filter((definition) => definition.operationKind === "Function").length;
  const privateCount = definitions.filter((definition) => definition.isPrivate === true).length;
  const publicCount = definitions.filter((definition) => definition.isPrivate === false).length;

  return [
    {
      id: "custom-apis",
      label: "Custom APIs",
      value: customApiCount,
      detail: `${boundCount} bound • ${unboundCount} unbound`,
      tone: "primary",
      icon: "link"
    },
    {
      id: "actions",
      label: "Actions",
      value: actionCount,
      detail: "POST operations, may have side effects",
      tone: "action",
      icon: "bolt"
    },
    {
      id: "functions",
      label: "Functions",
      value: functionCount,
      detail: "GET-style operations where exposed by Dataverse",
      tone: "function",
      icon: "function"
    },
    {
      id: "visibility",
      label: "Visibility",
      value: publicCount,
      detail: `${privateCount} private APIs also discovered`,
      tone: "visibility",
      icon: "eye"
    }
  ];
}

export function buildCapabilityExplorerViewModel(
  definitions: CustomApiDefinition[],
  environment: CapabilityExplorerEnvironmentContext
): CapabilityExplorerViewModel {
  const boundCount = definitions.filter((definition) => definition.bindingKind === "Bound").length;
  const unboundCount = definitions.filter((definition) => definition.bindingKind === "Unbound").length;
  const privateCount = definitions.filter((definition) => definition.isPrivate === true).length;
  const actionCount = definitions.filter((definition) => definition.operationKind === "Action").length;
  const functionCount = definitions.filter((definition) => definition.operationKind === "Function").length;

  return {
    title: "Capability Explorer",
    subtitle: "Discover operational capabilities available in this Dataverse environment. Execution remains preview-first and explicit.",
    environmentName: displayOptionalText(environment.name) || "No active environment",
    environmentUrl: displayOptionalText(environment.url),
    generatedAt: new Date().toLocaleString(),
    metrics: buildMetrics(definitions),
    customApis: definitions.map(buildCustomApiRow),
    customApiCount: definitions.length,
    boundCount,
    unboundCount,
    privateCount,
    publicCount: definitions.length - privateCount,
    actionCount,
    functionCount,
    definitions
  };
}
