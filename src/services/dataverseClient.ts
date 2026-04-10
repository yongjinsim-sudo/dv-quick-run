import { buildBatchRequestBody, parseBatchResponse, type BatchExecutionResult } from "./batchExecution.js";

export class DataverseClient {
  constructor(private baseUrl: string) {}

  async get(path: string, token: string) {
    const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0"
      }
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Dataverse error ${response.status} for GET ${url}: ${text}`);
    }
    return JSON.parse(text);
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