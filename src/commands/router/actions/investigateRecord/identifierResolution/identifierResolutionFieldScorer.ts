export function scoreIdentifierField(args: {
  entityLogicalName: string;
  fieldLogicalName: string;
  attributeType?: string;
  currentEntityLogicalName?: string;
  currentFieldLogicalName?: string;
  primaryIdField?: string;
}): { score: number; reason: string } {
  const field = args.fieldLogicalName.trim().toLowerCase();
  const entity = args.entityLogicalName.trim().toLowerCase();
  const currentEntity = String(args.currentEntityLogicalName ?? "").trim().toLowerCase();
  const currentField = String(args.currentFieldLogicalName ?? "").trim().toLowerCase();
  const primaryIdField = String(args.primaryIdField ?? "").trim().toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (currentEntity && entity === currentEntity) {
    score += 100;
    reasons.push("same entity");
  }

  if (currentField && field === currentField) {
    score += 120;
    reasons.push("same field");
  }

  if (field === primaryIdField) {
    score -= 500;
    reasons.push("primary id excluded in identifier mode");
  }

  if (looksIdentifierLike(field)) {
    score += 50;
    reasons.push("identifier-like field");
  }

  const attributeType = String(args.attributeType ?? "").trim().toLowerCase();
  if (attributeType === "uniqueidentifier") {
    score += 20;
    reasons.push("guid field");
  }

  if (attributeType === "string" || attributeType === "memo") {
    score += 10;
    reasons.push("text field");
  }

  return {
    score,
    reason: reasons.join(", ") || "candidate"
  };
}

export function looksIdentifierLike(fieldLogicalName: string): boolean {
  const normalized = fieldLogicalName.trim().toLowerCase();

  if (!normalized || normalized.startsWith("_") || normalized.includes("@") || normalized.includes(".")) {
    return false;
  }

  if (normalized.endsWith("name") || normalized.endsWith("type") || normalized.endsWith("typename")) {
    return false;
  }

  return normalized.endsWith("id")
    || normalized.includes("_id")
    || normalized.includes("identifier")
    || normalized.includes("reference")
    || normalized.includes("external")
    || normalized.includes("source")
    || normalized.includes("legacy")
    || normalized.includes("unique")
    || normalized.includes("token")
    || normalized.includes("code")
    || normalized.includes("key")
    || normalized.includes("number");
}
