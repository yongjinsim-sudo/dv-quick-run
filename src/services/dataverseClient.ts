import { buildBatchRequestBody, parseBatchResponse, type BatchExecutionResult } from "./batchExecution.js";

export interface DataverseGetOptions {
  timeoutMs?: number;
}

export interface DataverseExecutionContext {
  correlationId?: string;
  requestId?: string;
  operationId?: string;
  method: string;
  path: string;
  url: string;
  statusCode?: number;
  durationMs?: number;
  timestamp: string;
}

export interface DataverseGetResult<T = unknown> {
  data: T;
  executionContext: DataverseExecutionContext;
}

function getHeader(headers: Headers, names: string[]): string | undefined {
  for (const name of names) {
    const value = headers.get(name);
    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function buildExecutionContext(args: {
  headers: Headers;
  method: string;
  path: string;
  url: string;
  statusCode: number;
  durationMs: number;
}): DataverseExecutionContext {
  return {
    method: args.method,
    path: args.path,
    url: args.url,
    statusCode: args.statusCode,
    durationMs: args.durationMs,
    timestamp: new Date().toISOString(),
    correlationId: getHeader(args.headers, [
      "x-ms-correlation-request-id",
      "x-ms-correlation-id",
      "ms-correlationid",
      "correlationid"
    ]),
    requestId: getHeader(args.headers, [
      "req_id",
      "x-ms-service-request-id",
      "x-ms-request-id",
      "request-id",
      "requestid"
    ]),
    operationId: getHeader(args.headers, [
      "x-ms-diagnostics-operation-id",
      "operation-id",
      "operationid"
    ])
  };
}

export class DataverseClient {
  constructor(private baseUrl: string) {}

  async get(path: string, token: string, options: DataverseGetOptions = {}) {
    const result = await this.getWithMetadata(path, token, options);
    return result.data;
  }

  async getWithMetadata<T = unknown>(path: string, token: string, options: DataverseGetOptions = {}): Promise<DataverseGetResult<T>> {
    const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;
    const controller = typeof options.timeoutMs === "number" && options.timeoutMs > 0
      ? new AbortController()
      : undefined;
    const timeout = controller
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller?.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
          "OData-Version": "4.0",
          "OData-MaxVersion": "4.0"
        }
      });

      const durationMs = Date.now() - startedAt;
      const executionContext = buildExecutionContext({
        headers: response.headers,
        method: "GET",
        path,
        url,
        statusCode: response.status,
        durationMs
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Dataverse error ${response.status} for GET ${url}: ${text}`);
      }
      return {
        data: JSON.parse(text) as T,
        executionContext
      };
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  async batchGet(paths: string[], token: string): Promise<BatchExecutionResult> {
    const normalizedPaths = paths
      .map((path) => path.trim())
      .filter((path) => path.length > 0);

    if (normalizedPaths.length === 0) {
      throw new Error("DV Quick Run: Batch execution requires at least one GET query.");
    }

    const boundary = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const url = `${this.baseUrl}/$batch`;
    const body = buildBatchRequestBody(this.baseUrl, normalizedPaths, boundary);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": `multipart/mixed;boundary=${boundary}`,
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0"
      },
      body
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type");
    const looksLikeBatchResponse = typeof text === "string" && text.includes("--batchresponse_");
    const isMultipartBatchResponse = (contentType ?? "").toLowerCase().includes("multipart/mixed");

    if (!response.ok && !isMultipartBatchResponse && !looksLikeBatchResponse) {
      throw new Error(`Dataverse error ${response.status} for POST ${url}: ${text}`);
    }

    return parseBatchResponse(text, contentType, normalizedPaths);
  }

  async patch(path: string, token: string, body: unknown, ifMatch: string = "*") {
    const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": ifMatch,
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Dataverse error ${response.status} for PATCH ${url}: ${text}`);
    }

    // PATCH often returns 204 No Content
    if (!text) {
      return { status: response.status };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { status: response.status, raw: text };
    }
  }
}