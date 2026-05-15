import * as vscode from "vscode";
import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";

export type CustomApiActionPreviewParameterValues = Record<string, unknown>;

function getParameterKind(parameter: CustomApiRequestParameter): string {
  return (parameter.typeLabel || parameter.type || "").trim().toLowerCase();
}

function isRequired(parameter: CustomApiRequestParameter): boolean {
  return parameter.isOptional !== true;
}

function isPreviewReady(parameter: CustomApiRequestParameter): boolean {
  return parameter.executionSupport === "preview-ready";
}

function parsePreviewParameterValue(parameter: CustomApiRequestParameter, rawValue: string): unknown {
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

  if (kind === "datetime") {
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      throw new Error(`${parameter.uniqueName} must be a valid date/time value.`);
    }

    return trimmed;
  }

  return trimmed;
}

function getPreviewPlaceholder(parameter: CustomApiRequestParameter): string {
  const kind = getParameterKind(parameter);

  if (kind === "boolean") {
    return "true or false";
  }

  if (kind === "integer" || kind === "decimal" || kind === "float") {
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

export function shouldPromptForCustomApiActionPreviewParameters(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && definition.bindingKind === "Unbound"
    && definition.requestParameters.some((parameter) => isPreviewReady(parameter));
}

export async function promptForCustomApiActionPreviewParameters(
  definition: CustomApiDefinition
): Promise<CustomApiActionPreviewParameterValues | undefined> {
  const values: CustomApiActionPreviewParameterValues = {};
  const promptableParameters = definition.requestParameters.filter((parameter) => isPreviewReady(parameter));

  for (const parameter of promptableParameters) {
    const required = isRequired(parameter);
    const value = await vscode.window.showInputBox({
      title: `DV Quick Run: ${definition.displayName || definition.uniqueName}`,
      prompt: `${parameter.uniqueName} (${parameter.typeLabel || parameter.type || "Unknown"})${required ? " required" : " optional"}`,
      placeHolder: getPreviewPlaceholder(parameter),
      ignoreFocusOut: true,
      validateInput: (input) => {
        if (!input.trim()) {
          return required ? `${parameter.uniqueName} is required.` : undefined;
        }

        try {
          parsePreviewParameterValue(parameter, input);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });

    if (value === undefined) {
      return undefined;
    }

    if (!value.trim() && !required) {
      continue;
    }

    values[parameter.uniqueName] = parsePreviewParameterValue(parameter, value);
  }

  return values;
}
