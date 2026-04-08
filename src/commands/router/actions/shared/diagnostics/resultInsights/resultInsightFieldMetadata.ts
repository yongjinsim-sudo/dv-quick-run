import type { FieldDef } from "../../../../../../services/entityFieldMetadataService.js";
import { isLookupLikeAttributeType } from "../../../../../../metadata/metadataModel.js";
import { getBaseFieldLogicalName } from "../../intelligence/classification/fieldSemantics.js";

function toMetadataLookupToken(fieldLogicalName: string): string {
  return `_${fieldLogicalName}_value`;
}

export function buildFieldMetadataMap(fields: FieldDef[]): Map<string, FieldDef> {
  const map = new Map<string, FieldDef>();

  for (const field of fields) {
    const logicalName = field.logicalName?.trim();
    if (!logicalName) {
      continue;
    }

    map.set(logicalName, field);

    if (isLookupLikeAttributeType(field.attributeType)) {
      map.set(toMetadataLookupToken(logicalName), field);
    }
  }

  return map;
}

export function findFieldMetadata(fieldMap: Map<string, FieldDef>, observationField: string): FieldDef | undefined {
  return fieldMap.get(observationField) ?? fieldMap.get(getBaseFieldLogicalName(observationField));
}
