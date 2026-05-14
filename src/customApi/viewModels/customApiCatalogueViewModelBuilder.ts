import type {
  CustomApiCatalogueRow,
  CustomApiDefinition
} from "../models/customApiTypes.js";

function displayText(value: string | undefined): string {
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

export function buildCustomApiCatalogueRows(
  definitions: CustomApiDefinition[]
): CustomApiCatalogueRow[] {
  return definitions.map((definition) => ({
    uniqueName: definition.uniqueName,
    displayName: displayText(definition.displayName),
    operationKind: definition.operationKind,
    bindingKind: definition.bindingKind,
    boundEntityLogicalName: displayText(definition.boundEntityLogicalName),
    requestParameterCount: definition.requestParameters.length,
    responsePropertyCount: definition.responseProperties.length,
    requiredParameterCount: countRequiredParameters(definition),
    isPrivate: displayBoolean(definition.isPrivate),
    executePrivilegeName: displayText(definition.executePrivilegeName),
    allowedCustomProcessingStepType: displayNumber(definition.allowedCustomProcessingStepType),
    description: displayText(definition.description)
  }));
}

export function buildCustomApiCatalogueResult(
  definitions: CustomApiDefinition[]
): { value: CustomApiCatalogueRow[] } {
  return {
    value: buildCustomApiCatalogueRows(definitions)
  };
}
