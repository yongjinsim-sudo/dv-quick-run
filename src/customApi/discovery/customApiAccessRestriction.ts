export interface CustomApiAccessRestrictionDetails {
  readonly isAccessRestriction: boolean;
  readonly statusCode?: number;
  readonly principalId?: string;
  readonly missingPrivilege?: string;
  readonly entityLogicalName?: string;
  readonly correlationId?: string;
  readonly message: string;
}

const accessRestrictionPatterns = [
  /\b401\b/i,
  /\b403\b/i,
  /Principal user .* is missing .* privilege/i,
  /missing .* privilege/i,
  /prvReadCustomAPI/i,
  /ReadCustomAPI/i,
  /Access is denied/i,
  /privilege/i
];

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function extractJsonObject(text: string): unknown {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return undefined;
  }

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return undefined;
  }
}

function findStringDeep(value: unknown, predicate: (candidate: string) => boolean): string | undefined {
  if (typeof value === "string") {
    return predicate(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringDeep(item, predicate);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findStringDeep(item, predicate);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

function extractMessage(raw: string, parsed: unknown): string {
  const parsedMessage = findStringDeep(parsed, (candidate) => /Principal user|missing|privilege|access/i.test(candidate));
  return parsedMessage ?? raw;
}

export function parseCustomApiAccessRestriction(error: unknown): CustomApiAccessRestrictionDetails | undefined {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const parsed = extractJsonObject(rawMessage);
  const message = extractMessage(rawMessage, parsed);
  const combined = `${rawMessage}\n${message}`;

  if (!accessRestrictionPatterns.some((pattern) => pattern.test(combined))) {
    return undefined;
  }

  const statusCodeMatch = combined.match(/(?:error\s+|HTTP\s+)?(401|403)\b/i);
  const principalMatch = combined.match(/Principal user \(Id=([^,)\s]+)/i);
  const privilegeMatch = combined.match(/missing\s+([A-Za-z0-9_]+)\s+privilege/i)
    ?? combined.match(/(prv[A-Za-z0-9_]+)/i);
  const entityMatch = combined.match(/entity\s+'([^']+)'/i)
    ?? combined.match(/LocalizedName='([^']+)'/i);
  const correlationMatch = combined.match(/(?:CorrelationId|correlationId)["'=:\s]+([0-9a-fA-F-]{16,})/i);

  return {
    isAccessRestriction: true,
    statusCode: statusCodeMatch ? Number(statusCodeMatch[1]) : undefined,
    principalId: toText(principalMatch?.[1]),
    missingPrivilege: toText(privilegeMatch?.[1]),
    entityLogicalName: toText(entityMatch?.[1]),
    correlationId: toText(correlationMatch?.[1]),
    message
  };
}

export function formatCustomApiAccessRestrictionSummary(details: CustomApiAccessRestrictionDetails): string {
  const lines = [
    "Capability Explorer unavailable",
    "",
    "Custom API discovery is restricted in this environment or security context."
  ];

  if (details.principalId) {
    lines.push("", `Principal user: ${details.principalId}`);
  }

  if (details.missingPrivilege) {
    lines.push(`Missing privilege: ${details.missingPrivilege}`);
  }

  if (details.entityLogicalName) {
    lines.push(`Required entity: ${details.entityLogicalName}`);
  }

  lines.push("", "Ask your administrator to grant access to Custom API metadata discovery.");

  if (details.correlationId) {
    lines.push("", `Correlation ID: ${details.correlationId}`);
  }

  return lines.join("\n");
}
