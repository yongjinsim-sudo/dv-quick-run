import type { SelectableField } from "../selectableFields.js";
import {
  looksLikeBoolean,
  looksLikeIsoDateTime,
  looksLikeNumber,
  odataQuoteString
} from "./odataValueUtils.js";

export type FilterableField = SelectableField;

export type FilterExpr =
  | {
      kind: "binary";
      op: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
      label: string;
      requiresValue: true;
    }
  | {
      kind: "func";
      fn: "contains" | "startswith" | "endswith";
      label: string;
      requiresValue: true;
    }
  | {
      kind: "nullCheck";
      op: "eq" | "ne";
      label: string;
      requiresValue: false;
    };

export function fieldCategory(
  field: FilterableField
): "guid" | "string" | "number" | "boolean" | "datetime" | "other" {
  const t = (field.attributeType || "").toLowerCase();

  if (t === "uniqueidentifier" || t === "lookup" || t === "customer" || t === "owner") {
    return "guid";
  }
  if (t === "string" || t === "memo") {
    return "string";
  }
  if (t === "boolean") {
    return "boolean";
  }
  if (t === "datetime") {
    return "datetime";
  }

  if (t === "picklist" || t === "state" || t === "status") {
    return "number";
  }
  if (t === "integer" || t === "bigint" || t === "decimal" || t === "double" || t === "money") {
    return "number";
  }

  return "other";
}

export function getFilterOperatorOptions(
  field: FilterableField
): Array<{ label: string; detail?: string; value: FilterExpr }> {
  const cat = fieldCategory(field);

  const items: Array<{ label: string; detail?: string; value: FilterExpr }> = [];

  if (cat === "string") {
    items.push(
      {
        label: "equals",
        detail: `${field.logicalName} eq 'value'`,
        value: { kind: "binary", op: "eq", label: "equals", requiresValue: true }
      },
      {
        label: "not equals",
        detail: `${field.logicalName} ne 'value'`,
        value: { kind: "binary", op: "ne", label: "not equals", requiresValue: true }
      },
      {
        label: "contains",
        detail: `contains(${field.logicalName},'text')`,
        value: { kind: "func", fn: "contains", label: "contains", requiresValue: true }
      },
      {
        label: "starts with",
        detail: `startswith(${field.logicalName},'text')`,
        value: { kind: "func", fn: "startswith", label: "starts with", requiresValue: true }
      },
      {
        label: "ends with",
        detail: `endswith(${field.logicalName},'text')`,
        value: { kind: "func", fn: "endswith", label: "ends with", requiresValue: true }
      },
      {
        label: "is null",
        detail: `${field.logicalName} eq null`,
        value: { kind: "nullCheck", op: "eq", label: "is null", requiresValue: false }
      },
      {
        label: "is not null",
        detail: `${field.logicalName} ne null`,
        value: { kind: "nullCheck", op: "ne", label: "is not null", requiresValue: false }
      }
    );
  } else if (cat === "number" || cat === "datetime") {
    items.push(
      {
        label: "equals",
        detail: `${field.logicalName} eq value`,
        value: { kind: "binary", op: "eq", label: "equals", requiresValue: true }
      },
      {
        label: "not equals",
        detail: `${field.logicalName} ne value`,
        value: { kind: "binary", op: "ne", label: "not equals", requiresValue: true }
      },
      {
        label: "greater than",
        detail: `${field.logicalName} gt value`,
        value: { kind: "binary", op: "gt", label: "greater than", requiresValue: true }
      },
      {
        label: "greater or equal",
        detail: `${field.logicalName} ge value`,
        value: { kind: "binary", op: "ge", label: "greater or equal", requiresValue: true }
      },
      {
        label: "less than",
        detail: `${field.logicalName} lt value`,
        value: { kind: "binary", op: "lt", label: "less than", requiresValue: true }
      },
      {
        label: "less or equal",
        detail: `${field.logicalName} le value`,
        value: { kind: "binary", op: "le", label: "less or equal", requiresValue: true }
      },
      {
        label: "is null",
        detail: `${field.logicalName} eq null`,
        value: { kind: "nullCheck", op: "eq", label: "is null", requiresValue: false }
      },
      {
        label: "is not null",
        detail: `${field.logicalName} ne null`,
        value: { kind: "nullCheck", op: "ne", label: "is not null", requiresValue: false }
      }
    );
  } else if (cat === "boolean" || cat === "guid") {
    items.push(
      {
        label: "equals",
        detail: `${field.logicalName} eq value`,
        value: { kind: "binary", op: "eq", label: "equals", requiresValue: true }
      },
      {
        label: "not equals",
        detail: `${field.logicalName} ne value`,
        value: { kind: "binary", op: "ne", label: "not equals", requiresValue: true }
      },
      {
        label: "is null",
        detail: `${field.logicalName} eq null`,
        value: { kind: "nullCheck", op: "eq", label: "is null", requiresValue: false }
      },
      {
        label: "is not null",
        detail: `${field.logicalName} ne null`,
        value: { kind: "nullCheck", op: "ne", label: "is not null", requiresValue: false }
      }
    );
  } else {
    items.push(
      {
        label: "equals",
        detail: `${field.logicalName} eq value`,
        value: { kind: "binary", op: "eq", label: "equals", requiresValue: true }
      },
      {
        label: "not equals",
        detail: `${field.logicalName} ne value`,
        value: { kind: "binary", op: "ne", label: "not equals", requiresValue: true }
      },
      {
        label: "is null",
        detail: `${field.logicalName} eq null`,
        value: { kind: "nullCheck", op: "eq", label: "is null", requiresValue: false }
      },
      {
        label: "is not null",
        detail: `${field.logicalName} ne null`,
        value: { kind: "nullCheck", op: "ne", label: "is not null", requiresValue: false }
      }
    );
  }

  return items;
}

