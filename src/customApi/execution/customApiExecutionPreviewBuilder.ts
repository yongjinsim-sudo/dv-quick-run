import type { CustomApiDefinition, CustomApiRequestParameter } from "../models/customApiTypes.js";
import { resolveCustomApiExecutionCapability } from "./customApiExecutionCapabilityResolver.js";
import { validateBoundActionTarget } from "./boundActionTargetValidation.js";
import { resolveActionExecutionReadiness } from "./actionExecutionReadiness.js";
import { buildCustomApiPreviewInvocationPath } from "./customApiInvocationPathBuilder.js";
import { buildAiExecutionAdvisoryLines, shouldShowAiExecutionAdvisory } from "./aiExecutionPolicy.js";

export interface CustomApiExecutionPreviewParameter {
  name: string;
  typeLabel: string;
  required: boolean;
  supported: boolean;
  placeholder: unknown;
  valueSource: "placeholder" | "user-supplied" | "inspect-only";
  reason: string;
}


export interface CustomApiExecutionPreviewSurfaceSection {
  title: string;
  content: string;
  language?: "text" | "json" | "http" | "bash" | "markdown";
  defaultCollapsed?: boolean;
}

export interface CustomApiBoundTargetContext {
  entityLogicalName: string;
  entitySetName: string;
  rowId: string;
  source: "manualInput" | "futureResultViewerContext";
}

export interface CustomApiExecutionPreviewModel {
  apiUniqueName: string;
  apiDisplayName: string;
  method: "GET" | "POST";
  bindingKind: string;
  boundEntityLogicalName: string;
  boundEntitySetName: string;
  bindingParameterName: string;
  boundTargetContext?: CustomApiBoundTargetContext;
  pathTemplate: string;
  requestUrlTemplate: string;
  requestBody: Record<string, unknown> | undefined;
  queryParameterTemplate: string;
  readinessLabel: string;
  readinessReason: string;
  parameters: CustomApiExecutionPreviewParameter[];
  unsupportedParameters: CustomApiExecutionPreviewParameter[];
  omittedBindingParameterCount: number;
  notes: string[];
  executionCapability: ReturnType<typeof resolveCustomApiExecutionCapability>;
  actionReadiness: NonNullable<ReturnType<typeof resolveCustomApiExecutionCapability>["actionReadiness"]> | undefined;
}

interface BuildCustomApiExecutionPreviewOptions {
  environmentUrl?: string;
  parameterValues?: Record<string, unknown>;
  boundTargetRowId?: string;
}

function normalizeEnvironmentUrl(environmentUrl: string | undefined): string {
  const trimmed = environmentUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : "{environment-url}";
}

function getMethod(definition: CustomApiDefinition): "GET" | "POST" {
  return definition.operationKind === "Function" ? "GET" : "POST";
}

