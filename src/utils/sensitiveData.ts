const SENSITIVE_KEY = /(^|[_-])(access.?token|refresh.?token|client.?secret|password|authorization|private.?key|api.?key|account.?key|shared.?access.?key|connection.?string|sas.?token|signature|sig)$/i;
const SENSITIVE_ENVIRONMENT_KEY = /(token|secret|password|authorization|private.?key|api.?key|account.?key|shared.?access|connection.?string|sas|signature)/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+\/=-]+/gi;
const SECRET_ASSIGNMENT = /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|password|api[_-]?key|accountkey|sharedaccesskey|sharedaccesssignature|connection[_-]?string|sas[_-]?token|signature|sig)\s*[:=]\s*([^\s,;]+)/gi;
const CONNECTION_STRING_FRAGMENT = /\b(AccountKey|SharedAccessKey|SharedAccessSignature|Password)\s*=\s*[^;\s]+/gi;

function sensitiveEnvironmentValues(): readonly string[] {
  const values = Object.entries(process.env)
    .filter(([key, value]) =>
      Boolean(value)
      && SENSITIVE_ENVIRONMENT_KEY.test(key)
      && String(value).length >= 8
    )
    .map(([, value]) => String(value))
    .sort((left, right) => right.length - left.length);
  return [...new Set(values)];
}

function replaceLiteral(value: string, secret: string): string {
  return value.split(secret).join("[REDACTED]");
}

export function isSensitiveDataKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

export function redactSensitiveText(value: string): string {
  let redacted = value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(SECRET_ASSIGNMENT, (_match, key: string) => `${key}=[REDACTED]`)
    .replace(CONNECTION_STRING_FRAGMENT, (match, key: string) => `${key}=[REDACTED]`);

  for (const secret of sensitiveEnvironmentValues()) {
    redacted = replaceLiteral(redacted, secret);
  }
  return redacted;
}

export function containsSensitiveData(value: unknown, depth = 0): boolean {
  if (depth > 16) {
    return false;
  }
  if (typeof value === "string") {
    return redactSensitiveText(value) !== value;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveData(item, depth + 1));
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveDataKey(key) || containsSensitiveData(item, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}
