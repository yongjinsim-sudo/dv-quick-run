export type LookupLikeAttributeType = "lookup" | "customer" | "owner";

export type UnsupportedSelectAttributeType = "virtual" | "managedproperty" | "partylist";

export type RelationshipType = "ManyToOne" | "OneToMany" | "ManyToMany";

export interface EntityMetadata {
  entitySetName: string;
  logicalName: string;
  displayName?: string;
  primaryIdAttribute?: string;
  primaryNameAttribute?: string;
}

export interface FieldMetadata {
  logicalName: string;
  attributeType?: string;
  attributeOf?: string;
  schemaName?: string;
  displayName?: string;
  isValidForRead?: boolean;
  isValidForCreate?: boolean;
  isValidForUpdate?: boolean;
  lookupTargets?: string[];
}

export interface RelationshipMetadata {
  navigationPropertyName: string;
  relationshipType: RelationshipType;
  referencingAttribute?: string;
  referencedEntity?: string;
  referencingEntity?: string;
  schemaName?: string;
}

export function normalizeMetadataName(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

export function normalizeMetadataBool(value: unknown, defaultValue = true): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "object" && value && "Value" in value) {
    const wrapped = (value as { Value?: unknown }).Value;
    return typeof wrapped === "boolean" ? wrapped : defaultValue;
  }

  return defaultValue;
}

export function normalizeMetadataStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => normalizeMetadataName(item))
    .filter((item): item is string => !!item);

  return items.length ? items : undefined;
}

export function isLookupLikeAttributeType(attributeType?: string): boolean {
  const normalized = (attributeType ?? "").trim().toLowerCase();
  return normalized === "lookup" || normalized === "customer" || normalized === "owner";
}

export function isUnsupportedSelectAttributeType(attributeType?: string): boolean {
  const normalized = (attributeType ?? "").trim().toLowerCase();
  return normalized === "virtual" || normalized === "managedproperty" || normalized === "partylist";
}

export function isChoiceAttributeType(attributeType?: string): boolean {
  const normalized = (attributeType ?? "").trim().toLowerCase();
  return normalized === "picklist" || normalized === "state" || normalized === "status";
}

export function buildLookupSelectToken(logicalName: string, attributeType?: string): string | undefined {
  const normalizedName = logicalName.trim();
  if (!normalizedName) {
    return undefined;
  }

  if (isLookupLikeAttributeType(attributeType)) {
    return `_${normalizedName}_value`;
  }

  if (isUnsupportedSelectAttributeType(attributeType)) {
    return undefined;
  }

  return normalizedName;
}
