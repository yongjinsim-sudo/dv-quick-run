export function normalizeReasoningName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
