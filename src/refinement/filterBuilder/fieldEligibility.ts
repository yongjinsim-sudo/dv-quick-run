import type { FilterableField } from "../../commands/router/actions/shared/queryMutation/filterExpressionRules.js";
import { resolveFilterBuilderFieldType } from "./operatorPolicy.js";

export function isEligibleFilterBuilderField(field: FilterableField): boolean {
  return !!resolveFilterBuilderFieldType(field);
}

export function getEligibleFilterBuilderFields(fields: FilterableField[]): FilterableField[] {
  return fields.filter(isEligibleFilterBuilderField);
}