function isBindingParameter(definition: CustomApiDefinition, parameter: CustomApiRequestParameter): boolean {
  if (definition.bindingKind !== "Bound") {
    return false;
  }

  const bindingName = (definition.bindingParameterName || definition.executionEligibility?.odataBindingParameterName || "").trim();
  return Boolean(bindingName) && parameter.uniqueName.localeCompare(bindingName, undefined, { sensitivity: "accent" }) === 0;
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

function buildPreviewParameterValues(parameters: readonly CustomApiExecutionPreviewParameter[]): Record<string, unknown> {
  return parameters.reduce<Record<string, unknown>>((values, parameter) => {
    values[parameter.name] = parameter.placeholder;
    return values;
  }, {});
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

function buildPreviewParameters(
  definition: CustomApiDefinition,
  parameterValues: Record<string, unknown> = {}
): CustomApiExecutionPreviewParameter[] {
  return definition.requestParameters.filter((parameter) => !isBindingParameter(definition, parameter)).map((parameter) => {
    const supported = parameter.executionSupport === "preview-ready";
    const hasUserValue = Object.prototype.hasOwnProperty.call(parameterValues, parameter.uniqueName);

    return {
      name: parameter.uniqueName,
      typeLabel: parameter.typeLabel || parameter.type || "Unknown",
      required: parameter.isOptional !== true,
      supported,
      placeholder: supported && hasUserValue ? parameterValues[parameter.uniqueName] : getParameterPlaceholder(parameter),
      valueSource: supported && hasUserValue ? "user-supplied" : supported ? "placeholder" : "inspect-only",
      reason: parameter.executionSupportReason || "Preview support is based on discovered Custom API parameter metadata."
    };
  });
}

function buildNotes(definition: CustomApiDefinition, unsupportedParameters: readonly CustomApiExecutionPreviewParameter[]): string[] {
  const notes: string[] = [];

  notes.push(definition.operationKind === "Action"
    ? "This preview describes a POST operation. Execution may trigger server-side processing once enabled."
    : "This preview describes a GET-style function where exposed by Dataverse.");

  if (definition.bindingKind === "Bound") {
    const boundTargetKind = definition.boundTargetKind || definition.executionEligibility?.odataBoundTargetKind;
    if (boundTargetKind === "entity") {
      notes.push("This operation is entity-bound. The target row is represented by the metadata-derived route, not by a JSON body field.");
    } else if (boundTargetKind === "collection") {
      notes.push("This operation is collection-bound. Collection-bound execution is deferred and remains inspect-only.");
    } else {
      notes.push("This operation is bound. The entity set route is metadata-derived where available; execution remains inspect-only until the binding shape is fully supported.");
    }
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

  const capability = definition.executionCapability || resolveCustomApiExecutionCapability(definition);
  if (capability.executionPolicy?.classification === "ai-related") {
    notes.push(`AI execution policy — ${capability.executionPolicy.reason}`);
  }

  notes.push(capability.canExecute
    ? "This capability can be executed explicitly after preview confirmation."
    : `${capability.label} — ${capability.reason}`);
  return notes;
}

export function buildCustomApiExecutionPreview(
  definition: CustomApiDefinition,
  options: BuildCustomApiExecutionPreviewOptions = {}
): CustomApiExecutionPreviewModel {
  const method = getMethod(definition);
  const parameters = buildPreviewParameters(definition, options.parameterValues);
  const omittedBindingParameterCount = definition.requestParameters.filter((parameter) => isBindingParameter(definition, parameter)).length;
  const previewValues = buildPreviewParameterValues(parameters);
  const pathTemplate = buildCustomApiPreviewInvocationPath(definition, previewValues, {
    boundTargetRowId: options.boundTargetRowId
  });
  const requestUrlTemplate = `${normalizeEnvironmentUrl(options.environmentUrl)}/api/data/v9.2${pathTemplate}`;
  const unsupportedParameters = parameters.filter((parameter) => !parameter.supported);
  const boundTargetValidation = definition.bindingKind === "Bound" && (definition.boundTargetKind || definition.executionEligibility?.odataBoundTargetKind) === "entity" && options.boundTargetRowId
    ? validateBoundActionTarget({
      definition,
      rowId: options.boundTargetRowId,
      capturedEnvironmentUrl: options.environmentUrl,
      activeEnvironmentUrl: options.environmentUrl
    })
    : undefined;
  const executionCapability = definition.executionCapability || resolveCustomApiExecutionCapability(definition);
  const queryParameterTemplate = "";
  const requestBody = buildRequestBody(parameters, method);
  const actionReadiness = definition.operationKind === "Action" && boundTargetValidation
    ? resolveActionExecutionReadiness(definition, {
      aiPolicy: definition.executionPolicy?.allowed === true ? "allow" : undefined,
      boundTargetValidation
    })
    : executionCapability.actionReadiness;
  const boundEntityLogicalName = definition.boundEntityLogicalName || definition.executionEligibility?.odataBoundEntityLogicalName || "";
  const boundEntitySetName = definition.boundEntitySetName || definition.executionEligibility?.odataBoundEntitySetName || "";
  const boundTargetContext = definition.bindingKind === "Bound" && (definition.boundTargetKind || definition.executionEligibility?.odataBoundTargetKind) === "entity" && options.boundTargetRowId
    ? {
      entityLogicalName: boundEntityLogicalName,
      entitySetName: boundEntitySetName,
      rowId: options.boundTargetRowId,
      source: "manualInput" as const
    }
    : undefined;

  return {
    apiUniqueName: definition.uniqueName,
    apiDisplayName: definition.displayName || definition.uniqueName,
    method,
    bindingKind: definition.bindingKind,
    boundEntityLogicalName,
    boundEntitySetName,
    bindingParameterName: definition.bindingParameterName || definition.executionEligibility?.odataBindingParameterName || "",
    boundTargetContext,
    pathTemplate,
    requestUrlTemplate,
    requestBody,
    queryParameterTemplate,
    readinessLabel: definition.executionReadinessLabel || "Inspect only",
    readinessReason: definition.executionReadinessReason || "Preview eligibility is based on discovered parameter metadata.",
    parameters,
    unsupportedParameters,
    omittedBindingParameterCount,
    notes: buildNotes(definition, unsupportedParameters),
    executionCapability,
    actionReadiness
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
    `| Bound Entity Set | ${preview.boundEntitySetName || "—"} |\n` +
    `| Binding Parameter | ${preview.bindingParameterName || "—"} |\n` +
    `| Readiness | ${preview.readinessLabel} |\n` +
    `| Action Readiness | ${preview.actionReadiness?.label || "—"} |\n\n` +
    `## Request URL Template\n\n` +
    `\`\`\`http\n${preview.method} ${preview.requestUrlTemplate}${preview.queryParameterTemplate ? `?${preview.queryParameterTemplate}` : ""}\n\`\`\`\n\n` +
    `## Request Body Template\n\n` +
    `\`\`\`json\n${bodyText}\n\`\`\`\n\n` +
    `## Parameters\n\n` +
    `| Name | Type | Required | Preview Support |\n|---|---|---|---|\n${parameterRows}\n\n` +
    `## Notes\n\n${notes}\n`;
}


function getBoundTargetKind(preview: CustomApiExecutionPreviewModel): string {
  const reasonCodes = preview.actionReadiness?.reasonCodes || [];
  if (preview.boundTargetContext || reasonCodes.includes("BoundEntityAction") || reasonCodes.includes("EntityBoundActionRequiresTarget")) {
    return "entity";
  }

  if (reasonCodes.includes("CollectionBoundAction") || reasonCodes.includes("CollectionBoundActionDeferred")) {
    return "collection";
  }

  return "bound";
}

function renderBoundActionPreviewContext(preview: CustomApiExecutionPreviewModel): string {
  const targetKind = getBoundTargetKind(preview);
  const lines = [
    `Operation type: Bound Action`,
    `Binding kind: ${targetKind}`,
    `Operation: ${preview.apiUniqueName}`,
    `HTTP method: ${preview.method}`,
    `Metadata-derived route: ${preview.pathTemplate}`,
    `Binding parameter: ${preview.bindingParameterName || "—"}`,
    `Bound entity: ${preview.boundEntityLogicalName || "—"}`,
    `Bound entity set: ${preview.boundEntitySetName || "—"}`
  ];

  if (preview.boundTargetContext) {
    lines.push(
      `Target source: ${preview.boundTargetContext.source}`,
      `Target entity: ${preview.boundTargetContext.entityLogicalName || "—"}`,
      `Target entity set: ${preview.boundTargetContext.entitySetName || "—"}`,
      `Target row id: ${preview.boundTargetContext.rowId}`
    );
  } else if (targetKind === "entity") {
    lines.push("Target: Required before entity-bound execution preview can become authoritative");
  } else if (targetKind === "collection") {
    lines.push("Target: Collection scope; no row id is required or accepted");
  } else {
    lines.push("Target: Bound target shape is inspect-only until supported");
  }

  lines.push(
    `Readiness: ${preview.actionReadiness?.label || preview.readinessLabel}`,
    `Signals: ${compactActionReasonCodes(preview.actionReadiness?.reasonCodes)}`,
    "Preview authority: This preview is scoped to this operation, route, captured input, and active environment only."
  );

  return lines.join("\n");
}

function renderOperationSummary(preview: CustomApiExecutionPreviewModel): string {
  const lines = [
    `Display name: ${preview.apiDisplayName}`,
    `Unique name: ${preview.apiUniqueName}`,
    `Method: ${preview.method}`,
    `Binding: ${preview.bindingKind}`,
    `Bound entity: ${preview.boundEntityLogicalName || "—"}`,
    `Bound entity set: ${preview.boundEntitySetName || "—"}`,
    `Binding parameter: ${preview.bindingParameterName || "—"}`,
    `Capability: ${preview.executionCapability.label}`
  ];

  if (preview.boundTargetContext) {
    lines.push(
      `Target input source: ${preview.boundTargetContext.source}`,
      `Target entity: ${preview.boundTargetContext.entityLogicalName || "—"}`,
      `Target entity set: ${preview.boundTargetContext.entitySetName || "—"}`,
      `Target row id: ${preview.boundTargetContext.rowId}`
    );
  }

  return lines.join("\n");
}

function compactActionReasonCode(reasonCode: string): string {
  const labels: Record<string, string> = {
    PublicODataAction: "Metadata-valid",
    SimplePreviewReadyParameters: "Preview-ready",
    ComplexParameterShape: "Complex parameter",
    EntityReferenceParameter: "Entity reference",
    CollectionParameter: "Collection parameter",
    UnknownParameterType: "Unknown parameter",
    BoundActionDeferred: "Bound Action deferred",
    BoundEntityAction: "Entity-bound Action",
    BoundRouteResolved: "Bound route resolved",
    BoundRouteUnavailable: "Bound route unavailable",
    BoundTargetInvalidGuid: "Invalid target GUID",
    BoundTargetEntityMismatch: "Target entity mismatch",
    BoundTargetEnvironmentMismatch: "Target environment mismatch",
    EntityBoundActionRequiresTarget: "Target row required",
    CollectionBoundAction: "Collection-bound Action",
    CollectionBoundActionDeferred: "Collection-bound deferred",
    PrivateCustomApi: "Private/internal",
    MissingActionImport: "Missing ActionImport",
    ValidationUnavailable: "Validation unavailable",
    EnvironmentChanged: "Environment changed",
    AiPolicyDenied: "AI policy denied",
    GeneratedContentAdvisoryRequired: "AI advisory",
    PotentialDestructiveOperation: "Destructive signal",
    PotentialBusinessStateChange: "Business-state signal",
    PotentialExternalSideEffect: "External side-effect signal",
    NotAnAction: "Function semantics"
  };

  return labels[reasonCode] ?? reasonCode;
}

function compactActionReasonCodes(reasonCodes: readonly string[] | undefined): string {
  if (!reasonCodes || reasonCodes.length === 0) {
    return "—";
  }

  return reasonCodes.map(compactActionReasonCode).join(" • ");
}

function renderExecutionState(preview: CustomApiExecutionPreviewModel): string {
  if (preview.executionCapability.executionPolicy?.classification === "ai-related" && !preview.executionCapability.executionPolicy.allowed) {
    return "AI execution blocked by policy; preview and inspection remain available";
  }

  if (preview.executionCapability.canExecute || preview.actionReadiness?.canExecute) {
    return "Execution available after explicit confirmation";
  }

  if (preview.method === "POST" && preview.bindingKind === "Unbound" && preview.executionCapability.executionMethod === "POST") {
    return "Action preview-ready; POST execution is not enabled in this workstream";
  }

  if (preview.method === "POST" && preview.bindingKind === "Bound") {
    return preview.boundTargetContext
      ? "Bound Action preview only; explicit target row context is captured"
      : "Bound Action preview only; selected row/entity execution context is required";
  }

  return "Preview-only; no Dataverse operation will be executed from this surface";
}

function renderAuthorityState(preview: CustomApiExecutionPreviewModel): string {
  if (preview.executionCapability.executionPolicy?.classification === "ai-related" && !preview.executionCapability.executionPolicy.allowed) {
    return "AI-related execution authority is blocked by DV Quick Run policy";
  }

  if (preview.executionCapability.canExecute || preview.actionReadiness?.canExecute) {
    return "Execution is restricted to the active environment that generated this preview";
  }

  return "No executable authority is created by this preview";
}

function renderRequestPreview(preview: CustomApiExecutionPreviewModel): string {
  const requestUrl = `${preview.requestUrlTemplate}${preview.queryParameterTemplate ? `?${preview.queryParameterTemplate}` : ""}`;
  return `${preview.method} ${requestUrl} HTTP/1.1\n` +
    `Accept: application/json\n` +
    `Content-Type: application/json\n` +
    `OData-Version: 4.0\n` +
    `OData-MaxVersion: 4.0`;
}

export function renderCustomApiExecutionRequestText(preview: CustomApiExecutionPreviewModel): string {
  const bodyText = preview.requestBody ? JSON.stringify(preview.requestBody, null, 2) : "";
  return bodyText
    ? `${renderRequestPreview(preview)}\n\n${bodyText}`
    : renderRequestPreview(preview);
}

function renderPayloadState(preview: CustomApiExecutionPreviewModel): string {
  if (!preview.requestBody) {
    return "Payload source: No request body for this preview.";
  }

  const userSuppliedCount = preview.parameters.filter((parameter) => parameter.valueSource === "user-supplied").length;
  const placeholderCount = preview.parameters.filter((parameter) => parameter.valueSource === "placeholder").length;
  const inspectOnlyCount = preview.parameters.filter((parameter) => parameter.valueSource === "inspect-only").length;
  const source = userSuppliedCount > 0 ? "User-edited preview payload" : "Generated metadata template";

  return [
    `Payload source: ${source}`,
    `User-supplied values: ${userSuppliedCount}`,
    `Generated placeholders: ${placeholderCount}`,
    `Inspect-only placeholders: ${inspectOnlyCount}`,
    "Editable scope: request body only. Route, method, environment, and bound target remain read-only.",
    "Execution: preview only; no Dataverse operation is executed from this surface."
  ].join("\n");
}

function resolvePreviewPayloadSource(preview: CustomApiExecutionPreviewModel): string {
  if (!preview.requestBody) {
    return "No request body";
  }

  return preview.parameters.some((parameter) => parameter.valueSource === "user-supplied")
    ? "User-edited preview payload"
    : "Generated metadata template";
}

function renderExecutionConfirmationShell(preview: CustomApiExecutionPreviewModel): string {
  const readiness = preview.actionReadiness?.label || preview.readinessLabel;
  const reason = preview.actionReadiness?.reason || preview.executionCapability.reason;
  const confirmation = preview.actionReadiness?.requiresTypedConfirmation
    ? `Typed confirmation required later: ${preview.actionReadiness.confirmationPhrase}`
    : "Typed confirmation: Not required by current readiness classification";
  const availability = preview.actionReadiness?.canExecute || preview.executionCapability.canExecute
    ? "Execution shell status: ready for explicit confirmation"
    : "Execution shell status: Run Action unavailable; preview and copy-only actions are available";

  return [
    "Execution confirmation shell: staged only",
    `Operation: ${preview.apiUniqueName}`,
    `Method: ${preview.method}`,
    `Route: ${preview.pathTemplate}`,
    `Payload source: ${resolvePreviewPayloadSource(preview)}`,
    `Readiness: ${readiness}`,
    `Signals: ${compactActionReasonCodes(preview.actionReadiness?.reasonCodes)}`,
    confirmation,
    availability,
    `Reason: ${reason}`,
    "Authority boundary: route, method, environment, and bound target are read-only in this preview.",
    preview.actionReadiness?.canExecute || preview.executionCapability.canExecute
      ? "Execution boundary: execution only occurs after explicit confirmation."
      : "Execution boundary: no Dataverse operation is executed from this preview."
  ].join("\n");
}


function renderParameterValueSource(parameter: CustomApiExecutionPreviewParameter): string {
  if (parameter.valueSource === "user-supplied") {
    return "User-supplied preview value";
  }

  if (parameter.valueSource === "inspect-only") {
    return "Inspect-only placeholder";
  }

  return "Generated placeholder";
}

function renderExecutionPolicy(preview: CustomApiExecutionPreviewModel): string {
  const policy = preview.executionCapability.executionPolicy;
  if (!policy || policy.classification !== "ai-related") {
    return "No restrictive execution policy applies to this operation.";
  }

  const lines = [
    "Policy: AI execution",
    `Classification: ${policy.classification}`,
    `Decision: ${policy.allowed ? "Allowed" : "Blocked"}`,
    `Severity: ${policy.severity}`,
    `Reason: ${policy.reason}`
  ];

  if (shouldShowAiExecutionAdvisory(policy)) {
    lines.push(
      "Trust model: Probabilistic / generated content",
      "Human review: Recommended",
      "Generated responses may be inaccurate, incomplete, non-deterministic, or unsuitable for direct operational decisions without review."
    );
  }

  return lines.join("\n");
}

function renderAiExecutionAdvisory(preview: CustomApiExecutionPreviewModel): string {
  const lines = buildAiExecutionAdvisoryLines(preview.executionCapability.executionPolicy);
  if (lines.length === 0) {
    return "No AI-generated content advisory applies to this operation.";
  }

  return [
    "Generated output may be inaccurate, incomplete, or non-deterministic.",
    ...lines.filter((line) => !line.startsWith("Generated responses may")),
    "Human validation is recommended before operational use."
  ].join("\n");
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
      `Preview value: ${JSON.stringify(parameter.placeholder)}`,
      `Value source: ${renderParameterValueSource(parameter)}`,
      `Reason: ${parameter.reason}`,
      `Trust: ${preview.actionReadiness?.parameterTrust.find((trust) => trust.parameterName === parameter.name)?.state || "—"}`
    ].join("\n"))
    .join("\n\n");
}


function renderParameterInputGuidance(preview: CustomApiExecutionPreviewModel): string {
  if (preview.parameters.length === 0) {
    return preview.omittedBindingParameterCount > 0
      ? "No request-body parameter input is required for this preview. The bound target is represented by the route, not by a JSON body field."
      : "No parameter input is required for this preview.";
  }

  const userSuppliedCount = preview.parameters.filter((parameter) => parameter.valueSource === "user-supplied").length;
  const placeholderCount = preview.parameters.filter((parameter) => parameter.valueSource === "placeholder").length;
  const inspectOnlyCount = preview.parameters.filter((parameter) => parameter.valueSource === "inspect-only").length;

  return [
    `User-supplied preview values: ${userSuppliedCount}`,
    `Generated placeholders: ${placeholderCount}`,
    `Inspect-only placeholders: ${inspectOnlyCount}`,
    ...(preview.omittedBindingParameterCount > 0 ? [`Binding parameters excluded from request body: ${preview.omittedBindingParameterCount}`] : []),
    "Preview-ready values shape the request body.",
    "Inspect-only parameters remain visible until explicit payload shaping is supported."
  ].join("\n");
}

export function buildCustomApiExecutionPreviewSurfaceSections(
  preview: CustomApiExecutionPreviewModel
): CustomApiExecutionPreviewSurfaceSection[] {
  const bodyText = preview.requestBody ? JSON.stringify(preview.requestBody, null, 2) : "No request body for this preview.";

  return [
    {
      title: "Summary",
      content: [
        `Execution: ${renderExecutionState(preview)}`,
        `Environment authority: ${renderAuthorityState(preview)}`,
        `Readiness: ${preview.actionReadiness?.label || preview.readinessLabel}`,
        `Capability: ${preview.actionReadiness?.canExecute ? preview.actionReadiness.label : preview.executionCapability.label}`,
        preview.boundTargetContext
          ? `Target: ${preview.boundTargetContext.entityLogicalName || "—"} ${preview.boundTargetContext.rowId}`
          : getBoundTargetKind(preview) === "collection"
            ? `Target: ${preview.boundEntitySetName || "—"} collection`
            : "Target: Not supplied",
        `Reason: ${preview.actionReadiness?.canExecute ? preview.actionReadiness.reason : preview.executionCapability.reason}`
      ].join("\n"),
      language: "text"
    },
    {
      title: "Parameters",
      content: renderParameters(preview),
      language: "text"
    },
    {
      title: "Operation metadata",
      content: renderOperationSummary(preview),
      language: "text",
      defaultCollapsed: true
    },
    ...(preview.method === "POST" && preview.bindingKind === "Bound" ? [{
      title: "Bound Action preview context",
      content: renderBoundActionPreviewContext(preview),
      language: "text" as const,
      defaultCollapsed: true
    }] : []),
    ...(preview.actionReadiness ? [{
      title: "Action execution trust",
      content: [
        `Readiness: ${preview.actionReadiness.label}`,
        `Execution: ${preview.actionReadiness.canExecute ? "Allowed after explicit confirmation" : "Inspect/preview only"}`,
        `Review level: ${preview.actionReadiness.caution ? "Caution" : "Standard"}`,
        `Typed confirmation: ${preview.actionReadiness.requiresTypedConfirmation ? `Required (${preview.actionReadiness.confirmationPhrase})` : "Not required"}`,
        `Signals: ${compactActionReasonCodes(preview.actionReadiness.reasonCodes)}`,
        `Reason: ${preview.actionReadiness.reason}`
      ].join("\n"),
      language: "text" as const,
      defaultCollapsed: true
    }] : []),
    {
      title: "Request preview",
      content: renderRequestPreview(preview),
      language: "http",
      defaultCollapsed: preview.executionCapability.canExecute
    },
    {
      title: "Preview payload state",
      content: renderPayloadState(preview),
      language: "text",
      defaultCollapsed: true
    },
    {
      title: "Execution confirmation shell",
      content: renderExecutionConfirmationShell(preview),
      language: "text",
      defaultCollapsed: true
    },
    {
      title: "Request body template",
      content: bodyText,
      language: preview.requestBody ? "json" : "text",
      defaultCollapsed: true
    },
    {
      title: "Execution policy",
      content: renderExecutionPolicy(preview),
      language: "text",
      defaultCollapsed: true
    },
    ...(shouldShowAiExecutionAdvisory(preview.executionCapability.executionPolicy) ? [{
      title: "AI-generated content advisory",
      content: renderAiExecutionAdvisory(preview),
      language: "text" as const,
      defaultCollapsed: true
    }] : []),
    {
      title: "Parameter input guidance",
      content: renderParameterInputGuidance(preview),
      language: "text",
      defaultCollapsed: true
    },
    {
      title: "Notes",
      content: preview.notes.map((note) => `- ${note}`).join("\n"),
      language: "markdown",
      defaultCollapsed: true
    }
  ];
}
