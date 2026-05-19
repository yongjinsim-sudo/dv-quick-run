import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";
import { openMetadataAwareJsonPayloadEditor } from "../../webview/payloadEditor/metadataAwareJsonPayloadEditor.js";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { loadChoiceMetadata } from "../../commands/router/actions/shared/metadataAccess.js";
import type { ChoiceMetadata } from "../../metadata/metadataModel.js";
import { classifyCustomApiSupportedParameterKind, getCustomApiParameterKind, getCustomApiParameterPlaceholder, parseCustomApiParameterValue, validateCustomApiParameterValue } from "./customApiParameterSupport.js";

export type CustomApiActionPreviewParameterValues = Record<string, unknown>;

type EnrichedActionPreviewParameter = CustomApiRequestParameter & {
  entityChoiceMetadata?: ChoiceMetadata;
};

function getEntityChoiceMetadata(parameter: CustomApiRequestParameter): ChoiceMetadata | undefined {
  return (parameter as EnrichedActionPreviewParameter).entityChoiceMetadata;
}

function formatChoiceOptions(choice: ChoiceMetadata): string {
  return choice.options.map((option) => `${String(option.value)} = ${option.label}`).join(", ");
}

function isStringParameter(parameter: CustomApiRequestParameter): boolean {
  return getCustomApiParameterKind(parameter) === "string";
}

function getChoiceHintDefault(parameter: CustomApiRequestParameter, choice: ChoiceMetadata): unknown {
  const first = choice.options[0];
  if (!first) {
    return `<${parameter.uniqueName}>`;
  }

  return isStringParameter(parameter) ? String(first.value) : first.value;
}

function getChoiceHintValues(parameter: CustomApiRequestParameter): Array<{ value: string | number | boolean; label: string }> | undefined {
  const choice = getEntityChoiceMetadata(parameter);
  if (!choice) {
    return undefined;
  }

  return choice.options.map((option) => ({
    value: isStringParameter(parameter) ? String(option.value) : option.value,
    label: option.label
  }));
}

function isRequired(parameter: CustomApiRequestParameter): boolean {
  return parameter.isOptional !== true;
}

function isPreviewReady(parameter: CustomApiRequestParameter): boolean {
  return parameter.executionSupport === "preview-ready";
}

function isBindingParameter(definition: CustomApiDefinition, parameter: CustomApiRequestParameter): boolean {
  if (definition.bindingKind !== "Bound") {
    return false;
  }

  const bindingName = (definition.bindingParameterName || definition.executionEligibility?.odataBindingParameterName || "").trim();
  return Boolean(bindingName) && parameter.uniqueName.localeCompare(bindingName, undefined, { sensitivity: "accent" }) === 0;
}

function getPromptablePreviewParameters(definition: CustomApiDefinition): CustomApiRequestParameter[] {
  return definition.requestParameters.filter((parameter) => isPreviewReady(parameter) && !isBindingParameter(definition, parameter));
}

function parsePreviewParameterValue(parameter: CustomApiRequestParameter, rawValue: unknown): unknown {
  const kind = getCustomApiParameterKind(parameter);

  if (kind === "picklist") {
    const choice = getEntityChoiceMetadata(parameter);
    if (!choice) {
      throw new Error(`${parameter.uniqueName} choice metadata is unavailable.`);
    }

    if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
      throw new Error(`${parameter.uniqueName} must use a numeric choice value. Allowed values: ${formatChoiceOptions(choice)}.`);
    }

    if (!choice.options.some((option) => option.value === rawValue)) {
      throw new Error(`${parameter.uniqueName} must be one of: ${formatChoiceOptions(choice)}.`);
    }

    return rawValue;
  }

  return parseCustomApiParameterValue(parameter, rawValue);
}

function getPreviewPlaceholder(parameter: CustomApiRequestParameter): unknown {
  const choice = getEntityChoiceMetadata(parameter);
  if (choice) {
    return getChoiceHintDefault(parameter, choice);
  }

  return getCustomApiParameterPlaceholder(parameter);
}

function buildPreviewPayloadTemplate(parameters: readonly CustomApiRequestParameter[]): Record<string, unknown> {
  return parameters.reduce<Record<string, unknown>>((payload, parameter) => {
    payload[parameter.uniqueName] = getPreviewPlaceholder(parameter);
    return payload;
  }, {});
}

function validatePreviewPayloadShape(
  payload: unknown,
  parameters: readonly CustomApiRequestParameter[]
): string | undefined {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return "Preview payload must be a JSON object.";
  }

  const payloadRecord = payload as Record<string, unknown>;
  const knownParameterNames = new Set(parameters.map((parameter) => parameter.uniqueName));
  const unknownProperties = Object.keys(payloadRecord).filter((name) => !knownParameterNames.has(name));
  if (unknownProperties.length > 0) {
    return `Unknown preview payload propert${unknownProperties.length === 1 ? "y" : "ies"}: ${unknownProperties.join(", ")}.`;
  }

  const missingRequired = parameters
    .filter((parameter) => isRequired(parameter))
    .filter((parameter) => payloadRecord[parameter.uniqueName] === undefined || payloadRecord[parameter.uniqueName] === null)
    .map((parameter) => parameter.uniqueName);

  if (missingRequired.length > 0) {
    return `Missing required preview payload value${missingRequired.length === 1 ? "" : "s"}: ${missingRequired.join(", ")}.`;
  }

  for (const parameter of parameters) {
    const value = payloadRecord[parameter.uniqueName];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      continue;
    }

    if (getCustomApiParameterKind(parameter) === "picklist") {
      try {
        parsePreviewParameterValue(parameter, value);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      continue;
    }

    const validationError = validateCustomApiParameterValue(parameter, value);
    if (validationError) {
      return validationError;
    }
  }

  return undefined;
}

