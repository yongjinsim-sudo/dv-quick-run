import { FieldDef } from "../../../../services/entityFieldMetadataService.js";

export type SelectableField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
  selectToken?: string;
};

export function selectTokenForField(
  f: Pick<SelectableField, "logicalName" | "attributeType">
): string | undefined {
  const ln = (f.logicalName || "").trim();
  if (!ln) {return undefined;}

  const t = (f.attributeType || "").toLowerCase();

  if (t === "lookup" || t === "customer" || t === "owner") {
    return `_${ln}_value`;
  }

  if (t === "virtual" || t === "managedproperty" || t === "partylist") {
    return undefined;
  }

  return ln;
}

function buildLookupNameExclusionSet(fields: FieldDef[]): Set<string> {
  const exclude = new Set<string>();

  for (const f of fields) {
    const ln = (f.logicalName || "").trim();
    const t = (f.attributeType || "").toLowerCase();

    if (!ln) {continue;}

    if (t === "lookup" || t === "customer" || t === "owner") {
      exclude.add(`${ln.toLowerCase()}name`);
    }
  }

  return exclude;
}

export function toSelectableFields(fields: FieldDef[]): SelectableField[] {
  const excludedLookupNames = buildLookupNameExclusionSet(fields);

  return fields
    .filter((f) => {
      const ln = (f.logicalName || "").trim().toLowerCase();
      if (!ln) {return false;}

      // Hide synthetic lookup-name helpers like accountidname, owneridname, etc.
      if (excludedLookupNames.has(ln)) {
        return false;
      }

      return true;
    })
    .map((f) => ({
      logicalName: f.logicalName,
      attributeType: f.attributeType ?? "",
      isValidForRead: f.isValidForRead,
      selectToken: selectTokenForField({
        logicalName: f.logicalName,
        attributeType: f.attributeType ?? ""
      })
    }));
}

export function getSelectableFields(fields: FieldDef[]): SelectableField[] {
  return toSelectableFields(fields).filter((f) => !!f.selectToken);
}