export interface StructuredExecutionError {
  readonly contractVersion: "dvqr-mcp-structured-execution-error-v1";
  readonly code: string;
  readonly summary: string;
  readonly transport?: {
    readonly primary?: { readonly kind: "node-fetch"; readonly outcome: "failed"; readonly code?: string; readonly message: string };
    readonly fallback?: { readonly kind: "windows-powershell"; readonly outcome: "connected" | "failed"; readonly message?: string };
  };
  readonly http?: { readonly status?: number };
  readonly dataverse?: { readonly code?: string; readonly message?: string; readonly category?: string; readonly property?: string; readonly table?: string };
  readonly query?: { readonly text?: string; readonly entitySet?: string };
  readonly suggestedNextActions: readonly string[];
  readonly diagnostics?: { readonly rawMessage: string };
}

function extractJson(message: string): Record<string, any> | undefined {
  const first = message.indexOf("{");
  const last = message.lastIndexOf("}");
  if (first < 0 || last <= first) {
    return undefined;
  }
  try { return JSON.parse(message.slice(first, last + 1)); } catch { return undefined; }
}

function transportCode(message: string): string | undefined {
  return ["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"]
    .find((code) => message.toUpperCase().includes(code));
}

export function mapStructuredExecutionError(error: unknown, query?: string, entitySet?: string): StructuredExecutionError {
  const raw = error instanceof Error ? error.message : String(error);
  const statusMatch = raw.match(/Dataverse error\s+(\d{3})|HTTP\s+(\d{3})/i);
  const status = Number(statusMatch?.[1] ?? statusMatch?.[2]) || undefined;
  const payload = extractJson(raw);
  const dvError = payload?.error ?? payload;
  const dvCode = typeof dvError?.code === "string" ? dvError.code : raw.match(/0x[0-9a-f]+/i)?.[0];
  const dvMessage = typeof dvError?.message === "string" ? dvError.message : raw;
  const unknownNav = dvMessage.match(/property named '([^']+)'[^]*type 'Microsoft\.Dynamics\.CRM\.([^']+)'/i);
  const unknownProperty = dvMessage.match(/Could not find a property named '([^']+)'/i);
  const category = unknownNav ? "UnknownNavigationProperty" : unknownProperty ? "UnknownProperty" : status === 403 ? "AccessDenied" : status === 429 ? "Throttled" : "DataverseRequestFailed";
  const suggestedNextActions = category === "UnknownNavigationProperty"
    ? ["Resolve the navigation property from metadata.", "Search for a bridge table between the source and target tables.", "Run Relationship Path Intelligence."]
    : category === "UnknownProperty"
      ? ["Search table columns and lookup value properties.", "Validate the query with metadata before retrying."]
      : category === "AccessDenied"
        ? ["Confirm the caller can read the requested table and fields.", "Treat the failure as an access limitation, not proof of business causality."]
        : category === "Throttled"
          ? ["Respect Dataverse retry guidance and reduce request volume."]
          : ["Inspect the structured Dataverse error and validate the query against metadata."];

  const nativeMarker = raw.match(/Node:\s*([^.]*(?:\.[^P]*?)?)\.\s*PowerShell:/i)?.[1];
  const primaryMessage = nativeMarker?.trim();
  return {
    contractVersion: "dvqr-mcp-structured-execution-error-v1",
    code: category === "UnknownNavigationProperty" || category === "UnknownProperty" ? "DataverseQueryRejected" : "ExecutionFailed",
    summary: category === "UnknownNavigationProperty"
      ? `Dataverse rejected the query because navigation property ${unknownNav?.[1] ?? unknownProperty?.[1] ?? "the requested property"} does not exist.`
      : category === "UnknownProperty"
        ? `Dataverse rejected the query because property ${unknownProperty?.[1] ?? "the requested property"} does not exist.`
        : `Dataverse request failed${status ? ` with HTTP ${status}` : ""}.`,
    ...(primaryMessage ? { transport: { primary: { kind: "node-fetch", outcome: "failed", code: transportCode(primaryMessage), message: primaryMessage }, fallback: { kind: "windows-powershell", outcome: status ? "connected" : "failed" } } } : {}),
    ...(status ? { http: { status } } : {}),
    dataverse: { code: dvCode, message: dvMessage, category, property: unknownNav?.[1] ?? unknownProperty?.[1], table: unknownNav?.[2] },
    query: { text: query, entitySet },
    suggestedNextActions,
    diagnostics: { rawMessage: raw }
  };
}