function parsePreviewPayloadValues(
  payload: Record<string, unknown>,
  parameters: readonly CustomApiRequestParameter[]
): CustomApiActionPreviewParameterValues {
  const values: CustomApiActionPreviewParameterValues = {};

  for (const parameter of parameters) {
    const value = payload[parameter.uniqueName];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      continue;
    }

    values[parameter.uniqueName] = parsePreviewParameterValue(parameter, value);
  }

  return values;
}

export function shouldPromptForCustomApiActionPreviewParameters(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && getPromptablePreviewParameters(definition).length > 0;
}

async function enrichParametersFromBoundEntityMetadata(
  definition: CustomApiDefinition,
  parameters: readonly CustomApiRequestParameter[],
  ctx?: CommandContext
): Promise<EnrichedActionPreviewParameter[]> {
  const boundEntityLogicalName = definition.executionEligibility?.odataBoundEntityLogicalName
    ?? definition.boundEntityLogicalName;

  if (!ctx || !boundEntityLogicalName || parameters.length === 0) {
    return parameters.map((parameter) => ({ ...parameter }));
  }

  try {
    const client = ctx.getClient();
    const token = await ctx.getToken(ctx.getScope());
    const choices = await loadChoiceMetadata(ctx, client, token, boundEntityLogicalName, { silent: true });
    const choicesByField = new Map(choices.map((choice) => [choice.fieldLogicalName.toLowerCase(), choice]));

    return parameters.map((parameter) => {
      const choice = choicesByField.get(parameter.uniqueName.toLowerCase())
        ?? (parameter.logicalName ? choicesByField.get(parameter.logicalName.toLowerCase()) : undefined);

      return choice
        ? {
            ...parameter,
            typeDescription: `${parameter.typeDescription || parameter.executionSupportReason || "Custom API parameter metadata."} Entity attribute hint: ${choice.attributeType || "Choice"} from ${boundEntityLogicalName}.${choice.fieldLogicalName}. Suggested values: ${formatChoiceOptions(choice)}.`,
            entityChoiceMetadata: choice
          }
        : { ...parameter };
    });
  } catch {
    return parameters.map((parameter) => ({ ...parameter }));
  }
}

export async function promptForCustomApiActionPreviewParameters(
  definition: CustomApiDefinition,
  initialValues?: CustomApiActionPreviewParameterValues,
  environmentName?: string,
  ctx?: CommandContext
): Promise<CustomApiActionPreviewParameterValues | undefined> {
  const promptableParameters = await enrichParametersFromBoundEntityMetadata(definition, getPromptablePreviewParameters(definition), ctx);

  if (promptableParameters.some((parameter) => getEntityChoiceMetadata(parameter))) {
    const enrichedByName = new Map(promptableParameters.map((parameter) => [parameter.uniqueName.toLowerCase(), parameter]));
    definition.requestParameters = definition.requestParameters.map((parameter) => {
      const enriched = enrichedByName.get(parameter.uniqueName.toLowerCase());
      return enriched ? { ...parameter, ...enriched } : parameter;
    });
  }

  const payloadTemplate = {
    ...buildPreviewPayloadTemplate(promptableParameters),
    ...(initialValues ?? {})
  };
  const payloadJson = JSON.stringify(payloadTemplate, null, 2);

  const value = await openMetadataAwareJsonPayloadEditor({
    title: `DV Quick Run: Preview payload for ${definition.displayName || definition.uniqueName}`,
    operationName: definition.displayName || definition.uniqueName,
    environmentName,
    routePreview: definition.executionEligibility?.odataInvocationName || definition.uniqueName,
    payloadJson,
    fields: promptableParameters.map((parameter) => ({
      name: parameter.uniqueName,
      type: parameter.typeLabel || parameter.type,
      required: isRequired(parameter),
      description: parameter.typeDescription || parameter.executionSupportReason || parameter.displayName || parameter.logicalName || parameter.uniqueName,
      previewSupport: parameter.executionSupport,
      trust: parameter.typeCategory,
      allowedValues: getChoiceHintValues(parameter),
      allowedValuesLabel: getEntityChoiceMetadata(parameter) ? "Suggested values from bound entity metadata" : undefined,
      parameterKind: classifyCustomApiSupportedParameterKind(parameter),
      source: getEntityChoiceMetadata(parameter)
        ? `Execution contract: Custom API parameter metadata. Advisory hint: ${getEntityChoiceMetadata(parameter)?.entityLogicalName}.${getEntityChoiceMetadata(parameter)?.fieldLogicalName}.`
        : "Execution contract: Custom API parameter metadata."
    })),
    validatePayload: (input) => {
      try {
        const parsed = JSON.parse(input) as unknown;
        return validatePreviewPayloadShape(parsed, promptableParameters);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }
  });

  if (value === undefined) {
    return undefined;
  }

  const parsed = JSON.parse(value) as Record<string, unknown>;
  return parsePreviewPayloadValues(parsed, promptableParameters);
}
