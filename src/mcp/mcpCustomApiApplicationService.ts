import type { CustomApiDefinition, CustomApiOperationKind } from "../customApi/models/customApiTypes.js";
import { McpCustomApiMetadataRepository } from "./mcpCustomApiMetadataRepository.js";
import { stringArg, validateEnvironmentUrl } from "./mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export interface McpCustomApiRepositoryLike {
  discover(environmentUrl: string): Promise<{
    readonly definitions: readonly CustomApiDefinition[];
    readonly executionContexts?: readonly unknown[];
    readonly transports?: readonly string[];
    readonly nativeFetchFailures?: readonly (string | undefined)[];
  }>;
}

type PublicBindingKind = "Global" | "Entity" | "EntityCollection";

export interface McpCustomApiDefinitionResolution {
  readonly environmentUrl: string;
  readonly uniqueName: string;
  readonly definition: CustomApiDefinition | null;
  readonly invocation: Record<string, unknown> | null;
  readonly catalogue: readonly CustomApiDefinition[];
  readonly executionContexts?: readonly unknown[];
  readonly transports?: readonly string[];
  readonly nativeFetchFailures?: readonly (string | undefined)[];
}
type CustomApiDiscoveryDetailLevel = "names" | "summary";

interface CustomApiContinuationState {
  readonly version: 1;
  readonly afterUniqueName: string;
  readonly query: string;
  readonly operationKind?: CustomApiOperationKind;
  readonly bindingKind?: PublicBindingKind;
  readonly includePrivate: boolean;
}

function boolArg(args: Record<string, unknown>, name: string, fallback: boolean): boolean {
  return typeof args[name] === "boolean" ? args[name] as boolean : fallback;
}
function maxArg(args: Record<string, unknown>, name: string, fallback: number, maximum: number): number {
  const value = Number(args[name] ?? fallback);
  return Number.isFinite(value) ? Math.max(1, Math.min(maximum, Math.floor(value))) : fallback;
}
function operationKind(value: string | undefined): CustomApiOperationKind | undefined {
  const normalized = value?.toLowerCase();
  return normalized === "action" ? "Action" : normalized === "function" ? "Function" : undefined;
}
function discoveryDetailLevel(value: string | undefined): CustomApiDiscoveryDetailLevel | undefined {
  const normalized = value?.toLowerCase();
  if (!normalized || normalized === "names") return "names";
  if (normalized === "summary") return "summary";
  return undefined;
}
function publicBindingKind(value: string | undefined): PublicBindingKind | undefined {
  const normalized = value?.toLowerCase();
  if (normalized === "global") return "Global";
  if (normalized === "entity") return "Entity";
  if (normalized === "entitycollection") return "EntityCollection";
  return undefined;
}
function definitionBindingKind(definition: CustomApiDefinition): PublicBindingKind | undefined {
  if (definition.bindingKind === "Unbound" || definition.boundTargetKind === "none") return "Global";
  if (definition.boundTargetKind === "entity") return "Entity";
  if (definition.boundTargetKind === "collection") return "EntityCollection";
  return undefined;
}
function matchesText(definition: CustomApiDefinition, query: string): boolean {
  if (!query) return true;
  const haystack = [definition.uniqueName, definition.displayName, definition.description, definition.boundEntityLogicalName]
    .filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}
