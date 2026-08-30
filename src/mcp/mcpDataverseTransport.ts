import { execFile } from "child_process";
import { promisify } from "util";
import {
  DataverseClient,
  type DataverseExecutionContext,
  type DataverseGetResult
} from "../services/dataverseClient.js";
import { redactSensitiveText } from "../utils/sensitiveData.js";

const execFileAsync = promisify(execFile);

interface PowerShellResponseEnvelope {
  readonly statusCode: number;
  readonly body: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly operationId?: string;
}

export interface DvqrMcpDataverseGetResult<T = unknown> extends DataverseGetResult<T> {
  readonly transport: "node-fetch" | "powershell-fallback";
  readonly nativeFetchFailure?: string;
}

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;
  if (!cause || typeof cause !== "object") {
    return error.message;
  }

  const record = cause as Record<string, unknown>;
  const suffix = [record.code, record.errno, record.syscall, record.hostname]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map(String)
    .join(" | ");

  return suffix ? `${error.message} (${suffix})` : error.message;
}

function shouldUsePowerShellFallback(error: unknown): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause as Record<string, unknown> | undefined;
  const code = cause?.code ? String(cause.code).toUpperCase() : "";
  return error.message.toLowerCase().includes("fetch failed") || [
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED"
  ].includes(code);
}

function buildUrl(baseUrl: string, path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${baseUrl}${path}`;
}

function parseBody<T>(body: string): T {
  if (!body.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return { raw: body } as T;
  }
}

async function getViaPowerShell<T>(args: {
  readonly baseUrl: string;
  readonly path: string;
  readonly token: string;
  readonly timeoutMs: number;
  readonly nativeFetchFailure: string;
}): Promise<DvqrMcpDataverseGetResult<T>> {
  const url = buildUrl(args.baseUrl, args.path);
  const timeoutSeconds = Math.max(1, Math.ceil(args.timeoutMs / 1000));
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$headers = @{
  Authorization = "Bearer $env:DVQR_MCP_ACCESS_TOKEN"
  Accept = "application/json"
  Prefer = 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
  "OData-Version" = "4.0"
  "OData-MaxVersion" = "4.0"
}
try {
  $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $env:DVQR_MCP_REQUEST_URL -Headers $headers -TimeoutSec ${timeoutSeconds}
  $envelope = [ordered]@{
    statusCode = [int]$response.StatusCode
    body = [string]$response.Content
    correlationId = [string]$response.Headers['x-ms-correlation-request-id']
    requestId = [string]$response.Headers['req_id']
    operationId = [string]$response.Headers['x-ms-diagnostics-operation-id']
  }
} catch {
  $webResponse = $_.Exception.Response
  if ($null -eq $webResponse) { throw }
  $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
  try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
  $envelope = [ordered]@{
    statusCode = [int]$webResponse.StatusCode
    body = [string]$body
    correlationId = [string]$webResponse.Headers['x-ms-correlation-request-id']
    requestId = [string]$webResponse.Headers['req_id']
    operationId = [string]$webResponse.Headers['x-ms-diagnostics-operation-id']
  }
}
$envelope | ConvertTo-Json -Compress -Depth 5
`;

  const startedAt = Date.now();
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: {
          ...process.env,
          DVQR_MCP_ACCESS_TOKEN: args.token,
          DVQR_MCP_REQUEST_URL: url
        },
        timeout: args.timeoutMs + 5000,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true
      }
    );

    const envelope = JSON.parse(stdout.toString().trim()) as PowerShellResponseEnvelope;
    if (envelope.statusCode < 200 || envelope.statusCode >= 300) {
      throw new Error(
        `Node transport failed (${args.nativeFetchFailure}). PowerShell fallback connected, but Dataverse returned HTTP ${envelope.statusCode}: ${envelope.body}`
      );
    }
    const executionContext: DataverseExecutionContext = {
      method: "GET",
      path: args.path,
      url,
      statusCode: envelope.statusCode,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      correlationId: envelope.correlationId || undefined,
      requestId: envelope.requestId || undefined,
      operationId: envelope.operationId || undefined
    };

    return {
      data: parseBody<T>(envelope.body),
      executionContext,
      transport: "powershell-fallback",
      nativeFetchFailure: args.nativeFetchFailure
    };
  } catch (error) {
    const details = errorDetails(error);
    throw new Error(
      `Dataverse request failed through both Node fetch and the Windows PowerShell fallback. ` +
      `Node: ${args.nativeFetchFailure}. PowerShell: ${details}. URL: ${url}`
    );
  }
}


