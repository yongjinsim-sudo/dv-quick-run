export function toFriendlyLabel(
  logicalName: string,
  displayName?: string
): string {
  const preferred = displayName?.trim();
  if (preferred) {
    return preferred;
  }

  return logicalName
    .replace(/^_/, "")
    .replace(/_value$/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function prettifyEntityName(entityLogicalName: string): string {
  return toFriendlyLabel(entityLogicalName);
}

export function normalize(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

