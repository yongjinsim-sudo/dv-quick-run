const SENSITIVE_KEY = /(^|_)(access.?token|refresh.?token|client.?secret|password|authorization|private.?key|api.?key)$/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+\/-]+/gi;
const SECRET_ASSIGNMENT = /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|password|api[_-]?key|accountkey|sharedaccesskey|sharedaccesssignature)\s*[:=]\s*([^\s,;]+)/gi;

function redactString(value: string): string {
  return value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(SECRET_ASSIGNMENT, (_match, key: string) => `${key}=[REDACTED]`);
}

export function redactMcpOutput(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[REDACTED:DEPTH]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactMcpOutput(item, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactMcpOutput(item, depth + 1);
    }
    return result;
  }
  return value;
}