export function getFilterValuePrompt(
  field: FilterableField,
  expr: FilterExpr
): { prompt: string; placeHolder?: string } {
  if (expr.kind === "func") {
    if (expr.fn === "contains") {
      return {
        prompt: `Enter text that ${field.logicalName} should contain`,
        placeHolder: "e.g. John"
      };
    }

    if (expr.fn === "startswith") {
      return {
        prompt: `Enter text that ${field.logicalName} should start with`,
        placeHolder: "e.g. Jo"
      };
    }

    return {
      prompt: `Enter text that ${field.logicalName} should end with`,
      placeHolder: "e.g. son"
    };
  }

  const cat = fieldCategory(field);

  if (cat === "datetime") {
    return {
      prompt: `Enter comparison value for ${field.logicalName}`,
      placeHolder: "e.g. 2026-03-06T00:00:00Z"
    };
  }

  if (cat === "boolean") {
    return {
      prompt: `Enter boolean value for ${field.logicalName}`,
      placeHolder: "true or false"
    };
  }

  if (cat === "guid") {
    return {
      prompt: `Enter GUID value for ${field.logicalName}`,
      placeHolder: "e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b"
    };
  }

  if (cat === "number") {
    return {
      prompt: `Enter numeric value for ${field.logicalName}`,
      placeHolder: "e.g. 0"
    };
  }

  return {
    prompt: `Enter value for ${field.logicalName}`,
    placeHolder: "Enter filter value"
  };
}

export function formatFilterValue(field: FilterableField, raw: string): string {
  const t = (field.attributeType || "").toLowerCase();
  const v = raw.trim();

  if (t === "uniqueidentifier" || t === "lookup" || t === "customer" || t === "owner") {
    return v;
  }

  if (t === "datetime") {
    return v;
  }

  if (t === "boolean") {
    if (v.toLowerCase() === "true" || v === "1") {
      return "true";
    }
    if (v.toLowerCase() === "false" || v === "0") {
      return "false";
    }
    return v;
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
    return v;
  }

  if (looksLikeBoolean(v)) {
    return v.toLowerCase() === "1" ? "true" : v.toLowerCase() === "0" ? "false" : v.toLowerCase();
  }

  if (looksLikeNumber(v)) {
    return v;
  }

  if (looksLikeIsoDateTime(v) && t !== "string" && t !== "memo") {
    return v;
  }

  return odataQuoteString(v);
}

export function buildFilterClause(
  field: FilterableField,
  expr: FilterExpr,
  rawValue: string
): string {
  const left = field.selectToken ?? field.logicalName;

  if (expr.kind === "func") {
    return `${expr.fn}(${left},${odataQuoteString(rawValue.trim())})`;
  }

  if (expr.kind === "nullCheck") {
    return `${left} ${expr.op} null`;
  }

  const right = formatFilterValue(field, rawValue);
  return `${left} ${expr.op} ${right}`;
}