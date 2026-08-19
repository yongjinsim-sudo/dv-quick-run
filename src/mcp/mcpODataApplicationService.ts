import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { parseDataverseQuery } from "../core/query/parseDataverseQuery.js";
import {
  buildQueryDesignNotes,
  buildQueryIntentLines,
  buildQueryOperationalCharacteristics,
  buildQuerySummary,
  buildQueryVerificationGuidance
} from "../core/query/queryExplanationProjection.js";
import { buildQuerySemanticModel } from "../core/query/querySemanticModel.js";
import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { rootEntitySetFromODataQuery } from "./mcpODataPath.js";
import { stringArg, validateEnvironmentUrl } from "./mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

function boundedResult(data: unknown, maxRecords: number): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.value)) {
    return data;
  }
  return {
    ...record,
    value: record.value.slice(0, maxRecords),
    dvqrMcp: {
      returnedRecords: Math.min(record.value.length, maxRecords),
      sourceRecordsInResponse: record.value.length,
      truncated: record.value.length > maxRecords
    }
  };
}

function describeBoundedResult(data: unknown): { recordCount?: number; truncated: boolean } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { truncated: false };
  }
  const record = data as Record<string, unknown>;
  const dvqrMcp = record.dvqrMcp;
  if (dvqrMcp && typeof dvqrMcp === "object" && !Array.isArray(dvqrMcp)) {
    const details = dvqrMcp as Record<string, unknown>;
    return {
      recordCount: typeof details.returnedRecords === "number" ? details.returnedRecords : undefined,
      truncated: details.truncated === true
    };
  }
  return { truncated: false };
}

export class McpODataApplicationService {
  public constructor(private readonly config: DvqrMcpRuntimeConfiguration) {}

  public explain(args: Record<string, unknown>): DvqrMcpFreeToolResult {
    const query = stringArg(args, "query");
    if (!query) {
      return { ok: false, code: "InvalidArguments", message: "query is required." };
    }
    const parsed = parseDataverseQuery(query);
    const semanticModel = buildQuerySemanticModel(parsed);
    const summary = buildQuerySummary(parsed);
    return {
      ok: true,
      summary,
      structuredContent: {
        contractVersion: "dvqr-mcp-query-explanation-v1",
        summary,
        intent: buildQueryIntentLines(parsed),
        operationalCharacteristics: buildQueryOperationalCharacteristics(parsed),
        designNotes: buildQueryDesignNotes(parsed),
        verificationGuidance: buildQueryVerificationGuidance(parsed),
        semanticModel
      }
    };
  }

  public async execute(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const query = stringArg(args, "query");
    if (!query) {
      return { ok: false, code: "InvalidArguments", message: "query is required." };
    }

    const environment = validateEnvironmentUrl(args, this.config);
    if (!environment.ok) {
      return environment;
    }

    const parsed = parseDataverseQuery(query);
    const rootEntitySetName = parsed.entitySetName ?? rootEntitySetFromODataQuery(query);
    if (!rootEntitySetName) {
      return { ok: false, code: "InvalidArguments", message: "The OData query does not contain a valid root entity set." };
    }

    const normalizedPath = parsed.normalized.startsWith("/") ? parsed.normalized : `/${parsed.normalized}`;
    try {
      const scope = `${environment.environmentUrl}/.default`;
      const token = await getDataverseAccessToken(scope, this.config.tenantId);
      const result = await mcpDataverseGet({
        baseUrl: `${environment.environmentUrl}/api/data/v9.2`,
        path: normalizedPath,
        token,
        timeoutMs: this.config.requestTimeoutMs
      });
      const requestedMax = Number(args.maxRecords ?? 100);
      const maxRecords = Number.isFinite(requestedMax) ? Math.max(1, Math.min(500, Math.floor(requestedMax))) : 100;
      const data = boundedResult(result.data, maxRecords);
      const resultDetails = describeBoundedResult(data);
      const recordSummary = resultDetails.recordCount === undefined
        ? "Response payload returned."
        : `${resultDetails.recordCount} record${resultDetails.recordCount === 1 ? "" : "s"} returned${resultDetails.truncated ? " (bounded result truncated)" : ""}.`;
      return {
        ok: true,
        summary: `Read-only OData GET completed with status ${result.executionContext.statusCode ?? "unknown"}. ${recordSummary}`,
        structuredContent: {
          contractVersion: "dvqr-mcp-odata-result-v1",
          environmentUrl: environment.environmentUrl,
          query: parsed.normalized,
          executionContext: result.executionContext,
          transport: result.transport,
          nativeFetchFailure: result.nativeFetchFailure,
          data
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error, parsed.normalized, rootEntitySetName);
      return {
        ok: false,
        code: "ExecutionFailed",
        message: structuredError.summary,
        structuredError
      };
    }
  }
}
