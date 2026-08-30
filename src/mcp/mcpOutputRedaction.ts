import { isSensitiveDataKey, redactSensitiveText } from "../utils/sensitiveData.js";

export function redactMcpOutput(value: unknown, depth = 0): unknown {
  if (depth > 12) {
    return "[REDACTED:DEPTH]";
  }
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactMcpOutput(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveDataKey(key) ? "[REDACTED]" : redactMcpOutput(item, depth + 1);
    }
    return result;
  }
  return value;
}
