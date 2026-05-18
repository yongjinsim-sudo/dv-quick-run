import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";
import { openMetadataAwareJsonPayloadEditor } from "../../webview/payloadEditor/metadataAwareJsonPayloadEditor.js";
import { canExecuteCustomApiActionDefinition, canExecuteCustomApiFunctionDefinition } from "./customApiExecutionCapabilityResolver.js";
import { buildCustomApiActionInvocationPath, buildCustomApiFunctionInvocationPath } from "./customApiInvocationPathBuilder.js";

export type CustomApiFunctionParameterValues = Record<string, unknown>;

export interface CustomApiFunctionExecutionPlan {
  path: string;
  method: "GET" | "POST";
  requestPreview: string;
  values: CustomApiFunctionParameterValues;
  body?: Record<string, unknown>;
}

export function canExecuteCustomApiFunction(definition: CustomApiDefinition): boolean {
  return canExecuteCustomApiFunctionDefinition(definition);
}

export function canExecuteCustomApiAction(definition: CustomApiDefinition): boolean {
  return canExecuteCustomApiActionDefinition(definition);
}

function isEntityBoundAction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && definition.bindingKind === "Bound"
    && (definition.boundTargetKind === "entity" || definition.executionEligibility?.odataBoundTargetKind === "entity");
}

function isCollectionBoundAction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && definition.bindingKind === "Bound"
    && (definition.boundTargetKind === "collection" || definition.executionEligibility?.odataBoundTargetKind === "collection");
}

function isBindingParameter(definition: CustomApiDefinition, parameter: CustomApiRequestParameter): boolean {
  if (definition.bindingKind !== "Bound") {
    return false;
  }

  const bindingName = (definition.bindingParameterName || definition.executionEligibility?.odataBindingParameterName || "").trim();
  return Boolean(bindingName) && parameter.uniqueName.localeCompare(bindingName, undefined, { sensitivity: "accent" }) === 0;
}

function hasOnlyPreviewReadyActionParameters(definition: CustomApiDefinition): boolean {
  return definition.requestParameters
    .filter((parameter) => !isBindingParameter(definition, parameter))
    .every((parameter) => parameter.executionSupport === "preview-ready");
}

function hasResolvedBoundRoute(definition: CustomApiDefinition): boolean {
  const entitySetName = definition.boundEntitySetName || definition.executionEligibility?.odataBoundEntitySetName || "";
  return entitySetName.trim().length > 0 && entitySetName !== "<entity-set-unresolved>";
}


export function canExecuteCustomApiCollectionBoundAction(definition: CustomApiDefinition): boolean {
  const eligibilityState = definition.executionEligibility?.state;

  return isCollectionBoundAction(definition)
    && definition.isPrivate !== true
    && hasResolvedBoundRoute(definition)
    && hasOnlyPreviewReadyActionParameters(definition)
    && (definition.executionReadiness === "preview-ready" || definition.executionReadiness === undefined)
    && (eligibilityState === "executable" || eligibilityState === "preview-only-bound-context-required");
}

export function canExecuteCustomApiEntityBoundAction(definition: CustomApiDefinition, boundTargetRowId: string | undefined): boolean {
  const eligibilityState = definition.executionEligibility?.state;

  return isEntityBoundAction(definition)
    && definition.isPrivate !== true
    && Boolean(boundTargetRowId?.trim())
    && hasResolvedBoundRoute(definition)
    && hasOnlyPreviewReadyActionParameters(definition)
    && (definition.executionReadiness === "preview-ready" || definition.executionReadiness === undefined)
    && (eligibilityState === "executable" || eligibilityState === "preview-only-bound-context-required");
}

function getParameterKind(parameter: CustomApiRequestParameter): string {
  return (parameter.typeLabel || parameter.type || "").trim().toLowerCase();
}

function isRequired(parameter: CustomApiRequestParameter): boolean {
  return parameter.isOptional !== true;
}

