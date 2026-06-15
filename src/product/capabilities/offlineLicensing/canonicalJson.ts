function canonicalizeValue(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(null);
}

export function canonicalJson(value: unknown): string {
  return canonicalizeValue(value);
}
