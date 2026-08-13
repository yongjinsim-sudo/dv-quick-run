import type { McpCustomApiExecutionEvidence, McpCustomApiExecutionEvidenceRepository } from "./mcpCustomApiExecutionEvidenceStore.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

export type McpCustomApiExecutionClassification =
  | "ExecutionSuccessful"
  | "InputValidationFailure"
  | "AuthenticationFailure"
  | "AuthorizationFailure"
  | "TransportFailure"
  | "BusinessRuleFailure"
  | "DataverseFailure"
  | "UnknownFailure";

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function statusCode(evidence: McpCustomApiExecutionEvidence): number | undefined {
  return numberValue(evidence.executionContext?.statusCode)
    ?? numberValue((evidence.structuredError as any)?.http?.status);
}

function errorText(evidence: McpCustomApiExecutionEvidence): string {
  return [
    evidence.message,
    (evidence.structuredError as any)?.summary,
    (evidence.structuredError as any)?.dataverse?.message,
    (evidence.structuredError as any)?.message
  ].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
}

function classify(evidence: McpCustomApiExecutionEvidence): McpCustomApiExecutionClassification {
  if (evidence.executed) return "ExecutionSuccessful";
  const status = statusCode(evidence);
  const text = errorText(evidence);
  if (status === 401) return "AuthenticationFailure";
  if (status === 403) return "AuthorizationFailure";
  if (status === 400 || /invalidargument|validation|missing required|culture is not supported/.test(text)) return "InputValidationFailure";
  if (/business rule|plugin|isv code|operation failed/.test(text)) return "BusinessRuleFailure";
  if (/transport|fetch failed|self_signed_cert|network|timeout|econn/.test(text) && !status) return "TransportFailure";
  if (typeof status === "number" && status >= 400) return "DataverseFailure";
  return "UnknownFailure";
}

function outputAnalysis(evidence: McpCustomApiExecutionEvidence): readonly Record<string, unknown>[] {
  const expected = new Map((evidence.expectedOutputs ?? []).map((item) => [item.uniqueName, item.type]));
  const response = evidence.response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return [];
  return Object.keys(response as Record<string, unknown>).sort().map((name) => {
    const value = (response as Record<string, unknown>)[name];
    const analysis: Record<string, unknown> = {
      uniqueName: name,
      type: expected.get(name) ?? typeof value,
      returned: true,
      value
    };
    if (typeof value === "string") analysis.length = value.length;
    if (Array.isArray(value)) analysis.itemCount = value.length;
    if (value && typeof value === "object" && !Array.isArray(value)) analysis.propertyCount = Object.keys(value as Record<string, unknown>).length;
    return analysis;
  });
}

function recommendations(classification: McpCustomApiExecutionClassification): readonly string[] {
  switch (classification) {
    case "ExecutionSuccessful": return ["Review the returned outputs for business suitability.", "Create a fresh preview before another execution.", "Export or preserve the runtime evidence when it supports an investigation."];
    case "InputValidationFailure": return ["Review the exact parameter metadata and runtime error.", "Correct the rejected input value and generate a fresh preview.", "Do not assume accepted values unless the API metadata or runtime evidence confirms them."];
    case "AuthenticationFailure": return ["Refresh or verify the Dataverse access token.", "Confirm the configured tenant and environment."];
    case "AuthorizationFailure": return ["Review the caller's Dataverse privileges and environment policy.", "Retry only after permissions are independently verified."];
    case "TransportFailure": return ["Inspect primary and fallback transport evidence.", "Verify network, proxy and certificate configuration before retrying."];
    case "BusinessRuleFailure": return ["Inspect the Dataverse runtime message and relevant server-side automation.", "Generate a fresh preview only after the business-rule condition is understood."];
    case "DataverseFailure": return ["Inspect the HTTP status and Dataverse error payload.", "Review the exact route and runtime environment before retrying."];
    default: return ["Inspect the raw runtime evidence.", "Avoid guessing the cause without additional evidence."];
  }
}

function httpLabel(status: number | undefined): string {
  if (status === undefined) return "Unknown";
  const labels: Record<number, string> = {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable"
  };
  return labels[status] ? `${status} ${labels[status]}` : String(status);
}

function transportLabel(value: string | undefined): string {
  if (value === "node-fetch") return "Node Fetch";
  if (value === "powershell") return "PowerShell";
  return value ? value : "Not recorded";
}

