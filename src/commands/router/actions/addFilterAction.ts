import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { logError, logInfo } from "../../../utils/logger.js";
import {
  loadEntityDefs,
  loadSelectableFields,
  findEntityByEntitySetName
} from "./shared/metadataAccess.js";
import type { SelectableField } from "./shared/selectableFields.js";
import { getEditorQueryTarget } from "./shared/queryMutation/editorQueryTarget.js";
import {
  parseEditorQuery,
  buildEditorQuery,
  getEntitySetNameFromEditorQuery
} from "./shared/queryMutation/parsedEditorQuery.js";
import { setQueryOption } from "./shared/queryMutation/queryOptionMutator.js";
import { applyEditorQueryUpdate } from "./shared/queryMutation/applyEditorQueryUpdate.js";

type FilterableField = SelectableField;

type FilterExpr =
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

function looksLikeJsonLine(input: string): boolean {
  const text = input.trim();
  if (!text) {return false;}

  return (
    text.startsWith("{") ||
    text.startsWith("[") ||
    text.startsWith("\"") ||
    text === "}" ||
    text === "]" ||
    /^[\s"]+[A-Za-z0-9_@$.-]+"\s*:/.test(text) ||
    /^"[A-Za-z0-9_@$.-]+"\s*:/.test(text)
  );
}


async function pickField(entitySetName: string, fields: FilterableField[]): Promise<FilterableField | undefined> {
  const picked = await vscode.window.showQuickPick(
    fields.map((f) => ({
      label: f.logicalName,
      description: f.attributeType || "",
      detail: f.selectToken && f.selectToken !== f.logicalName ? `Uses ${f.selectToken}` : undefined,
      field: f
    })),
    {
      title: `DV Quick Run: Add Filter ($filter) — ${entitySetName}`,
      placeHolder: "Step 1 of 3: Pick a field to filter on",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.field;
}

function fieldCategory(field: FilterableField): "guid" | "string" | "number" | "boolean" | "datetime" | "other" {
  const t = (field.attributeType || "").toLowerCase();

  if (t === "uniqueidentifier" || t === "lookup" || t === "customer" || t === "owner") { return "guid"; }
  if (t === "string" || t === "memo") { return "string"; }
  if (t === "boolean") { return "boolean"; }
  if (t === "datetime") { return "datetime"; }

  if (t === "picklist" || t === "state" || t === "status") { return "number"; }
  if (t === "integer" || t === "bigint" || t === "decimal" || t === "double" || t === "money") { return "number"; }

  return "other";
}

async function pickFilterOperator(field: FilterableField): Promise<FilterExpr | undefined> {
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

  const picked = await vscode.window.showQuickPick(items, {
    title: `DV Quick Run: Add Filter ($filter) — ${field.logicalName}`,
    placeHolder: "Step 2 of 3: Choose an operator",
    ignoreFocusOut: true,
    matchOnDescription: true
  });

  return picked?.value;
}

function isGuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function odataQuoteString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function looksLikeBoolean(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === "true" || t === "false" || t === "1" || t === "0";
}

function looksLikeNumber(v: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(v.trim());
}

function looksLikeIsoDateTime(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(t|\s)\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?(z|[+\-]\d{2}:\d{2})?$/i.test(v.trim())
    || /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

function formatFilterValue(field: FilterableField, raw: string): string {
  const t = (field.attributeType || "").toLowerCase();
  const v = raw.trim();

  if (t === "uniqueidentifier" || t === "lookup" || t === "customer" || t === "owner") {
    return v;
  }

  if (t === "datetime") {
    return v;
  }

  if (t === "boolean") {
    if (v.toLowerCase() === "true" || v === "1") { return "true"; }
    if (v.toLowerCase() === "false" || v === "0") { return "false"; }
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

function valuePrompt(field: FilterableField, expr: FilterExpr): { prompt: string; placeHolder?: string } {
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

async function promptFilterValue(field: FilterableField, expr: FilterExpr): Promise<string | undefined> {
  if (!expr.requiresValue) {
    return "";
  }

  const promptInfo = valuePrompt(field, expr);

  const raw = await vscode.window.showInputBox({
    title: `DV Quick Run: Add Filter ($filter)`,
    prompt: promptInfo.prompt,
    placeHolder: promptInfo.placeHolder,
    ignoreFocusOut: true
  });

  if (raw === undefined) {
    return undefined;
  }

  const value = raw.trim();
  if (!value) {
    vscode.window.showWarningMessage("DV Quick Run: Filter value cannot be empty.");
    return undefined;
  }

  const type = (field.attributeType || "").toLowerCase();
  const isGuidType = type === "uniqueidentifier" || type === "lookup" || type === "customer" || type === "owner";

  if (isGuidType && value && !isGuidLike(value)) {
    vscode.window.showErrorMessage(
      `DV Quick Run: ${field.logicalName} expects a GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b).`
    );
    return undefined;
  }

  return value;
}

function buildFilterClause(field: FilterableField, expr: FilterExpr, rawValue: string): string {
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

async function pickExistingFilterStrategy(existingFilter: string): Promise<"replace" | "and" | "or" | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Replace existing $filter", value: "replace" as const, description: existingFilter },
      { label: "Append with AND", value: "and" as const, description: existingFilter },
      { label: "Append with OR", value: "or" as const, description: existingFilter }
    ],
    {
      title: "DV Quick Run: Existing $filter found",
      placeHolder: "Choose how to combine the new filter",
      ignoreFocusOut: true
    }
  );

  return picked?.value;
}

export async function runAddFilterAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const target = getEditorQueryTarget();
    const parsed = parseEditorQuery(target.text);

    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);

    if (!entitySetName) {
      if (looksLikeJsonLine(target.text)) {
        throw new Error(
          "This line appears to be JSON, not a Dataverse query. Use 'Generate Query From JSON' first."
        );
      }

      throw new Error(`Current line does not look like a Dataverse Web API path: ${target.text}`);
    }

    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope();

    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient();

    const defs = await loadEntityDefs(ctx, client, token);
    const def = findEntityByEntitySetName(defs, entitySetName);
    if (!def) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const fields = await loadSelectableFields(ctx, client, token, def.logicalName);

    const pickedField = await pickField(def.entitySetName, fields);
    if (!pickedField) {return;}

    const expr = await pickFilterOperator(pickedField);
    if (!expr) {return;}

    const rawValue = await promptFilterValue(pickedField, expr);
    if (rawValue === undefined) {return;}

    const newClause = buildFilterClause(pickedField, expr, rawValue);

    const existingFilter = parsed.queryOptions.get("$filter");
    let strategy: "replace" | "and" | "or" = "replace";

    if (existingFilter) {
      const pickedStrategy = await pickExistingFilterStrategy(existingFilter);
      if (!pickedStrategy) {return;}
      strategy = pickedStrategy;
    }

    const mergedFilter = mergeFilter(existingFilter, newClause, strategy);
    setQueryOption(parsed, "$filter", mergedFilter);

    const updated = buildEditorQuery(parsed);
    await applyEditorQueryUpdate(target, updated);

    logInfo(ctx.output,`Add Filter ($filter): ${target.text} -> ${updated}`);
    vscode.window.showInformationMessage("DV Quick Run: Added filter to $filter.");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage(`DV Quick Run: ${msg}`);
  }
}

function mergeFilter(existingFilter: string | null, newClause: string, strategy: "replace" | "and" | "or"): string {
  if (!existingFilter || strategy === "replace") {
    return newClause;
  }

  return `(${existingFilter}) ${strategy} (${newClause})`;
}
