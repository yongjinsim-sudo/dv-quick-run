import type { FilterableField } from "./filterExpressionRules.js";
import { isGuidLike } from "./odataValueUtils.js";

export function validateFilterRawValue(
  field: FilterableField,
  raw: string
): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();

  if (!value) {
    return {
      ok: false,
      message: "DV Quick Run: Filter value cannot be empty."
    };
  }

  const type = (field.attributeType || "").toLowerCase();
  const isGuidType =
    type === "uniqueidentifier" ||
    type === "lookup" ||
    type === "customer" ||
    type === "owner";

  if (isGuidType && value && !isGuidLike(value)) {
    return {
      ok: false,
      message: `DV Quick Run: ${field.logicalName} expects a GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b).`
    };
  }

  return {
    ok: true,
    value
  };
}