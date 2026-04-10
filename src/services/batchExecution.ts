export type BatchExecutionPart = {
  index: number;
  queryText: string;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  resultType: "collection" | "single" | "error" | "empty" | "raw";
  payload?: unknown;
  rawBody?: string;
  error?: string;
};

export type BatchExecutionResult = {
  boundary: string;
  parts: BatchExecutionPart[];
};

export function buildBatchRequestBody(baseUrl: string, queries: string[], boundary: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  return queries
    .map((query) => {
      const normalizedPath = query.trim().startsWith("/") ? query.trim() : `/${query.trim()}`;
      const requestUrl = `${normalizedBase}${normalizedPath}`;

      return [
        `--${boundary}`,
        "Content-Type: application/http",
        "Content-Transfer-Encoding: binary",
        "",
        `GET ${requestUrl} HTTP/1.1`,
        "Accept: application/json",
        'Prefer: odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        "OData-Version: 4.0",
        "OData-MaxVersion: 4.0",
        "",
        ""
      ].join("\r\n");
    })
    .concat(`--${boundary}--\r\n`)
    .join("");
}

export function parseBatchResponse(text: string, contentType: string | null, queries: string[]): BatchExecutionResult {
  const boundary = extractBoundary(contentType, text);
  const rawParts = splitMultipartBody(text, boundary);
  const parts = rawParts.map((rawPart, index) => parseBatchPart(rawPart, index, queries[index] ?? `Request ${index + 1}`));

  return {
    boundary,
    parts
  };
}

function extractBoundary(contentType: string | null, body: string): string {
  const match = contentType?.match(/boundary=([^;]+)/i);
  if (match?.[1]) {
    return stripBoundaryQuotes(match[1]);
  }

  const firstBoundaryLine = body
    .split(/\r?\n/)
    .find((line) => line.startsWith("--batchresponse_") || line.startsWith("--changesetresponse_") || line.startsWith("--batch_"));

  if (!firstBoundaryLine) {
    throw new Error("DV Quick Run: Could not determine batch response boundary.");
  }

  return firstBoundaryLine.replace(/^--/, "").trim();
}

function stripBoundaryQuotes(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}

function splitMultipartBody(body: string, boundary: string): string[] {
  const marker = `--${boundary}`;

  return body
    .split(marker)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "--");
}

function parseBatchPart(rawPart: string, index: number, queryText: string): BatchExecutionPart {
  const normalized = rawPart.replace(/^\r?\n+/, "");
  const httpStart = normalized.indexOf("HTTP/");

  if (httpStart < 0) {
    return {
      index,
      queryText,
      statusCode: 0,
      statusText: "Malformed batch part",
      headers: {},
      resultType: "error",
      rawBody: normalized,
      error: "Batch part did not contain an HTTP response payload."
    };
  }

  const httpPayload = normalized.slice(httpStart);
  const separator = httpPayload.indexOf("\r\n\r\n") >= 0 ? "\r\n\r\n" : "\n\n";
  const [headerBlock, ...bodyParts] = httpPayload.split(separator);
  const headerLines = headerBlock.split(/\r?\n/);
  const statusLine = headerLines.shift() ?? "HTTP/1.1 0 Unknown";
  const statusMatch = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/i);
  const statusCode = statusMatch ? Number.parseInt(statusMatch[1], 10) : 0;
  const statusText = statusMatch?.[2]?.trim() || "Unknown";
  const headers: Record<string, string> = {};

  for (const line of headerLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (name) {
      headers[name] = value;
    }
  }

  const rawBody = bodyParts.join(separator).trim();
  const contentType = headers["content-type"] ?? "";

  if (!rawBody) {
    return {
      index,
      queryText,
      statusCode,
      statusText,
      headers,
      resultType: statusCode >= 400 ? "error" : "empty"
    };
  }

  if (contentType.includes("application/json") || rawBody.startsWith("{") || rawBody.startsWith("[")) {
    try {
      const payload = JSON.parse(rawBody) as unknown;
      return {
        index,
        queryText,
        statusCode,
        statusText,
        headers,
        resultType: inferResultType(statusCode, payload),
        payload,
        rawBody,
        error: statusCode >= 400 ? extractErrorMessage(payload) : undefined
      };
    } catch {
      // fall through
    }
  }

  return {
    index,
    queryText,
    statusCode,
    statusText,
    headers,
    resultType: statusCode >= 400 ? "error" : "raw",
    rawBody,
    error: statusCode >= 400 ? rawBody : undefined
  };
}

function inferResultType(statusCode: number, payload: unknown): BatchExecutionPart["resultType"] {
  if (statusCode >= 400) {
    return "error";
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>).value;
    if (Array.isArray(value)) {
      return "collection";
    }

    return "single";
  }

  return "raw";
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const root = payload as Record<string, unknown>;
  const error = root.error;

  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return undefined;
}
