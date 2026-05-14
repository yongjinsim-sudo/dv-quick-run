import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";

export interface CustomApiExecutionPreviewParameter {
  name: string;
  typeLabel: string;
  required: boolean;
  supported: boolean;
  placeholder: unknown;
  reason: string;
}


export interface CustomApiExecutionPreviewSurfaceSection {
  title: string;
  content: string;
  language?: "text" | "json" | "http" | "bash" | "markdown";
}

export interface CustomApiExecutionPreviewModel {
  apiUniqueName: string;
  apiDisplayName: string;
  method: "GET" | "POST";
  bindingKind: string;
  boundEntityLogicalName: string;
  pathTemplate: string;
  requestUrlTemplate: string;
  requestBody: Record<string, unknown> | undefined;
  queryParameterTemplate: string;
  readinessLabel: string;
  readinessReason: string;
  parameters: CustomApiExecutionPreviewParameter[];
  unsupportedParameters: CustomApiExecutionPreviewParameter[];
  notes: string[];
}

interface BuildCustomApiExecutionPreviewOptions {
  environmentUrl?: string;
}

function normalizeEnvironmentUrl(environmentUrl: string | undefined): string {
  const trimmed = environmentUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : "{environment-url}";
}

function getMethod(definition: CustomApiDefinition): "GET" | "POST" {
  return definition.operationKind === "Function" ? "GET" : "POST";
}

function getParameterPlaceholder(parameter: CustomApiRequestParameter): unknown {
  const typeLabel = parameter.typeLabel?.toLowerCase();

  switch (typeLabel) {
    case "boolean":
      return false;
    case "integer":
    case "decimal":
    case "float":
      return 0;
    case "datetime":
      return "2026-01-01T00:00:00Z";
    case "guid":
      return "00000000-0000-0000-0000-000000000000";
    case "string":
      return `<${parameter.uniqueName}>`;
    default:
      return `<inspect-only: ${parameter.typeLabel || parameter.type || "Unknown"}>`;
  }
}

function buildPathTemplate(definition: CustomApiDefinition): string {
  const operationName = definition.executionEligibility?.odataInvocationName || definition.executionEligibility?.odataName || `Microsoft.Dynamics.CRM.${definition.uniqueName}`;

  if (definition.bindingKind === "Bound") {
    const entitySetPlaceholder = `{entity-set-for-${definition.boundEntityLogicalName || "bound-entity"}}`;
    return `/${entitySetPlaceholder}({record-id})/${operationName}`;
  }

  return `/${operationName}`;
}

function buildQueryParameterTemplate(parameters: readonly CustomApiExecutionPreviewParameter[]): string {
  if (parameters.length === 0) {
    return "";
  }

  return parameters
    .map((parameter) => `${parameter.name}=${JSON.stringify(parameter.placeholder)}`)
    .join("&");
}

function buildRequestBody(parameters: readonly CustomApiExecutionPreviewParameter[], method: "GET" | "POST"): Record<string, unknown> | undefined {
  if (method !== "POST" || parameters.length === 0) {
    return undefined;
  }

  return parameters.reduce<Record<string, unknown>>((body, parameter) => {
    body[parameter.name] = parameter.placeholder;
    return body;
  }, {});
}

function buildPreviewParameters(definition: CustomApiDefinition): CustomApiExecutionPreviewParameter[] {
  return definition.requestParameters.map((parameter) => ({
    name: parameter.uniqueName,
    typeLabel: parameter.typeLabel || parameter.type || "Unknown",
    required: parameter.isOptional !== true,
    supported: parameter.executionSupport === "preview-ready",
    placeholder: getParameterPlaceholder(parameter),
    reason: parameter.executionSupportReason || "Preview support is based on discovered Custom API parameter metadata."
  }));
}

function buildNotes(definition: CustomApiDefinition, unsupportedParameters: readonly CustomApiExecutionPreviewParameter[]): string[] {
  const notes: string[] = [];

  notes.push(definition.operationKind === "Action"
    ? "This preview describes a POST operation. Execution may trigger server-side processing once enabled."
    : "This preview describes a GET-style function where exposed by Dataverse.");

  if (definition.bindingKind === "Bound") {
    notes.push("This operation is bound. A real execution preview will need an entity set name and selected record id from context.");
  } else {
    notes.push("This operation is unbound and is not tied to a selected row.");
  }

  if (definition.isPrivate === true) {
    notes.push("This API is marked private. Treat the preview as metadata inspection until execution is explicitly supported.");
  }

  if (unsupportedParameters.length > 0) {
    notes.push(`${unsupportedParameters.length} parameter${unsupportedParameters.length === 1 ? "" : "s"} use inspect-only types and will need manual payload shaping before execution.`);
  }

  if (definition.executionEligibility) {
    notes.push(`${definition.executionEligibility.label} — ${definition.executionEligibility.reason}`);
  }

  notes.push(definition.operationKind === "Function" && definition.bindingKind === "Unbound" && unsupportedParameters.length === 0 && definition.executionEligibility?.state === "executable"
    ? "This Function can be executed explicitly after preview in this workstream."
    : "This is a request preview only. DV Quick Run will not execute this operation from this preview.");
  return notes;
}

