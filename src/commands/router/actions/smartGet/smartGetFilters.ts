import * as vscode from "vscode";
import { FilterExpr, SmartField, SmartGetFilterState } from "./smartGetTypes.js";

type FilterChoice = { label: string; field?: SmartField; picked?: boolean };

export function isGuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function odataQuoteString(s: string): string {
  const escaped = s.replace(/'/g, "''");
  return `'${escaped}'`;
}

function fieldCategory(field: SmartField): "guid" | "string" | "number" | "boolean" | "datetime" | "other" {
  const t = (field.attributeType || "").toLowerCase();

  if (t === "uniqueidentifier" || t === "lookup" || t === "customer" || t === "owner") {return "guid";}
  if (t === "string" || t === "memo") {return "string";}
  if (t === "boolean") {return "boolean";}
  if (t === "datetime") {return "datetime";}
  if (t === "picklist" || t === "state" || t === "status") {return "number";}
  if (t === "integer" || t === "bigint" || t === "decimal" || t === "double" || t === "money") {return "number";}

  return "other";
}

function formatFilterValue(field: SmartField, raw: string): string {
  const t = (field.attributeType || "").toLowerCase();
  const v = raw.trim();

  if (t === "uniqueidentifier" || t === "datetime" || t === "lookup" || t === "customer" || t === "owner") {return v;}

  if (t === "boolean") {
    if (v.toLowerCase() === "true" || v === "1") {return "true";}
    if (v.toLowerCase() === "false" || v === "0") {return "false";}
    return v;
  }

  if (
    t === "integer" || t === "bigint" || t === "decimal" || t === "double" || t === "money" ||
    t === "picklist" || t === "state" || t === "status"
  ) {
    return v;
  }

  return odataQuoteString(v);
}

export async function pickOptionalFilterField(fields: SmartField[], preselectedLogicalName?: string): Promise<SmartField | undefined> {
  const pre = (preselectedLogicalName ?? "").toLowerCase();
  const choices: FilterChoice[] = [
    { label: "(No filter)" },
    ...fields.map((f) => ({ label: f.logicalName, field: f, picked: f.logicalName.toLowerCase() === pre }))
  ];

  const picked = await vscode.window.showQuickPick(choices, {
    title: "DV Quick Run: Optional filter",
    placeHolder: "Pick a field to filter on, or choose (No filter)",
    ignoreFocusOut: true
  });

  return picked?.field;
}

export async function pickFilterOperator(field: SmartField, preselected?: FilterExpr): Promise<FilterExpr | undefined> {
  const cat = fieldCategory(field);
  const items: Array<{ label: string; detail?: string; value: FilterExpr; picked?: boolean }> = [];

  const isPicked = (v: FilterExpr) =>
    preselected
      ? v.kind === preselected.kind &&
        (v.kind === "binary" ? v.op === (preselected as any).op : v.fn === (preselected as any).fn)
      : false;

  if (cat === "string") {
    items.push(
      { label: "equals (eq)", value: { kind: "binary", op: "eq" }, picked: isPicked({ kind: "binary", op: "eq" }) },
      { label: "not equals (ne)", value: { kind: "binary", op: "ne" }, picked: isPicked({ kind: "binary", op: "ne" }) },
      { label: "contains", detail: "contains(field,'text')", value: { kind: "func", fn: "contains" }, picked: isPicked({ kind: "func", fn: "contains" }) },
      { label: "starts with", detail: "startswith(field,'text')", value: { kind: "func", fn: "startswith" }, picked: isPicked({ kind: "func", fn: "startswith" }) },
      { label: "ends with", detail: "endswith(field,'text')", value: { kind: "func", fn: "endswith" }, picked: isPicked({ kind: "func", fn: "endswith" }) }
    );
  } else if (cat === "number" || cat === "datetime") {
    items.push(
      { label: "equals (eq)", value: { kind: "binary", op: "eq" }, picked: isPicked({ kind: "binary", op: "eq" }) },
      { label: "not equals (ne)", value: { kind: "binary", op: "ne" }, picked: isPicked({ kind: "binary", op: "ne" }) },
      { label: "greater than (gt)", value: { kind: "binary", op: "gt" }, picked: isPicked({ kind: "binary", op: "gt" }) },
      { label: "greater or equal (ge)", value: { kind: "binary", op: "ge" }, picked: isPicked({ kind: "binary", op: "ge" }) },
      { label: "less than (lt)", value: { kind: "binary", op: "lt" }, picked: isPicked({ kind: "binary", op: "lt" }) },
      { label: "less or equal (le)", value: { kind: "binary", op: "le" }, picked: isPicked({ kind: "binary", op: "le" }) }
    );
  } else {
    items.push(
      { label: "equals (eq)", value: { kind: "binary", op: "eq" }, picked: isPicked({ kind: "binary", op: "eq" }) },
      { label: "not equals (ne)", value: { kind: "binary", op: "ne" }, picked: isPicked({ kind: "binary", op: "ne" }) }
    );
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: `DV Quick Run: Filter operator (${field.logicalName})`,
    placeHolder: "Choose an operator",
    ignoreFocusOut: true
  });

  return picked?.value;
}

