import type { FilterableField } from "../../commands/router/actions/shared/queryMutation/filterExpressionRules.js";
import type { FilterBuilderFieldType, FilterBuilderOperator } from "./models.js";

export interface FilterBuilderOperatorItem {
  label: string;
  detail: string;
  value: FilterBuilderOperator;
  requiresValue: boolean;
}

function normalizeAttributeType(attributeType?: string): string {
  return (attributeType ?? "").trim().toLowerCase();
}

export function resolveFilterBuilderFieldType(field: Pick<FilterableField, "attributeType">): FilterBuilderFieldType | undefined {
  const type = normalizeAttributeType(field.attributeType);

  if (type === "string" || type === "memo") {
    return "text";
  }

  if (type === "picklist" || type === "state" || type === "status") {
    return "choice";
  }

  if (type === "boolean") {
    return "boolean";
  }

  if (type === "integer" || type === "bigint" || type === "decimal" || type === "double" || type === "money") {
    return "numeric";
  }

  if (type === "datetime") {
    return "datetime";
  }

  return undefined;
}

export function getFilterBuilderOperatorItems(
  field: Pick<FilterableField, "logicalName" | "attributeType">
): FilterBuilderOperatorItem[] {
  const fieldType = resolveFilterBuilderFieldType(field);
  const logicalName = field.logicalName;

  if (fieldType === "text") {
    return [
      { label: "equals", detail: `${logicalName} eq 'value'`, value: "eq", requiresValue: true },
      { label: "not equals", detail: `${logicalName} ne 'value'`, value: "ne", requiresValue: true },
      { label: "contains", detail: `contains(${logicalName},'text')`, value: "contains", requiresValue: true },
      { label: "starts with", detail: `startswith(${logicalName},'text')`, value: "startswith", requiresValue: true },
      { label: "ends with", detail: `endswith(${logicalName},'text')`, value: "endswith", requiresValue: true },
      { label: "is null", detail: `${logicalName} eq null`, value: "null", requiresValue: false },
      { label: "is not null", detail: `${logicalName} ne null`, value: "notNull", requiresValue: false }
    ];
  }

  if (fieldType === "choice" || fieldType === "boolean") {
    return [
      { label: "equals", detail: `${logicalName} eq value`, value: "eq", requiresValue: true },
      { label: "not equals", detail: `${logicalName} ne value`, value: "ne", requiresValue: true },
      { label: "is null", detail: `${logicalName} eq null`, value: "null", requiresValue: false },
      { label: "is not null", detail: `${logicalName} ne null`, value: "notNull", requiresValue: false }
    ];
  }

  if (fieldType === "numeric" || fieldType === "datetime") {
    return [
      { label: "equals", detail: `${logicalName} eq value`, value: "eq", requiresValue: true },
      { label: "not equals", detail: `${logicalName} ne value`, value: "ne", requiresValue: true },
      { label: "greater than", detail: `${logicalName} gt value`, value: "gt", requiresValue: true },
      { label: "greater or equal", detail: `${logicalName} ge value`, value: "ge", requiresValue: true },
      { label: "less than", detail: `${logicalName} lt value`, value: "lt", requiresValue: true },
      { label: "less or equal", detail: `${logicalName} le value`, value: "le", requiresValue: true },
      { label: "is null", detail: `${logicalName} eq null`, value: "null", requiresValue: false },
      { label: "is not null", detail: `${logicalName} ne null`, value: "notNull", requiresValue: false }
    ];
  }

  return [];
}
