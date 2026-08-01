import { createHash } from "crypto";
import type { CustomApiDefinition, CustomApiRequestParameter } from "../customApi/models/customApiTypes.js";
import { McpCustomApiApplicationService } from "./mcpCustomApiApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { stringArg } from "./mcpRequestArguments.js";
import { McpCustomApiExecutionPreviewSessionStore } from "./mcpCustomApiExecutionPreviewSessionStore.js";

export type McpCustomApiExecutionReadiness = "ready" | "conditional" | "blocked";
export type McpCustomApiSideEffectPosture = "generate-only" | "read-like" | "possible-mutation" | "administrative" | "unknown";

export interface McpCustomApiExecutionPreviewContract {
  readonly contractVersion: "dvqr-mcp-custom-api-execution-preview-v1";
  readonly environmentUrl: string;
  readonly uniqueName: string;
  readonly found: boolean;
  readonly readiness: McpCustomApiExecutionReadiness;
  readonly operationKind?: string;
  readonly bindingKind?: string;
  readonly sideEffectPosture?: McpCustomApiSideEffectPosture;
  readonly parameterMapping?: readonly unknown[];
  readonly issues: readonly string[];
  readonly warnings?: readonly string[];
  readonly preview?: {
    readonly method: string;
    readonly route: string;
    readonly body?: Record<string, unknown>;
    readonly functionParameters?: Record<string, unknown>;
    readonly expectedOutputs: readonly { readonly uniqueName: string; readonly type: string }[];
  };
  readonly executionPlanFingerprint?: string;
  readonly previewId?: string;
  readonly previewSession?: {
    readonly status: "awaiting-confirmation";
    readonly createdAtUtc: string;
    readonly expiresAtUtc: string;
    readonly singleUse: true;
  };
  readonly evidenceBoundary?: string;
  readonly noExecutionPerformed: true;
}

function executionPlanFingerprint(args: {
  readonly environmentUrl: string;
  readonly uniqueName: string;
  readonly method: string;
  readonly route: string;
  readonly body?: Record<string, unknown>;
}): string {
  const stableBody = Object.keys(args.body ?? {}).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = args.body?.[key];
    return result;
  }, {});
  return createHash("sha256")
    .update(JSON.stringify({
      environmentUrl: args.environmentUrl,
      uniqueName: args.uniqueName,
      method: args.method,
      route: args.route,
      body: stableBody
    }))
    .digest("hex");
}

function bindingKind(definition: CustomApiDefinition): "Global" | "Entity" | "EntityCollection" | "Unresolved" {
  if (definition.bindingKind === "Unbound" || definition.boundTargetKind === "none") return "Global";
  if (definition.boundTargetKind === "entity") return "Entity";
  if (definition.boundTargetKind === "collection") return "EntityCollection";
  return "Unresolved";
}

function typeText(parameter: CustomApiRequestParameter): string {
  return `${parameter.typeCategory ?? ""} ${parameter.typeLabel ?? ""} ${parameter.type ?? ""}`.toLowerCase();
}

function scalarKind(parameter: CustomApiRequestParameter): "string" | "boolean" | "integer" | "number" | "guid" | "unsupported" {
  const type = typeText(parameter);
  if (type.includes("boolean")) return "boolean";
  if (type.includes("guid") || type.includes("uniqueidentifier")) return "guid";
  if (type.includes("integer") || type.includes("int32") || type.includes("int64")) return "integer";
  if (type.includes("decimal") || type.includes("double") || type.includes("float") || type.includes("number")) return "number";
  if (type.includes("string") || type.includes("text") || !type.trim()) return "string";
  return "unsupported";
}

function sideEffectPosture(definition: CustomApiDefinition): McpCustomApiSideEffectPosture {
  const text = `${definition.uniqueName} ${definition.displayName ?? ""} ${definition.description ?? ""}`.toLowerCase();
  if (/delete|remove|update|create|set|assign|grant|revoke|activate|deactivate|publish|import|install/.test(text)) return "possible-mutation";
  if (/plugin|sdkmessageprocessingstep|deployment|registration|certificate|administrat/.test(text)) return "administrative";
  if (/reply|summari[sz]|translate|sentiment|classif|extract|generate text|draft/.test(text)) return "generate-only";
  if (definition.operationKind === "Function") return "read-like";
  return "unknown";
}