function renderExecutionIntelligenceReport(input: {
  readonly uniqueName: string;
  readonly classification: McpCustomApiExecutionClassification;
  readonly executed: boolean;
  readonly status?: number;
  readonly durationMs?: number;
  readonly transport?: string;
  readonly nativeFetchFailure?: string;
  readonly recordedAtUtc: string;
  readonly outputs: readonly Record<string, unknown>[];
  readonly runtimeMessage?: string;
  readonly recommendations: readonly string[];
}): string {
  const lines: string[] = [
    input.executed ? "✓ Execution Successful" : "✗ Execution Failed",
    "",
    "Execution Intelligence Report",
    "────────────────────────────────",
    "",
    "Summary",
    `Operation: ${input.uniqueName}`,
    `Classification: ${input.classification}`,
    `Outcome: ${input.executed ? "Completed" : "Failed"}`,
    "",
    "Execution",
    `HTTP: ${httpLabel(input.status)}`,
    `Duration: ${input.durationMs === undefined ? "Not recorded" : `${input.durationMs} ms`}`,
    "",
    "Transport",
    `Primary transport: ${transportLabel(input.transport)}`,
    `Fallback: ${input.transport === "powershell" ? "PowerShell used" : "Not required or not recorded"}`,
    ...(input.nativeFetchFailure ? [`Primary transport evidence: ${input.nativeFetchFailure}`] : []),
    "",
    "Timeline",
    `Evidence stored: ${input.recordedAtUtc}`,
    ...(input.durationMs === undefined ? [] : [`Dataverse request duration: ${input.durationMs} ms`]),
    "",
    "Outputs"
  ];

  if (input.outputs.length === 0) {
    lines.push("No runtime outputs were returned.");
  } else {
    for (const output of input.outputs) {
      lines.push(`• ${String(output.uniqueName)}`);
      lines.push(`  Type: ${String(output.type)}`);
      lines.push(`  Returned: ${output.returned === true ? "Yes" : "No"}`);
      if (typeof output.length === "number") lines.push(`  Length: ${output.length} characters`);
      if (typeof output.itemCount === "number") lines.push(`  Items: ${output.itemCount}`);
      if (typeof output.propertyCount === "number") lines.push(`  Properties: ${output.propertyCount}`);
      if (Object.prototype.hasOwnProperty.call(output, "value")) lines.push(`  Value: ${typeof output.value === "string" ? output.value : JSON.stringify(output.value)}`);
    }
  }

  if (input.runtimeMessage) {
    lines.push("", "Runtime evidence", input.runtimeMessage);
  }

  lines.push("", "Recommended Next Actions");
  for (const step of input.recommendations) lines.push(`• ${step}`);
  lines.push(
    "",
    "Evidence Boundary",
    "This report interprets stored runtime observations returned by Dataverse or the DVQR transport layer.",
    "DV Quick Run has not inferred business correctness, accepted input values, downstream side effects or business suitability.",
    "No execution was performed while generating this report."
  );
  return lines.join("\n");
}

export class McpCustomApiExecutionInterpretationApplicationService {
  public constructor(private readonly executions: McpCustomApiExecutionEvidenceRepository) {}

  public interpret(args: Record<string, unknown>): DvqrMcpFreeToolResult {
    const executionId = stringArg(args, "executionId");
    const evidence = executionId ? this.executions.get(executionId) : this.executions.getLatest();
    if (!evidence) {
      return { ok: false, code: "InvalidArguments", message: executionId ? `No stored Custom API execution exists for executionId ${executionId}.` : "No completed Custom API execution is available to interpret." };
    }
    const classification = classify(evidence);
    const status = statusCode(evidence);
    const durationMs = numberValue(evidence.executionContext?.durationMs);
    const outputs = outputAnalysis(evidence);
    const nextSteps = recommendations(classification);
    const transportSummary = {
      primary: evidence.transport ?? "unknown",
      primaryDisplayName: transportLabel(evidence.transport),
      fallbackUsed: evidence.transport === "powershell",
      fallbackDisplayName: evidence.transport === "powershell" ? "PowerShell" : "Not required or not recorded",
      nativeFetchFailure: evidence.nativeFetchFailure
    };
    const timeline = [
      { event: "Execution evidence recorded", atUtc: evidence.recordedAtUtc },
      ...(durationMs === undefined ? [] : [{ event: "Dataverse request duration", durationMs }]),
      { event: "Interpretation generated" }
    ];
    const displayText = renderExecutionIntelligenceReport({
      uniqueName: evidence.uniqueName,
      classification,
      executed: evidence.executed,
      status,
      durationMs,
      transport: evidence.transport,
      nativeFetchFailure:
        typeof evidence.nativeFetchFailure === "string"
          ? evidence.nativeFetchFailure
          : undefined,
      recordedAtUtc: evidence.recordedAtUtc,
      outputs,
      runtimeMessage: evidence.message,
      recommendations: nextSteps
    });
    return {
      ok: true,
      summary: `${evidence.uniqueName} execution classified as ${classification}.`,
      displayText,
      structuredContent: {
        contractVersion: "dvqr-mcp-custom-api-execution-interpretation-v1",
        reportTitle: "Execution Intelligence Report",
        executionId: evidence.executionId,
        uniqueName: evidence.uniqueName,
        classification,
        executed: evidence.executed,
        httpStatus: status,
        httpStatusDisplay: httpLabel(status),
        durationMs,
        transportSummary,
        timeline,
        outputs,
        runtimeMessage: evidence.message,
        rawError: evidence.structuredError,
        recommendations: nextSteps,
        evidenceBoundary: "This report interprets stored runtime observations returned by Dataverse or the DVQR transport layer. DVQR has not inferred business correctness, accepted input values, downstream side effects or business suitability.",
        noExecutionPerformed: true
      }
    };
  }
}