export function buildFilterClause(field: SmartField, expr: FilterExpr, rawValue: string): string {
  const left = field.selectToken ?? field.logicalName;

  if (expr.kind === "func") {
    const right = odataQuoteString(rawValue.trim());
    return `${expr.fn}(${left},${right})`;
  }

  const right = formatFilterValue(field, rawValue);
  return `${left} ${expr.op} ${right}`;
}

export function stringifyExpr(expr: FilterExpr): string {
  return expr.kind === "binary" ? expr.op : expr.fn;
}

export async function promptSmartGetTop(preselectedTop?: number): Promise<number | undefined> {
  const topRaw = (await vscode.window.showInputBox({
    title: "DV Quick Run: $top",
    prompt: "Enter $top (default 10). Leave blank for 10.",
    placeHolder: preselectedTop ? String(preselectedTop) : "10",
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {return undefined;}
      return /^\d+$/.test(t) ? undefined : "Enter a whole number (e.g. 10)";
    }
  }))?.trim();

  return topRaw && topRaw.length ? parseInt(topRaw, 10) : (preselectedTop ?? 10);
}

export async function promptSmartGetFilterValue(
  filterField: SmartField,
  initialValue?: string
): Promise<string | undefined> {
  const raw = await vscode.window.showInputBox({
    title: "DV Quick Run: Filter value",
    prompt: `Enter value for ${filterField.logicalName} (${filterField.attributeType})`,
    value: initialValue,
    ignoreFocusOut: true
  });

  return raw?.trim();
}

export function validateSmartGetFilterValue(field: SmartField, rawValue: string): string | undefined {
  const type = (field.attributeType || "").toLowerCase();
  const isGuidType = type === "uniqueidentifier" || type === "lookup" || type === "customer" || type === "owner";

  if (isGuidType && !isGuidLike(rawValue)) {
    return `DV Quick Run: ${field.logicalName} expects a GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b).`;
  }

  return undefined;
}

export async function promptSmartGetFilterState(
  fields: SmartField[],
  current?: SmartGetFilterState
): Promise<SmartGetFilterState | undefined | null> {
  const filterField = await pickOptionalFilterField(fields, current?.fieldLogicalName);
  if (!filterField) {
    return null;
  }

  const expr = await pickFilterOperator(filterField, current?.expr);
  if (!expr) {return undefined;}

  const raw = await promptSmartGetFilterValue(
    filterField,
    current?.fieldLogicalName?.toLowerCase() === filterField.logicalName.toLowerCase()
      ? current?.rawValue
      : undefined
  );

  if (!raw || raw.length === 0) {
    return null;
  }

  const validationMessage = validateSmartGetFilterValue(filterField, raw);
  if (validationMessage) {
    vscode.window.showErrorMessage(validationMessage);
    return undefined;
  }

  return { fieldLogicalName: filterField.logicalName, expr, rawValue: raw };
}