function parseValue(parameter: CustomApiRequestParameter, value: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  const kind = scalarKind(parameter);
  if (kind === "unsupported") return { ok: false, reason: "Parameter type is not supported by Execution Pass 1 preview." };
  if (value === null || value === undefined) return { ok: true, value };
  if (kind === "string") return typeof value === "string" ? { ok: true, value } : { ok: false, reason: "Expected a string value." };
  if (kind === "boolean") return typeof value === "boolean" ? { ok: true, value } : { ok: false, reason: "Expected a boolean value." };
  if (kind === "integer") return typeof value === "number" && Number.isInteger(value) ? { ok: true, value } : { ok: false, reason: "Expected an integer value." };
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: "Expected a finite numeric value." };
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? { ok: true, value }
    : { ok: false, reason: "Expected a GUID string." };
}

export class McpCustomApiExecutionPreviewApplicationService {
  public constructor(
    config: DvqrMcpRuntimeConfiguration,
    private readonly definitions = new McpCustomApiApplicationService(config),
    private readonly previewSessions: McpCustomApiExecutionPreviewSessionStore
  ) {}

  public async check(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.build(args, false);
  }

  public async preview(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.build(args, true);
  }

  private async build(args: Record<string, unknown>, includePreview: boolean): Promise<DvqrMcpFreeToolResult> {
    const uniqueName = stringArg(args, "uniqueName");
    if (!uniqueName) return { ok: false, code: "InvalidArguments", message: "uniqueName is required." };
    const resolution = await this.definitions.resolveDefinition(args);
    if ("ok" in resolution) return resolution;
    if (!resolution.definition) {
      return { ok: true, summary: `No Custom API definition named ${uniqueName} was found.`, structuredContent: {
        contractVersion: includePreview ? "dvqr-mcp-custom-api-execution-preview-v1" : "dvqr-mcp-custom-api-execution-readiness-v1",
        environmentUrl: resolution.environmentUrl, uniqueName, found: false, readiness: "blocked", issues: ["Exact Custom API definition was not found."], noExecutionPerformed: true
      }};
    }

    const definition = resolution.definition;
    const binding = bindingKind(definition);
    const values = args.parameters && typeof args.parameters === "object" && !Array.isArray(args.parameters)
      ? args.parameters as Record<string, unknown> : {};
    const target = args.target && typeof args.target === "object" && !Array.isArray(args.target)
      ? args.target as Record<string, unknown> : {};
    const issues: string[] = [];
    const warnings: string[] = ["Caller privileges are not verified by metadata preview.", "Runtime side effects and environment business rules are not verified."];
    const mapped: Record<string, unknown> = {};
    const parameterMapping = definition.requestParameters.map((parameter) => {
      const supplied = Object.prototype.hasOwnProperty.call(values, parameter.uniqueName);
      if (!supplied && parameter.isOptional !== true) issues.push(`Missing required parameter: ${parameter.uniqueName}.`);
      const parsed = supplied ? parseValue(parameter, values[parameter.uniqueName]) : { ok: true as const, value: undefined };
      if (!parsed.ok) issues.push(`${parameter.uniqueName}: ${parsed.reason}`);
      if (supplied && parsed.ok && parsed.value !== undefined) mapped[parameter.uniqueName] = parsed.value;
      if (scalarKind(parameter) === "unsupported") issues.push(`Unsupported parameter type: ${parameter.uniqueName}.`);
      return { uniqueName: parameter.uniqueName, type: parameter.typeLabel ?? parameter.typeCategory ?? parameter.type ?? "Unknown", required: parameter.isOptional !== true, supplied, supported: scalarKind(parameter) !== "unsupported", ...(supplied ? { mappedValue: parsed.ok ? parsed.value : null } : {}) };
    });

    let route = `/api/data/v9.2/${definition.uniqueName}`;
    if (binding === "Entity") {
      const entitySetName = typeof target.entitySetName === "string" ? target.entitySetName.trim() : definition.boundEntitySetName?.trim();
      const recordId = typeof target.recordId === "string" ? target.recordId.trim() : "";
      if (!entitySetName) issues.push("Bound entity execution requires a verified entitySetName.");
      if (!recordId) issues.push("Bound entity execution requires recordId.");
      route = `/api/data/v9.2/${entitySetName || "{verifiedEntitySet}"}(${recordId || "{rowId}"})/Microsoft.Dynamics.CRM.${definition.uniqueName}`;
    } else if (binding === "EntityCollection") {
      const entitySetName = typeof target.entitySetName === "string" ? target.entitySetName.trim() : definition.boundEntitySetName?.trim();
      if (!entitySetName) issues.push("Collection-bound execution requires a verified entitySetName.");
      route = `/api/data/v9.2/${entitySetName || "{verifiedEntitySet}"}/Microsoft.Dynamics.CRM.${definition.uniqueName}`;
    } else if (binding === "Unresolved") {
      issues.push("Binding metadata is unresolved.");
    }

    const method = definition.operationKind === "Function" ? "GET" : "POST";
    if (definition.isPrivate) issues.push("Private Custom APIs are blocked from execution preview.");
    const posture = sideEffectPosture(definition);
    if (posture === "administrative") issues.push("Administrative operations are outside the initial execution scope.");
    const readiness: McpCustomApiExecutionReadiness = issues.length ? "blocked" : warnings.length ? "conditional" : "ready";
    const preview = includePreview ? {
      method,
      route,
      ...(method === "POST" ? { body: mapped } : { functionParameters: mapped }),
      expectedOutputs: definition.responseProperties.map((property) => ({ uniqueName: property.uniqueName, type: property.typeLabel ?? property.type ?? "Unknown" }))
    } : undefined;
    const fingerprint = preview ? executionPlanFingerprint({
      environmentUrl: resolution.environmentUrl,
      uniqueName: definition.uniqueName,
      method: preview.method,
      route: preview.route,
      body: "body" in preview ? preview.body : undefined
    }) : undefined;
    const baseContent = {
      contractVersion: includePreview ? "dvqr-mcp-custom-api-execution-preview-v1" : "dvqr-mcp-custom-api-execution-readiness-v1",
      environmentUrl: resolution.environmentUrl,
      uniqueName: definition.uniqueName,
      found: true,
      readiness,
      operationKind: definition.operationKind,
      bindingKind: binding,
      sideEffectPosture: posture,
      parameterMapping,
      issues,
      warnings,
      ...(preview ? {
        preview,
        executionPlanFingerprint: fingerprint,
        nextAction: {
          tool: "dvqr_execute_custom_api",
          requiresExplicitConfirmation: true,
          confirmationValue: "EXECUTE",
          preserveExactPreview: true,
          forbidAlternativeExecutionTools: true,
          instruction: readiness === "blocked"
            ? "Resolve the preview issues and generate a new preview. Do not execute through another tool."
            : "Present this exact preview to the user and ask them to reply EXECUTE. After that explicit reply, call dvqr_execute_custom_api with the unchanged uniqueName, parameters, environmentUrl and executionPlanFingerprint."
        }
      } : {}),
      evidenceBoundary: "Definition, route shape and scalar parameter mapping are metadata-derived. Privileges, OData exposure, runtime behavior, side effects and business suitability are not verified.",
      noExecutionPerformed: true
    } as McpCustomApiExecutionPreviewContract;
    const session = includePreview && preview && readiness !== "blocked"
      ? this.previewSessions.create(baseContent)
      : undefined;
    const content = session ? {
      ...baseContent,
      previewId: session.previewId,
      previewSession: {
        status: "awaiting-confirmation" as const,
        createdAtUtc: session.createdAtUtc,
        expiresAtUtc: session.expiresAtUtc,
        singleUse: true as const
      },
      nextAction: {
        ...(baseContent as any).nextAction,
        previewId: session.previewId,
        instruction: "Stop after presenting this exact preview. Ask the user to reply EXECUTE in a new message. Then call dvqr_execute_custom_api with only this previewId and confirmation EXECUTE. The preview is short-lived and single-use; do not reuse or reconstruct it."
      }
    } : baseContent;
    const lines = [
      `${definition.uniqueName} execution ${includePreview ? "preview" : "readiness"}`,
      `Readiness: ${readiness}`,
      `Method: ${method}`,
      `Route: ${route}`,
      `Side-effect posture: ${posture}`,
      ...(issues.length ? ["Issues:", ...issues.map((issue) => `- ${issue}`)] : []),
      ...(warnings.length ? ["Not verified:", ...warnings.map((warning) => `- ${warning}`)] : []),
      "No execution was performed."
    ];
    return { ok: true, summary: `${definition.uniqueName} execution ${includePreview ? "preview" : "readiness"}: ${readiness}.`, displayText: lines.join("\n"), structuredContent: content };
  }
}
