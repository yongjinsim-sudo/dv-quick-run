import * as vscode from "vscode";
import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";
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

export async function promptForCustomApiFunctionParameters(
  definition: CustomApiDefinition
): Promise<CustomApiFunctionParameterValues | undefined> {
  const values: CustomApiFunctionParameterValues = {};

  for (const parameter of definition.requestParameters) {
    const required = isRequired(parameter);
    const value = await vscode.window.showInputBox({
      title: `DV Quick Run: ${definition.displayName || definition.uniqueName}`,
      prompt: `${parameter.uniqueName} (${parameter.typeLabel || parameter.type || "Unknown"})${required ? " required" : " optional"}`,
      placeHolder: getPlaceholder(parameter),
      ignoreFocusOut: true,
      validateInput: (input) => {
        if (!input.trim()) {
          return required ? `${parameter.uniqueName} is required.` : undefined;
        }

        try {
          parseParameterValue(parameter, input);
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

    values[parameter.uniqueName] = parseParameterValue(parameter, value);
  }

  return values;
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

export function buildCustomApiActionExecutionPath(definition: CustomApiDefinition): string {
  if (!canExecuteCustomApiAction(definition)) {
    throw new Error("Only preview-ready unbound public Custom API Actions can be executed.");
  }

  return buildCustomApiActionInvocationPath(definition);
}

export function buildCustomApiActionExecutionPlan(
  definition: CustomApiDefinition,
  values: CustomApiFunctionParameterValues,
  baseUrl: string
): CustomApiFunctionExecutionPlan {
  const path = buildCustomApiActionExecutionPath(definition);
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
