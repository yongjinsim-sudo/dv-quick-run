import type { FieldMetadata } from "./metadataModel.js";
import {
  buildLookupSelectToken,
  isLookupLikeAttributeType,
  isUnsupportedSelectAttributeType
} from "./metadataModel.js";

export type FieldLike = Pick<FieldMetadata, "logicalName" | "attributeType" | "isValidForRead">;

function normalizeName(value?: string): string {
  return String(value ?? "").trim();
}

export function isReadableField(field: Pick<FieldMetadata, "isValidForRead">): boolean {
  return field.isValidForRead !== false;
}

export function isLookupNameCompanionField(
  field: Pick<FieldMetadata, "logicalName">,
  allFields: readonly Pick<FieldMetadata, "logicalName" | "attributeType">[]
): boolean {
  const logicalName = normalizeName(field.logicalName).toLowerCase();
  if (!logicalName) {
    return false;
  }

  return allFields.some((candidate) => {
    const candidateName = normalizeName(candidate.logicalName).toLowerCase();
    if (!candidateName) {
      return false;
    }

    return isLookupLikeAttributeType(candidate.attributeType) && `${candidateName}name` === logicalName;
  });
}

export function selectTokenForMetadataField(field: Pick<FieldMetadata, "logicalName" | "attributeType">): string | undefined {
  const logicalName = normalizeName(field.logicalName);
  if (!logicalName) {
    return undefined;
  }

  if (isUnsupportedSelectAttributeType(field.attributeType)) {
    return undefined;
  }

  return buildLookupSelectToken(logicalName, field.attributeType);
}

export function isSelectableMetadataField(
  field: FieldLike,
  allFields: readonly Pick<FieldMetadata, "logicalName" | "attributeType">[]
): boolean {
  if (!isReadableField(field)) {
    return false;
  }

  if (isLookupNameCompanionField(field, allFields)) {
    return false;
  }

  return !!selectTokenForMetadataField(field);
}
