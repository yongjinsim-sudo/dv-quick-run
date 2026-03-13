import { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import {
  isLookupNameCompanionField,
  isReadableField,
  isSelectableMetadataField,
  selectTokenForMetadataField
} from "../../../../metadata/metadataHelpers.js";

export type SelectableField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
  selectToken?: string;
};

export function selectTokenForField(
  f: Pick<SelectableField, "logicalName" | "attributeType">
): string | undefined {
  return selectTokenForMetadataField(f);
}

function toSelectableField(field: FieldDef): SelectableField {
  return {
    logicalName: field.logicalName,
    attributeType: field.attributeType ?? "",
    isValidForRead: field.isValidForRead,
    selectToken: selectTokenForMetadataField(field)
  };
}

export function toSelectableFields(fields: FieldDef[]): SelectableField[] {
  return fields
    .filter((field) => {
      const logicalName = String(field.logicalName ?? "").trim();
      if (!logicalName) {
        return false;
      }

      if (!isReadableField(field)) {
        return false;
      }

      if (isLookupNameCompanionField(field, fields)) {
        return false;
      }

      return true;
    })
    .map(toSelectableField);
}

export function getSelectableFields(fields: FieldDef[]): SelectableField[] {
  return fields
    .filter((field) => isSelectableMetadataField(field, fields))
    .map(toSelectableField)
    .filter((field) => !!field.selectToken)
    .sort((a, b) => a.logicalName.localeCompare(b.logicalName));
}
