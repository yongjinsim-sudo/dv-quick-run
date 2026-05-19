import type { CustomApiRequestParameter } from "../models/customApiTypes.js";

export type CustomApiSupportedParameterKind =
  | "primitive"
  | "enumLike"
  | "entityReference"
  | "primitiveArray"
  | "entityReferenceArray"
  | "unsupportedComplex"
  | "unknown";

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCustomApiParameterKind(parameter: CustomApiRequestParameter): string {
  return (parameter.typeLabel || parameter.type || "").trim().toLowerCase();
}

export function classifyCustomApiSupportedParameterKind(parameter: CustomApiRequestParameter): CustomApiSupportedParameterKind {
  const kind = getCustomApiParameterKind(parameter);

  if (["boolean", "datetime", "decimal", "float", "guid", "integer", "string"].includes(kind)) {
    return "primitive";
  }

  if (["picklist", "choice", "optionset", "option set"].includes(kind)) {
    return "enumLike";
  }

  if (["entityreference", "entity reference", "lookup"].includes(kind)) {
    return "entityReference";
  }

  if (["stringarray", "string array", "array<string>", "string[]"].includes(kind)) {
    return "primitiveArray";
  }

  if (["entityreferencearray", "entity reference array", "array<entityreference>", "entityreference[]", "lookup[]"].includes(kind)) {
    return "entityReferenceArray";
  }

  if (["entitycollection", "collection", "array"].includes(kind)) {
    return "unsupportedComplex";
  }

  if (["entity", "money", "complex"].includes(kind)) {
    return "unsupportedComplex";
  }

  return "unknown";
}

export function isCustomApiParameterPreviewShapeSupported(parameter: CustomApiRequestParameter): boolean {
  const kind = classifyCustomApiSupportedParameterKind(parameter);
  return kind === "primitive"
    || kind === "enumLike"
    || kind === "entityReference"
    || kind === "primitiveArray"
    || kind === "entityReferenceArray";
}

export function getCustomApiParameterPlaceholder(parameter: CustomApiRequestParameter): unknown {
  const kind = getCustomApiParameterKind(parameter);
  const supportedKind = classifyCustomApiSupportedParameterKind(parameter);

  if (kind === "boolean") {
    return false;
  }

  if (kind === "integer" || kind === "decimal" || kind === "float") {
    return 0;
  }

  if (kind === "guid") {
    return "00000000-0000-0000-0000-000000000000";
  }

  if (kind === "datetime") {
    return "2026-01-01T00:00:00Z";
  }

  if (supportedKind === "entityReference") {
    return {
      "@odata.type": "Microsoft.Dynamics.CRM.<entityLogicalName>",
      "<primaryIdAttribute>": "00000000-0000-0000-0000-000000000000"
    };
  }

  if (supportedKind === "primitiveArray") {
    return ["<value>"];
  }

  if (supportedKind === "entityReferenceArray") {
    return [getCustomApiParameterPlaceholder({ ...parameter, typeLabel: "EntityReference", type: "EntityReference" })];
  }

  if (kind === "string") {
    return `<${parameter.uniqueName}>`;
  }

  return `<inspect-only: ${parameter.typeLabel || parameter.type || "Unknown"}>`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateEntityReferenceValue(parameter: CustomApiRequestParameter, value: unknown): string | undefined {
  if (!isPlainObject(value)) {
    return `${parameter.uniqueName} must be an EntityReference JSON object.`;
  }

  const odataType = value["@odata.type"];
  if (typeof odataType !== "string" || !/^Microsoft\.Dynamics\.CRM\.[A-Za-z0-9_]+$/.test(odataType.trim())) {
    return `${parameter.uniqueName} must include @odata.type like Microsoft.Dynamics.CRM.account.`;
  }

  const idProperties = Object.entries(value).filter(([name, propertyValue]) => name !== "@odata.type" && typeof propertyValue === "string" && GUID_PATTERN.test(propertyValue.trim()));
  if (idProperties.length !== 1) {
    return `${parameter.uniqueName} must include exactly one GUID id property beside @odata.type.`;
  }

  return undefined;
}

function parsePrimitiveParameterValue(parameter: CustomApiRequestParameter, rawValue: unknown): unknown {
  const kind = getCustomApiParameterKind(parameter);
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : String(rawValue).trim();

  if (kind === "boolean") {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }

    if (/^true$/i.test(trimmed)) {
      return true;
    }

    if (/^false$/i.test(trimmed)) {
      return false;
    }

    throw new Error(`${parameter.uniqueName} must be true or false.`);
  }

  if (kind === "integer") {
    if (typeof rawValue === "number" && Number.isInteger(rawValue)) {
      return rawValue;
    }

    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`${parameter.uniqueName} must be an integer.`);
    }

    return Number.parseInt(trimmed, 10);
  }

  if (kind === "decimal" || kind === "float") {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${parameter.uniqueName} must be a number.`);
    }

    return parsed;
  }

  if (kind === "guid") {
    if (!GUID_PATTERN.test(trimmed)) {
      throw new Error(`${parameter.uniqueName} must be a valid GUID.`);
    }

    return trimmed;
  }

  if (kind === "datetime") {
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      throw new Error(`${parameter.uniqueName} must be a valid date/time value.`);
    }

    return trimmed;
  }

  return typeof rawValue === "string" ? rawValue : trimmed;
}

export function validateCustomApiParameterValue(parameter: CustomApiRequestParameter, value: unknown): string | undefined {
  const supportedKind = classifyCustomApiSupportedParameterKind(parameter);

  try {
    if (supportedKind === "primitive" || supportedKind === "enumLike") {
      parsePrimitiveParameterValue(parameter, value);
      return undefined;
    }

    if (supportedKind === "entityReference") {
      return validateEntityReferenceValue(parameter, value);
    }

    if (supportedKind === "primitiveArray") {
      if (!Array.isArray(value)) {
        return `${parameter.uniqueName} must be an array.`;
      }

      const elementParameter: CustomApiRequestParameter = { ...parameter, typeLabel: "String", type: "String" };
      for (const item of value) {
        parsePrimitiveParameterValue(elementParameter, item);
      }

      return undefined;
    }

    if (supportedKind === "entityReferenceArray") {
      if (!Array.isArray(value)) {
        return `${parameter.uniqueName} must be an array of EntityReference objects.`;
      }

      for (const item of value) {
        const error = validateEntityReferenceValue(parameter, item);
        if (error) {
          return error;
        }
      }

      return undefined;
    }

    return `${parameter.uniqueName} has unsupported parameter type ${parameter.typeLabel || parameter.type || "Unknown"}.`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function parseCustomApiParameterValue(parameter: CustomApiRequestParameter, value: unknown): unknown {
  const error = validateCustomApiParameterValue(parameter, value);
  if (error) {
    throw new Error(error);
  }

  const supportedKind = classifyCustomApiSupportedParameterKind(parameter);
  if (supportedKind === "primitive" || supportedKind === "enumLike") {
    return parsePrimitiveParameterValue(parameter, value);
  }

  return value;
}