async function postViaPowerShell<T>(args: {
  readonly baseUrl: string;
  readonly path: string;
  readonly token: string;
  readonly body: unknown;
  readonly timeoutMs: number;
  readonly nativeFetchFailure: string;
}): Promise<DvqrMcpDataverseGetResult<T>> {
  const url = buildUrl(args.baseUrl, args.path);
  const timeoutSeconds = Math.max(1, Math.ceil(args.timeoutMs / 1000));
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$headers = @{
  Authorization = "Bearer $env:DVQR_MCP_ACCESS_TOKEN"
  Accept = "application/json"
  "Content-Type" = "application/json"
  "OData-Version" = "4.0"
  "OData-MaxVersion" = "4.0"
}
try {
  $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $env:DVQR_MCP_REQUEST_URL -Headers $headers -Body $env:DVQR_MCP_REQUEST_BODY -TimeoutSec ${timeoutSeconds}
  $envelope = [ordered]@{
    statusCode = [int]$response.StatusCode
    body = [string]$response.Content
    correlationId = [string]$response.Headers['x-ms-correlation-request-id']
    requestId = [string]$response.Headers['req_id']
    operationId = [string]$response.Headers['x-ms-diagnostics-operation-id']
  }
} catch {
  $webResponse = $_.Exception.Response
  if ($null -eq $webResponse) { throw }
  $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
  try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
  $envelope = [ordered]@{
    statusCode = [int]$webResponse.StatusCode
    body = [string]$body
    correlationId = [string]$webResponse.Headers['x-ms-correlation-request-id']
    requestId = [string]$webResponse.Headers['req_id']
    operationId = [string]$webResponse.Headers['x-ms-diagnostics-operation-id']
  }
}
$envelope | ConvertTo-Json -Compress -Depth 5
`;

  const startedAt = Date.now();
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: {
          ...process.env,
          DVQR_MCP_ACCESS_TOKEN: args.token,
          DVQR_MCP_REQUEST_URL: url,
          DVQR_MCP_REQUEST_BODY: JSON.stringify(args.body ?? {})
        },
        timeout: args.timeoutMs + 5000,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true
      }
    );

    const envelope = JSON.parse(stdout.toString().trim()) as PowerShellResponseEnvelope;
    if (envelope.statusCode < 200 || envelope.statusCode >= 300) {
      throw new Error(
        `Node transport failed (${args.nativeFetchFailure}). PowerShell fallback connected, but Dataverse returned HTTP ${envelope.statusCode}: ${envelope.body}`
      );
    }
    const executionContext: DataverseExecutionContext = {
      method: "POST",
      path: args.path,
      url,
      statusCode: envelope.statusCode,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      correlationId: envelope.correlationId || undefined,
      requestId: envelope.requestId || undefined,
      operationId: envelope.operationId || undefined
    };

    return {
      data: parseBody<T>(envelope.body),
      executionContext,
      transport: "powershell-fallback",
      nativeFetchFailure: args.nativeFetchFailure
    };
  } catch (error) {
    const details = errorDetails(error);
    throw new Error(
      `Dataverse request failed through both Node fetch and the Windows PowerShell fallback. ` +
      `Node: ${args.nativeFetchFailure}. PowerShell: ${details}. URL: ${url}`
    );
  }
}

export async function mcpDataversePost<T = unknown>(args: {
  readonly baseUrl: string;
  readonly path: string;
  readonly token: string;
  readonly body: unknown;
  readonly timeoutMs: number;
}): Promise<DvqrMcpDataverseGetResult<T>> {
  const client = new DataverseClient(args.baseUrl);

  try {
    const result = await client.postWithMetadata<T>(args.path, args.token, args.body, { timeoutMs: args.timeoutMs });
    return {
      ...result,
      transport: "node-fetch"
    };
  } catch (error) {
    const nativeFetchFailure = errorDetails(error);
    if (!shouldUsePowerShellFallback(error)) {
      throw new Error(`${nativeFetchFailure}. URL: ${buildUrl(args.baseUrl, args.path)}`);
    }

    process.stderr.write(`[DVQR MCP] Node POST failed; retrying through Windows PowerShell transport: ${redactSensitiveText(nativeFetchFailure)}\n`);
    return postViaPowerShell<T>({
      ...args,
      nativeFetchFailure
    });
  }
}

export async function mcpDataverseGet<T = unknown>(args: {
  readonly baseUrl: string;
  readonly path: string;
  readonly token: string;
  readonly timeoutMs: number;
}): Promise<DvqrMcpDataverseGetResult<T>> {
  const client = new DataverseClient(args.baseUrl);

  try {
    const result = await client.getWithMetadata<T>(args.path, args.token, { timeoutMs: args.timeoutMs });
    return {
      ...result,
      transport: "node-fetch"
    };
  } catch (error) {
    const nativeFetchFailure = errorDetails(error);
    if (!shouldUsePowerShellFallback(error)) {
      throw new Error(`${nativeFetchFailure}. URL: ${buildUrl(args.baseUrl, args.path)}`);
    }

    process.stderr.write(`[DVQR MCP] Node fetch failed; retrying through Windows PowerShell transport: ${redactSensitiveText(nativeFetchFailure)}\n`);
    return getViaPowerShell<T>({
      ...args,
      nativeFetchFailure
    });
  }
}