function normalizeQuery(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function encodeContinuation(state: CustomApiContinuationState): string {
  return `v1.${encodeURIComponent(JSON.stringify(state))}`;
}
function decodeContinuation(value: string): CustomApiContinuationState | undefined {
  try {
    if (!value.startsWith("v1.")) return undefined;
    const parsed = JSON.parse(decodeURIComponent(value.slice(3))) as Partial<CustomApiContinuationState>;
    if (parsed.version !== 1 || typeof parsed.afterUniqueName !== "string" || typeof parsed.includePrivate !== "boolean") return undefined;
    return parsed as CustomApiContinuationState;
  } catch {
    return undefined;
  }
}
function sameContinuationRequest(
  state: CustomApiContinuationState,
  query: string,
  operation: CustomApiOperationKind | undefined,
  binding: PublicBindingKind | undefined,
  includePrivate: boolean
): boolean {
  return state.query === query
    && state.operationKind === operation
    && state.bindingKind === binding
    && state.includePrivate === includePrivate;
}
function parameterPlaceholder(typeCategory: string | undefined, typeLabel: string | undefined): unknown {
  const type = `${typeCategory ?? ""} ${typeLabel ?? ""}`.toLowerCase();
  if (type.includes("boolean")) return false;
  if (type.includes("integer") || type.includes("decimal") || type.includes("number") || type.includes("float")) return 0;
  if (type.includes("guid") || type.includes("uniqueidentifier")) return "<guid>";
  if (type.includes("entity") || type.includes("record")) return { "@odata.type": "Microsoft.Dynamics.CRM.<table>", "<primaryKey>": "<guid>" };
  if (type.includes("collection")) return [];
  return "<value>";
}
function buildInvocationScaffold(definition: CustomApiDefinition): Record<string, unknown> {
  const binding = definitionBindingKind(definition);
  const routePrefix = "/api/data/v9.2";
  const operationSegment = definition.uniqueName;
  let routeTemplate: string;
  if (binding === "Entity") {
    routeTemplate = `${routePrefix}/{verifiedEntitySet}({rowId})/${operationSegment}`;
  } else if (binding === "EntityCollection") {
    routeTemplate = `${routePrefix}/{verifiedEntitySet}/${operationSegment}`;
  } else {
    routeTemplate = `${routePrefix}/${operationSegment}${definition.operationKind === "Function" ? "(...)" : ""}`;
  }
  const parameterTemplate = Object.fromEntries(definition.requestParameters.map((parameter) => [
    parameter.uniqueName,
    parameterPlaceholder(parameter.typeCategory, parameter.typeLabel ?? parameter.type)
  ]));
  return {
    method: definition.operationKind === "Function" ? "GET" : "POST",
    routeTemplate,
    bindingKind: binding ?? "Unresolved",
    ...(definition.operationKind === "Action" ? { bodyTemplate: parameterTemplate } : { functionParameters: parameterTemplate }),
    executionEligibility: {
      status: "metadata_only",
      reason: "The route and payload scaffold are derived from Custom API definition metadata. OData exposure, qualified operation name, bound entity-set route and parameter serialisation have not yet been verified."
    }
  };
}
function compactDiscoveryDefinition(definition: CustomApiDefinition, detailLevel: CustomApiDiscoveryDetailLevel): Record<string, unknown> {
  const compact: Record<string, unknown> = {
    uniqueName: definition.uniqueName,
    operationKind: definition.operationKind,
    bindingKind: definitionBindingKind(definition) ?? "Unresolved",
    ...(definition.boundEntityLogicalName ? { boundEntityLogicalName: definition.boundEntityLogicalName } : {})
  };
  if (detailLevel === "summary") {
    compact.displayName = definition.displayName;
    if (definition.description) compact.description = definition.description;
  }
  return compact;
}
function discoveryDisplayText(
  totalMatching: number,
  definitions: readonly CustomApiDefinition[],
  detailLevel: CustomApiDiscoveryDetailLevel,
  hasMore: boolean,
  nextContinuationToken: string | undefined
): string {
  const lines = [`Custom APIs: ${definitions.length} of ${totalMatching} matching definitions`];
  definitions.forEach((definition, index) => {
    const binding = definitionBindingKind(definition) ?? "Unresolved";
    const target = definition.boundEntityLogicalName ? `, ${definition.boundEntityLogicalName}` : "";
    const label = detailLevel === "summary" && definition.displayName && definition.displayName !== definition.uniqueName
      ? ` — ${definition.displayName}`
      : "";
    lines.push(`${index + 1}. ${definition.uniqueName}${label} — ${definition.operationKind}, ${binding}${target}`);
  });
  if (hasMore && nextContinuationToken) {
    lines.push("More results are available. Call dvqr_discover_custom_apis again with the returned nextContinuationToken and the same filters.");
    lines.push(`nextContinuationToken: ${nextContinuationToken}`);
  }
  lines.push("For one named API's parameters, outputs or call shape, use dvqr_get_custom_api_definition.");
  return lines.join("\n");
}
function parameterLine(parameter: CustomApiDefinition["requestParameters"][number]): string {
  const type = parameter.typeLabel ?? parameter.typeCategory ?? parameter.type ?? "Unknown";
  const requirement = parameter.isOptional === true ? "optional" : "required";
  return `- ${parameter.uniqueName} — ${type}, ${requirement}`;
}
function responseLine(property: CustomApiDefinition["responseProperties"][number]): string {
  const type = property.typeLabel ?? property.type ?? "Unknown";
  return `- ${property.uniqueName} — ${type}`;
}
function definitionDisplayText(definition: CustomApiDefinition, invocation: Record<string, unknown>): string {
  const binding = definitionBindingKind(definition) ?? "Unresolved";
  const lines = [
    definition.uniqueName,
    `Kind: ${definition.operationKind}`,
    `Binding: ${binding}${definition.boundEntityLogicalName ? ` (${definition.boundEntityLogicalName})` : ""}`,
    ...(definition.description ? [`Description: ${definition.description}`] : []),
    "Request parameters:",
    ...(definition.requestParameters.length ? definition.requestParameters.map(parameterLine) : ["- None"]),
    "Response properties:",
    ...(definition.responseProperties.length ? definition.responseProperties.map(responseLine) : ["- None"]),
    "Execution eligibility: Metadata only; OData exposure and execution safety are not yet verified.",
    `Candidate method: ${String(invocation.method ?? "Unknown")}`,
    `Candidate route: ${String(invocation.routeTemplate ?? "Unavailable")}`
  ];
  return lines.join("\n");
}

function countBy<T extends string>(values: readonly T[], expected: readonly T[]): Record<T, number> {
  return expected.reduce((result, value) => {
    result[value] = values.filter((item) => item === value).length;
    return result;
  }, {} as Record<T, number>);
}

export class McpCustomApiApplicationService {
  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly repository: McpCustomApiRepositoryLike = new McpCustomApiMetadataRepository(config)
  ) {}

  public async discover(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const environment = validateEnvironmentUrl(args, this.config);
    if (!environment.ok) return environment;
    const requestedOperation = stringArg(args, "operationKind");
    const requestedBinding = stringArg(args, "bindingKind");
    const requestedDetailLevel = stringArg(args, "detailLevel");
    const detailLevel = discoveryDetailLevel(requestedDetailLevel);
    const operation = operationKind(requestedOperation);
    const binding = publicBindingKind(requestedBinding);
    if (requestedOperation && !operation) return { ok: false, code: "InvalidArguments", message: "operationKind must be Action or Function." };
    if (requestedBinding && !binding) return { ok: false, code: "InvalidArguments", message: "bindingKind must be Global, Entity or EntityCollection." };
    if (requestedDetailLevel && !detailLevel) return { ok: false, code: "InvalidArguments", message: "detailLevel must be names or summary." };
    const includePrivate = boolArg(args, "includePrivate", false);
    const maxResults = maxArg(args, "maxResults", 50, 200);
    // MCP clients should send query explicitly, using "" for an unfiltered catalogue.
    // Normalise again here so direct callers and older clients remain behaviourally safe.
    const query = normalizeQuery(args.query);
    const continuationValue = stringArg(args, "continuationToken");
    const continuation = continuationValue ? decodeContinuation(continuationValue) : undefined;
    if (continuationValue && !continuation) return { ok: false, code: "InvalidArguments", message: "continuationToken is invalid or unsupported." };
    if (continuation && !sameContinuationRequest(continuation, query, operation, binding, includePrivate)) {
      return { ok: false, code: "InvalidArguments", message: "continuationToken does not match the current discovery filters." };
    }
    try {
      const snapshot = await this.repository.discover(environment.environmentUrl);
      const visibleDefinitions = snapshot.definitions.filter((item) => includePrivate || item.isPrivate !== true);
      const filtered = visibleDefinitions
        .filter((item) => !operation || item.operationKind === operation)
        .filter((item) => !binding || definitionBindingKind(item) === binding)
        .filter((item) => matchesText(item, query))
        .sort((left, right) => left.uniqueName.localeCompare(right.uniqueName));
      const startIndex = continuation
        ? filtered.findIndex((item) => item.uniqueName.localeCompare(continuation.afterUniqueName) > 0)
        : 0;
      const pageStart = startIndex < 0 ? filtered.length : startIndex;
      const matches = filtered.slice(pageStart, pageStart + maxResults);
      const hasMore = pageStart + matches.length < filtered.length;
      const nextContinuationToken = hasMore && matches.length > 0
        ? encodeContinuation({ version: 1, afterUniqueName: matches[matches.length - 1].uniqueName, query, operationKind: operation, bindingKind: binding, includePrivate })
        : undefined;
      const operationSummary = countBy(filtered.map((item) => item.operationKind), ["Action", "Function"] as const);
      const bindingValues = filtered.map(definitionBindingKind).filter((value): value is PublicBindingKind => Boolean(value));
      const bindingSummary = countBy(bindingValues, ["Global", "Entity", "EntityCollection"] as const);
      const privateExcluded = includePrivate ? 0 : snapshot.definitions.filter((item) => item.isPrivate === true).length;
      const effectiveDetailLevel = detailLevel ?? "names";
      return {
        ok: true,
        summary: `Found ${filtered.length} matching Custom API definition${filtered.length === 1 ? "" : "s"}; returned ${matches.length}${hasMore ? " with more available" : ""}.`,
        displayText: discoveryDisplayText(filtered.length, matches, effectiveDetailLevel, hasMore, nextContinuationToken),
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-catalogue-v2",
          environmentUrl: environment.environmentUrl,
          filters: { query, operationKind: operation, bindingKind: binding, includePrivate, maxResults, detailLevel: effectiveDetailLevel },
          catalogueCount: snapshot.definitions.length,
          totalMatching: filtered.length,
          returned: matches.length,
          hasMore,
          nextContinuationToken,
          summary: {
            actions: operationSummary.Action,
            functions: operationSummary.Function,
            global: bindingSummary.Global,
            entityBound: bindingSummary.Entity,
            entityCollectionBound: bindingSummary.EntityCollection,
            unresolvedBinding: filtered.length - bindingValues.length,
            privateExcluded
          },
          definitions: matches.map((item) => compactDiscoveryDefinition(item, effectiveDetailLevel)),
          executionContexts: snapshot.executionContexts,
          transports: snapshot.transports,
          nativeFetchFailures: snapshot.nativeFetchFailures,
          evidenceBoundary: "Definitions are mapped from Dataverse Custom API metadata. Discovery does not prove that an operation is exposed through OData or safe to execute. Use nextContinuationToken to retrieve additional results; do not emulate paging with raw $skip queries."
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Custom API discovery failed." };
    }
  }

  public async resolveDefinition(args: Record<string, unknown>): Promise<McpCustomApiDefinitionResolution | DvqrMcpFreeToolResult> {
    const uniqueName = stringArg(args, "uniqueName");
    if (!uniqueName) return { ok: false, code: "InvalidArguments", message: "uniqueName is required." };
    const environment = validateEnvironmentUrl(args, this.config);
    if (!environment.ok) return environment;
    try {
      const snapshot = await this.repository.discover(environment.environmentUrl);
      const definition = snapshot.definitions.find((item) => item.uniqueName.localeCompare(uniqueName, undefined, { sensitivity: "accent" }) === 0) ?? null;
      return {
        environmentUrl: environment.environmentUrl,
        uniqueName,
        definition,
        invocation: definition ? buildInvocationScaffold(definition) : null,
        catalogue: snapshot.definitions,
        executionContexts: snapshot.executionContexts,
        transports: snapshot.transports,
        nativeFetchFailures: snapshot.nativeFetchFailures
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Custom API definition retrieval failed." };
    }
  }

  public async getDefinition(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const resolution = await this.resolveDefinition(args);
    if ("ok" in resolution) return resolution;
    const { environmentUrl, uniqueName, definition, invocation } = resolution;
    if (!definition || !invocation) {
        return {
          ok: true,
          summary: `No Custom API definition named ${uniqueName} was found.`,
          structuredContent: {
            contractVersion: "dvqr-mcp-custom-api-definition-v2",
            environmentUrl,
            uniqueName,
            found: false,
            definition: null,
            invocation: null,
            evidenceBoundary: "DVQR did not guess or substitute a similarly named operation."
          }
        };
      }
      return {
        ok: true,
        summary: `Custom API definition retrieved for ${definition.uniqueName}, including a metadata-derived invocation scaffold.`,
        displayText: definitionDisplayText(definition, invocation),
        structuredContent: {
          contractVersion: "dvqr-mcp-custom-api-definition-v2",
          environmentUrl,
          uniqueName,
          found: true,
          definition,
          invocation,
          evidenceBoundary: "This is metadata discovery only. The invocation scaffold is not proof of OData eligibility or execution safety; separate validation is required before execution."
        }
      };
  }
}