export function buildCustomApiExecutionPreview(
  definition: CustomApiDefinition,
  options: BuildCustomApiExecutionPreviewOptions = {}
): CustomApiExecutionPreviewModel {
  const method = getMethod(definition);
  const pathTemplate = buildPathTemplate(definition);
  const requestUrlTemplate = `${normalizeEnvironmentUrl(options.environmentUrl)}/api/data/v9.2${pathTemplate}`;
  const parameters = buildPreviewParameters(definition);
  const unsupportedParameters = parameters.filter((parameter) => !parameter.supported);
  const queryParameterTemplate = method === "GET" ? buildQueryParameterTemplate(parameters) : "";
  const requestBody = buildRequestBody(parameters, method);

  return {
    apiUniqueName: definition.uniqueName,
    apiDisplayName: definition.displayName || definition.uniqueName,
    method,
    bindingKind: definition.bindingKind,
    boundEntityLogicalName: definition.boundEntityLogicalName || "",
    pathTemplate,
    requestUrlTemplate,
    requestBody,
    queryParameterTemplate,
    readinessLabel: definition.executionReadinessLabel || "Inspect only",
    readinessReason: definition.executionReadinessReason || "Preview eligibility is based on discovered parameter metadata.",
    parameters,
    unsupportedParameters,
    notes: buildNotes(definition, unsupportedParameters)
  };
}

export function renderCustomApiExecutionPreviewMarkdown(preview: CustomApiExecutionPreviewModel): string {
  const bodyText = preview.requestBody ? JSON.stringify(preview.requestBody, null, 2) : "No request body for this preview.";
  const parameterRows = preview.parameters.length === 0
    ? "| — | — | — | — |\n"
    : preview.parameters
      .map((parameter) => `| ${parameter.name} | ${parameter.typeLabel} | ${parameter.required ? "Yes" : "No"} | ${parameter.supported ? "Preview-ready" : "Inspect only"} |`)
      .join("\n");
  const notes = preview.notes.map((note) => `- ${note}`).join("\n");

  return `# Custom API Execution Preview\n\n` +
    `> Preview only. No Dataverse operation has been executed.\n\n` +
    `## Operation\n\n` +
    `| Field | Value |\n|---|---|\n` +
    `| Display Name | ${preview.apiDisplayName} |\n` +
    `| Unique Name | ${preview.apiUniqueName} |\n` +
    `| Method | ${preview.method} |\n` +
    `| Binding | ${preview.bindingKind} |\n` +
    `| Bound Entity | ${preview.boundEntityLogicalName || "—"} |\n` +
    `| Readiness | ${preview.readinessLabel} |\n\n` +
    `## Request URL Template\n\n` +
    `\`\`\`http\n${preview.method} ${preview.requestUrlTemplate}${preview.queryParameterTemplate ? `?${preview.queryParameterTemplate}` : ""}\n\`\`\`\n\n` +
    `## Request Body Template\n\n` +
    `\`\`\`json\n${bodyText}\n\`\`\`\n\n` +
    `## Parameters\n\n` +
    `| Name | Type | Required | Preview Support |\n|---|---|---|---|\n${parameterRows}\n\n` +
    `## Notes\n\n${notes}\n`;
}


function renderOperationSummary(preview: CustomApiExecutionPreviewModel): string {
  return [
    `Display name: ${preview.apiDisplayName}`,
    `Unique name: ${preview.apiUniqueName}`,
    `Method: ${preview.method}`,
    `Binding: ${preview.bindingKind}`,
    `Bound entity: ${preview.boundEntityLogicalName || "—"}`,
    `Readiness: ${preview.readinessLabel}`
  ].join("\n");
}

function renderRequestPreview(preview: CustomApiExecutionPreviewModel): string {
  const requestUrl = `${preview.requestUrlTemplate}${preview.queryParameterTemplate ? `?${preview.queryParameterTemplate}` : ""}`;
  return `${preview.method} ${requestUrl} HTTP/1.1\n` +
    `Accept: application/json\n` +
    `Content-Type: application/json\n` +
    `OData-Version: 4.0\n` +
    `OData-MaxVersion: 4.0`;
}

function renderParameters(preview: CustomApiExecutionPreviewModel): string {
  if (preview.parameters.length === 0) {
    return "No request parameters discovered.";
  }

  return preview.parameters
    .map((parameter) => [
      `Name: ${parameter.name}`,
      `Type: ${parameter.typeLabel}`,
      `Required: ${parameter.required ? "Yes" : "No"}`,
      `Preview support: ${parameter.supported ? "Preview-ready" : "Inspect only"}`,
      `Placeholder: ${JSON.stringify(parameter.placeholder)}`,
      `Reason: ${parameter.reason}`
    ].join("\n"))
    .join("\n\n");
}

export function buildCustomApiExecutionPreviewSurfaceSections(
  preview: CustomApiExecutionPreviewModel
): CustomApiExecutionPreviewSurfaceSection[] {
  const bodyText = preview.requestBody ? JSON.stringify(preview.requestBody, null, 2) : "No request body for this preview.";

  return [
    {
      title: "Summary",
      content: [
        "Mode: Preview only",
        preview.method === "GET" && preview.bindingKind === "Unbound" && preview.unsupportedParameters.length === 0 && preview.readinessLabel === "Preview-ready"
          ? "Execution: depends on OData eligibility shown in the drawer"
          : "Execution: Not available in this workstream",
        `Readiness: ${preview.readinessLabel}`,
        `Reason: ${preview.readinessReason}`
      ].join("\n"),
      language: "text"
    },
    {
      title: "Operation",
      content: renderOperationSummary(preview),
      language: "text"
    },
    {
      title: "Request preview",
      content: renderRequestPreview(preview),
      language: "http"
    },
    {
      title: "Request body template",
      content: bodyText,
      language: preview.requestBody ? "json" : "text"
    },
    {
      title: "Parameters",
      content: renderParameters(preview),
      language: "text"
    },
    {
      title: "Notes",
      content: preview.notes.map((note) => `- ${note}`).join("\n"),
      language: "markdown"
    }
  ];
}
