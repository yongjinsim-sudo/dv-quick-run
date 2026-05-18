import type { CustomApiDefinition } from "../models/customApiTypes.js";

export type CustomApiInvocationParameterValues = Record<string, unknown>;

export interface CustomApiInvocationPathOptions {
  encodeAliasValues?: boolean;
  boundTargetRowId?: string;
}

export function resolveCustomApiODataInvocationName(definition: CustomApiDefinition): string {
  return definition.executionEligibility?.odataInvocationName
    || definition.executionEligibility?.odataName
    || (definition.operationKind === "Action" ? `Microsoft.Dynamics.CRM.${definition.uniqueName}` : definition.uniqueName);
}

function encodeODataStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toODataLiteral(value: unknown): string {
  if (typeof value === "string") {
    return encodeODataStringLiteral(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return encodeODataStringLiteral(String(value ?? ""));
}

function encodeAliasLiteral(value: unknown): string {
  if (typeof value === "string") {
    return `'${encodeURIComponent(value.replace(/'/g, "''"))}'`;
  }

  return encodeURIComponent(toODataLiteral(value));
}

function formatAliasLiteral(value: unknown, encodeAliasValues: boolean): string {
  return encodeAliasValues ? encodeAliasLiteral(value) : toODataLiteral(value);
}

function getBoundTargetKind(definition: CustomApiDefinition): string | undefined {
  return definition.boundTargetKind || definition.executionEligibility?.odataBoundTargetKind;
}

function getBoundEntitySetName(definition: CustomApiDefinition): string {
  return definition.boundEntitySetName
    || definition.executionEligibility?.odataBoundEntitySetName
    || "<entity-set-unresolved>";
}

function getBoundOperationPrefix(definition: CustomApiDefinition, boundTargetRowId?: string): string {
  const entitySetName = getBoundEntitySetName(definition);

  if (getBoundTargetKind(definition) === "collection") {
    return `/${entitySetName}`;
  }

  const recordId = boundTargetRowId?.trim() || "{record-id}";
  return `/${entitySetName}(${recordId})`;
}

export function buildCustomApiFunctionInvocationPath(
  definition: CustomApiDefinition,
  values: CustomApiInvocationParameterValues = {},
  options: CustomApiInvocationPathOptions = {}
): string {
  const operationName = resolveCustomApiODataInvocationName(definition);
  const parameters = definition.requestParameters.filter((parameter) => Object.prototype.hasOwnProperty.call(values, parameter.uniqueName));
  const operationPrefix = definition.bindingKind === "Bound" ? getBoundOperationPrefix(definition, options.boundTargetRowId) : "";

  if (parameters.length === 0) {
    return `${operationPrefix}/${operationName}()`;
  }

  const aliases = parameters.map((parameter) => `${parameter.uniqueName}=@${parameter.uniqueName}`).join(",");
  const query = parameters
    .map((parameter) => `@${parameter.uniqueName}=${formatAliasLiteral(values[parameter.uniqueName], options.encodeAliasValues !== false)}`)
    .join("&");

  return `${operationPrefix}/${operationName}(${aliases})?${query}`;
}

export function buildCustomApiActionInvocationPath(
  definition: CustomApiDefinition,
  options: Pick<CustomApiInvocationPathOptions, "boundTargetRowId"> = {}
): string {
  const operationName = resolveCustomApiODataInvocationName(definition);
  const operationPrefix = definition.bindingKind === "Bound" ? getBoundOperationPrefix(definition, options.boundTargetRowId) : "";
  return `${operationPrefix}/${operationName}`;
}

export function buildCustomApiPreviewInvocationPath(
  definition: CustomApiDefinition,
  values: CustomApiInvocationParameterValues = {},
  options: Pick<CustomApiInvocationPathOptions, "boundTargetRowId"> = {}
): string {
  if (definition.operationKind === "Function") {
    return buildCustomApiFunctionInvocationPath(definition, values, {
      encodeAliasValues: false,
      boundTargetRowId: options.boundTargetRowId
    });
  }

  return buildCustomApiActionInvocationPath(definition, options);
}