function parseParameterValue(parameter: CustomApiRequestParameter, rawValue: string): unknown {
  const kind = getParameterKind(parameter);
  const trimmed = rawValue.trim();

  if (kind === "boolean") {
    if (/^true$/i.test(trimmed)) {
      return true;
    }

    if (/^false$/i.test(trimmed)) {
      return false;
    }

    throw new Error(`${parameter.uniqueName} must be true or false.`);
  }

  if (kind === "integer") {
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`${parameter.uniqueName} must be an integer.`);
    }

    return Number.parseInt(trimmed, 10);
  }

  if (kind === "decimal" || kind === "float") {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${parameter.uniqueName} must be a number.`);
    }

    return parsed;
  }

  if (kind === "guid") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      throw new Error(`${parameter.uniqueName} must be a valid GUID.`);
    }

    return trimmed;
  }

  return trimmed;
}

function getPlaceholder(parameter: CustomApiRequestParameter): string {
  const kind = getParameterKind(parameter);

  if (kind === "boolean") {
    return "true or false";
  }

  if (kind === "integer") {
    return "0";
  }

  if (kind === "decimal" || kind === "float") {
    return "0";
  }

  if (kind === "guid") {
    return "00000000-0000-0000-0000-000000000000";
  }

  if (kind === "datetime") {
    return "2026-01-01T00:00:00Z";
  }

  return `<${parameter.uniqueName}>`;
}

function getEditorPlaceholder(parameter: CustomApiRequestParameter): unknown {
  const kind = getParameterKind(parameter);

  if (kind === "boolean") {
    return false;
  }

  if (kind === "integer" || kind === "decimal" || kind === "float") {
    return 0;
  }

  return getPlaceholder(parameter);
}

function buildFunctionParameterTemplate(parameters: readonly CustomApiRequestParameter[]): Record<string, unknown> {
  return parameters.reduce<Record<string, unknown>>((payload, parameter) => {
    payload[parameter.uniqueName] = getEditorPlaceholder(parameter);
    return payload;
  }, {});
}

function validateFunctionParameterPayload(
  payload: unknown,
  parameters: readonly CustomApiRequestParameter[]
): string | undefined {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return "Function parameters must be provided as a JSON object.";
  }

  const payloadRecord = payload as Record<string, unknown>;
  const knownParameterNames = new Set(parameters.map((parameter) => parameter.uniqueName));
  const unknownProperties = Object.keys(payloadRecord).filter((name) => !knownParameterNames.has(name));
  if (unknownProperties.length > 0) {
    return `Unknown Function parameter${unknownProperties.length === 1 ? "" : "s"}: ${unknownProperties.join(", ")}.`;
  }

  const missingRequired = parameters
    .filter((parameter) => isRequired(parameter))
    .filter((parameter) => payloadRecord[parameter.uniqueName] === undefined || payloadRecord[parameter.uniqueName] === null || String(payloadRecord[parameter.uniqueName]).trim() === "")
    .map((parameter) => parameter.uniqueName);

  if (missingRequired.length > 0) {
    return `Missing required Function parameter${missingRequired.length === 1 ? "" : "s"}: ${missingRequired.join(", ")}.`;
  }

  for (const parameter of parameters) {
    const value = payloadRecord[parameter.uniqueName];
    if (value === undefined || value === null || String(value).trim() === "") {
      continue;
    }

    try {
      parseParameterValue(parameter, String(value));
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  return undefined;
}

function parseFunctionParameterPayload(
  payload: Record<string, unknown>,
  parameters: readonly CustomApiRequestParameter[]
): CustomApiFunctionParameterValues {
  const values: CustomApiFunctionParameterValues = {};

  for (const parameter of parameters) {
    const value = payload[parameter.uniqueName];
    if (value === undefined || value === null || String(value).trim() === "") {
      continue;
    }

    values[parameter.uniqueName] = parseParameterValue(parameter, String(value));
  }

  return values;
}

export async function promptForCustomApiFunctionParameters(
  definition: CustomApiDefinition,
  initialValues?: CustomApiFunctionParameterValues,
  environmentName?: string
): Promise<CustomApiFunctionParameterValues | undefined> {
  const parameters = definition.requestParameters;
  if (parameters.length === 0) {
    return {};
  }

  const payloadTemplate = {
    ...buildFunctionParameterTemplate(parameters),
    ...(initialValues ?? {})
  };

  const value = await openMetadataAwareJsonPayloadEditor({
    title: `DV Quick Run: Preview parameters for ${definition.displayName || definition.uniqueName}`,
    operationName: definition.displayName || definition.uniqueName,
    environmentName,
    routePreview: definition.executionEligibility?.odataInvocationName || definition.uniqueName,
    payloadJson: JSON.stringify(payloadTemplate, null, 2),
    fields: parameters.map((parameter) => ({
      name: parameter.uniqueName,
      type: parameter.typeLabel || parameter.type,
      required: isRequired(parameter),
      description: parameter.typeDescription || parameter.executionSupportReason || parameter.displayName || parameter.logicalName || parameter.uniqueName,
      previewSupport: parameter.executionSupport,
      trust: parameter.typeCategory
    })),
    validatePayload: (input) => {
      try {
        const parsed = JSON.parse(input) as unknown;
        return validateFunctionParameterPayload(parsed, parameters);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }
  });

  if (value === undefined) {
    return undefined;
  }

  const parsed = JSON.parse(value) as Record<string, unknown>;
  return parseFunctionParameterPayload(parsed, parameters);
}

export function buildCustomApiFunctionExecutionPath(
  definition: CustomApiDefinition,
  values: CustomApiFunctionParameterValues
): string {
  if (!canExecuteCustomApiFunction(definition)) {
    throw new Error("Only preview-ready unbound Custom API Functions can be executed.");
  }

  return buildCustomApiFunctionInvocationPath(definition, values);
}

export function buildCustomApiFunctionExecutionPlan(
  definition: CustomApiDefinition,
  values: CustomApiFunctionParameterValues,
  baseUrl: string
): CustomApiFunctionExecutionPlan {
  const path = buildCustomApiFunctionExecutionPath(definition, values);
  const url = `${baseUrl.replace(/\/+$/, "")}/api/data/v9.2${path}`;
  return {
    path,
    method: "GET",
    values,
    requestPreview: [
      `GET ${url} HTTP/1.1`,
      "Accept: application/json",
      "OData-Version: 4.0",
      "OData-MaxVersion: 4.0"
    ].join("\n")
  };
}

export function buildCustomApiActionExecutionPath(definition: CustomApiDefinition, boundTargetRowId?: string): string {
  if (!canExecuteCustomApiAction(definition) && !canExecuteCustomApiEntityBoundAction(definition, boundTargetRowId) && !canExecuteCustomApiCollectionBoundAction(definition)) {
    throw new Error("Only preview-ready public Custom API Actions with validated execution context can be executed.");
  }

  return buildCustomApiActionInvocationPath(definition, { boundTargetRowId });
}

export function buildCustomApiActionExecutionPlan(
  definition: CustomApiDefinition,
  values: CustomApiFunctionParameterValues,
  baseUrl: string,
  options: { boundTargetRowId?: string } = {}
): CustomApiFunctionExecutionPlan {
  const path = buildCustomApiActionExecutionPath(definition, options.boundTargetRowId);
  const url = `${baseUrl.replace(/\/+$/, "")}/api/data/v9.2${path}`;
  const body = { ...values };

  return {
    path,
    method: "POST",
    values,
    body,
    requestPreview: [
      `POST ${url} HTTP/1.1`,
      "Accept: application/json",
      "Content-Type: application/json",
      "OData-Version: 4.0",
      "OData-MaxVersion: 4.0",
      "",
      JSON.stringify(body, null, 2)
    ].join("\n")
  };
}
