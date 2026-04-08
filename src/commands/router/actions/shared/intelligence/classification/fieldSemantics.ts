export function getBaseFieldLogicalName(fieldName: string): string {
  const trimmed = fieldName.trim();
  const lookupMatch = /^_(.+)_value$/i.exec(trimmed);
  return lookupMatch?.[1] ?? trimmed;
}

export function isLookupBackingField(fieldName: string): boolean {
  return /^_.+_value$/i.test(fieldName.trim());
}

export function getBusinessSemanticBoost(fieldName: string): number {
  const normalized = getBaseFieldLogicalName(fieldName).toLowerCase();
  let score = 0;

  const primaryBusinessTokens = ["status", "state"];
  const highValueTokens = ["intent", "priority", "category", "reason", "type", "kind", "channel", "source", "outcome"];
  const mediumValueTokens = ["stage", "classification", "result", "mode"];

  if (primaryBusinessTokens.some((token) => normalized.includes(token))) {
    score += 3.2;
  }

  if (highValueTokens.some((token) => normalized.includes(token))) {
    score += 2.2;
  }

  if (mediumValueTokens.some((token) => normalized.includes(token))) {
    score += 1.0;
  }

  if (normalized.endsWith("code")) {
    score += 0.4;
  }

  return score;
}
