import { SmartField } from "./smartPatchTypes.js";

export function isGuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export function fieldCategory(field: { attributeType: string }): "string" | "number" | "boolean" | "datetime" | "lookupish" | "other" {
  const t = (field.attributeType || "").toLowerCase();

  if (t === "string" || t === "memo") {return "string";}
  if (t === "boolean") {return "boolean";}
  if (t === "datetime") {return "datetime";}

  if (t === "integer" || t === "bigint" || t === "decimal" || t === "double" || t === "money") {return "number";}
  if (t === "picklist" || t === "state" || t === "status") {return "number";}

  if (t === "lookup" || t === "customer" || t === "owner") {return "lookupish";}

  return "other";
}

/**
 * MVP: only allow field categories that we can PATCH safely without @odata.bind.
 * Excludes lookup/customer/owner for now.
 */
export function isPatchSupportedField(field: SmartField): boolean {
  const cat = fieldCategory(field);
  return cat === "string" || cat === "number" || cat === "boolean" || cat === "datetime";
}

export function parsePatchValue(field: { attributeType: string }, raw: string): string | number | boolean {
  const t = (field.attributeType || "").toLowerCase();
  const v = raw.trim();

  if (t === "boolean") {
    if (v.toLowerCase() === "true" || v === "1") {return true;}
    if (v.toLowerCase() === "false" || v === "0") {return false;}
    return v as any;
  }

  if (
    t === "integer" ||
    t === "bigint" ||
    t === "decimal" ||
    t === "double" ||
    t === "money" ||
    t === "picklist" ||
    t === "state" ||
    t === "status"
  ) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (v as any);
  }

  if (t === "datetime") {
    return v;
  }

  return v;
}