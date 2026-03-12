import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { logError, logInfo } from "../../../utils/logger.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";
import { addQueryToHistory } from "../../../utils/queryHistory.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import { loadFields } from "./shared/metadataAccess.js";
import { SmartField, SmartGetState, SmartGetFilterState, FilterExpr } from "./smartGet/smartGetTypes.js";
import { promptOrderBy } from "./smartGet/smartGetOrderBy.js";
import { normalizePath, buildResultTitle, buildQueryFromState, buildGetCurl } from "./smartGet/smartGetQueryBuilder.js";
import { getSelectableFields } from "./shared/selectableFields.js";
import { shouldExecuteQueryWithGuardrails } from "./shared/guardrails/guardedExecution.js";
import { buildLookupSelectToken } from "../../../metadata/metadataModel.js";
import { SmartMetadataSession } from "./smart/shared/smartMetadataSession.js";

const LAST_SMART_GET_STATE_KEY = "dvQuickRun.smartGet.lastState";

function selectTokenForField(f: SmartField): string | undefined {
  return buildLookupSelectToken(f.logicalName, f.attributeType);
}

function deriveAttributesVirtualUri(logicalName: string): vscode.Uri {
  const entity = logicalName.toLowerCase();
  return vscode.Uri.parse(`dvqr:/.dvqr/${entity}/${entity}.attributes.json`);
}

function tryParseFieldsFromOpenAttributesDoc(logicalName: string): SmartField[] | undefined {
  const uri = deriveAttributesVirtualUri(logicalName);
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (!doc) {return undefined;}

  try {
    const json = JSON.parse(doc.getText());
    const value = Array.isArray(json?.value) ? json.value : undefined;
    if (!value) {return undefined;}

    const fields: SmartField[] = value
      .map((x: any): SmartField => ({
        logicalName: String(x?.LogicalName ?? ""),
        attributeType: String(x?.AttributeType ?? ""),
        isValidForRead: typeof x?.IsValidForRead === "boolean" ? x.IsValidForRead : undefined,
        selectToken: undefined
      }))
      .filter((f: SmartField) => !!f.logicalName);

    for (const f of fields) {
      f.selectToken = selectTokenForField(f);
    }

    return fields.filter((f) => !!f.selectToken);

  } catch {
    return undefined;
  }
}



async function pickEntity(defs: EntityDef[], preselectLogicalName?: string): Promise<EntityDef | undefined> {
  const items = defs.map((d) => ({
    label: d.entitySetName,
    description: d.logicalName,
    picked: preselectLogicalName ? d.logicalName === preselectLogicalName : false,
    def: d
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: "DV Quick Run: Pick table",
    placeHolder: "Type to filter (e.g. contact → contacts)",
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.def;
}

async function getFieldsForEntity(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  session?: SmartMetadataSession
): Promise<SmartField[]> {
  const fromOpenDoc = tryParseFieldsFromOpenAttributesDoc(logicalName);
  if (fromOpenDoc?.length) {
    return fromOpenDoc;
  }

  if (session) {
    return session.getSmartFields(logicalName);
  }

  const fields = await loadFields(ctx, client, token, logicalName);

  return getSelectableFields(fields).map((f) => ({
    logicalName: f.logicalName,
    attributeType: f.attributeType,
    isValidForRead: f.isValidForRead,
    selectToken: f.selectToken
  }));
}

async function pickFields(
  def: EntityDef,
  fields: SmartField[],
  preselectedLogicalNames?: string[]
): Promise<SmartField[] | undefined> {
  const pre = new Set((preselectedLogicalNames ?? []).map((x) => x.toLowerCase()));

  const selectableFields = fields
    .filter((f) => !!f.selectToken)
    .map((f) => ({
      field: f,
      logicalNameLower: f.logicalName.toLowerCase()
    }))
    .sort((a, b) => a.logicalNameLower.localeCompare(b.logicalNameLower));

  const picked = await vscode.window.showQuickPick(
    selectableFields.map(({ field, logicalNameLower }) => ({
      label: field.logicalName,
      description: field.attributeType || "",
      detail: `$select token: ${field.selectToken}`,
      picked: pre.has(logicalNameLower),
      field
    })),
    {
      title: `DV Quick Run: Fields (${def.entitySetName})`,
      placeHolder: "Pick fields (multi-select). Type to filter.",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {return undefined;}
  return picked.map((p) => p.field);
}

type FilterChoice = { label: string; field?: SmartField; picked?: boolean };

async function pickOptionalFilterField(fields: SmartField[], preselectedLogicalName?: string): Promise<SmartField | undefined> {
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

function isGuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function getSelectedGuidOrThrow(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {throw new Error("No active editor.");}

  const raw = editor.document.getText(editor.selection).trim();
  if (!raw) {throw new Error("Select a GUID first.");}

  const cleaned = raw.replace(/^[\s{"'(\[]+|[\s}"')\]]+$/g, "").trim();

  if (!isGuidLike(cleaned)) {
    throw new Error(`Selection is not a GUID: ${raw}`);
  }

  return cleaned;
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

  if (t === "uniqueidentifier") {return v;}
  if (t === "datetime") {return v;}

  if (t === "boolean") {
    if (v.toLowerCase() === "true" || v === "1") {return "true";}
    if (v.toLowerCase() === "false" || v === "0") {return "false";}
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

  if (t === "lookup" || t === "customer" || t === "owner") {
    return v;
  }

  return odataQuoteString(v);
}

async function pickFilterOperator(field: SmartField, preselected?: FilterExpr): Promise<FilterExpr | undefined> {
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

function buildFilterClause(field: SmartField, expr: FilterExpr, rawValue: string): string {
  const left = field.selectToken ?? field.logicalName;

  if (expr.kind === "func") {
    const right = odataQuoteString(rawValue.trim());
    return `${expr.fn}(${left},${right})`;
  }

  const right = formatFilterValue(field, rawValue);
  return `${left} ${expr.op} ${right}`;
}

function stringifyExpr(expr: FilterExpr): string {
  if (expr.kind === "binary") {return expr.op;}
  return expr.fn;
}

async function saveLastState(ctx: CommandContext, state: SmartGetState): Promise<void> {
  await ctx.ext.globalState.update(LAST_SMART_GET_STATE_KEY, state);
}

function loadLastState(ctx: CommandContext): SmartGetState | undefined {
  return ctx.ext.globalState.get<SmartGetState>(LAST_SMART_GET_STATE_KEY);
}

async function promptTop(preselectedTop?: number): Promise<number | undefined> {
  const topRaw = (await vscode.window.showInputBox({
    title: `DV Quick Run: $top`,
    prompt: "Enter $top (default 10). Leave blank for 10.",
    placeHolder: preselectedTop ? String(preselectedTop) : "10",
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {return undefined;}
      return /^\d+$/.test(t) ? undefined : "Enter a whole number (e.g. 10)";
    }
  }))?.trim();

  const top = topRaw && topRaw.length ? parseInt(topRaw, 10) : (preselectedTop ?? 10);
  return top;
}

async function buildOrEditState(
  session: SmartMetadataSession,
  initial?: SmartGetState
): Promise<{ state: SmartGetState; fields: SmartField[] } | undefined> {
  const defs = await session.getEntityDefs();
  const def = await pickEntity(defs, initial?.entityLogicalName);
  if (!def) {return undefined;}

  const fields = await session.getSmartFields(def.logicalName);

  const pickedFields = await pickFields(def, fields, initial?.selectedFieldLogicalNames);
  if (!pickedFields) {return undefined;}

  const selectedFieldLogicalNames = pickedFields.map((f) => f.logicalName);

  const preFilterField = initial?.filter?.fieldLogicalName;
  const filterField = await pickOptionalFilterField(fields, preFilterField);

  let filter: SmartGetFilterState | undefined;

  if (filterField) {
    const preExpr = initial?.filter?.expr;
    const expr = await pickFilterOperator(filterField, preExpr);
    if (!expr) {return undefined;}

    const raw = await vscode.window.showInputBox({
      title: `DV Quick Run: Filter value`,
      prompt: `Enter value for ${filterField.logicalName} (${filterField.attributeType})`,
      value:
        initial?.filter?.fieldLogicalName?.toLowerCase() === filterField.logicalName.toLowerCase()
          ? (initial?.filter?.rawValue ?? "")
          : undefined,
      ignoreFocusOut: true
    });

    if (raw && raw.trim().length > 0) {
      const type = (filterField.attributeType || "").toLowerCase();
      const value = raw.trim();

      const isGuidType =
        type === "uniqueidentifier" || type === "lookup" || type === "customer" || type === "owner";

      if (isGuidType && !isGuidLike(value)) {
        vscode.window.showErrorMessage(
          `DV Quick Run: ${filterField.logicalName} expects a GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b).`
        );
        return undefined;
      }

      filter = { fieldLogicalName: filterField.logicalName, expr, rawValue: value };
    }
  }

  const top = await promptTop(initial?.top);
  if (top === undefined) {return undefined;}

  const orderBy = await promptOrderBy(pickedFields, initial?.orderBy);

  const state: SmartGetState = {
    entityLogicalName: def.logicalName,
    entitySetName: def.entitySetName,
    selectedFieldLogicalNames,
    top,
    filter,
    orderBy
  };

  return { state, fields };
}

type ReviewChoice =
  | { kind: "run" }
  | { kind: "editEntity" }
  | { kind: "editFields" }
  | { kind: "editFilter" }
  | { kind: "editOrderBy" }
  | { kind: "editTop" }
  | { kind: "copyPath" }
  | { kind: "copyFullUrl" }
  | { kind: "openInRunGet" }
  | { kind: "copyCurl" }
  | { kind: "cancel" };

async function reviewAndEditLoop(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  session: SmartMetadataSession,
  initial: SmartGetState,
  initialFields: SmartField[]
): Promise<{ state: SmartGetState; fields: SmartField[] } | undefined> {
  let current = initial;
  let fields = initialFields;

  while (true) {
    const filterText = current.filter
      ? `${current.filter.fieldLogicalName} ${stringifyExpr(current.filter.expr)} ${current.filter.rawValue}`
      : "(none)";

    const orderByText = current.orderBy ? `${current.orderBy.fieldLogicalName} ${current.orderBy.direction}` : "(none)";

    const { path } = buildQueryFromState(current, fields, buildFilterClause);
    const fullUrl = `${(await ctx.getBaseUrl()).replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

    const items: Array<{ label: string; description?: string; choice: ReviewChoice }> = [
      { label: "✅ Run", description: "Execute the query now", choice: { kind: "run" } },
      { label: "✏️ Edit entity", description: `${current.entitySetName} (${current.entityLogicalName})`, choice: { kind: "editEntity" } },
      { label: "✏️ Edit fields", description: `${current.selectedFieldLogicalNames.length} selected`, choice: { kind: "editFields" } },
      { label: "✏️ Edit filter", description: filterText, choice: { kind: "editFilter" } },
      { label: "✏️ Edit $orderby", description: orderByText, choice: { kind: "editOrderBy" } },
      { label: "✏️ Edit $top", description: String(current.top), choice: { kind: "editTop" } },
      { label: "📋 Copy query path", description: "Copies <entitySet>?$select=... to clipboard", choice: { kind: "copyPath" } },
      { label: "📋 Copy GET as curl", description: "Copies curl command to clipboard", choice: { kind: "copyCurl" }},
      { label: "🧾 Copy full URL", description: "Copies https://.../api/data/v9.2/<entitySet>?... to clipboard", choice: { kind: "copyFullUrl" } },
      { label: "➡️ Open in Run GET", description: "Prefills Run GET with this query", choice: { kind: "openInRunGet" } },
      { label: "❌ Cancel", choice: { kind: "cancel" } }
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: `DV Quick Run: Review Smart GET`,
      placeHolder: "Run or adjust parameters",
      ignoreFocusOut: true
    });

    const choice = picked?.choice;
    if (!choice) {return undefined;}

    if (choice.kind === "cancel") {return undefined;}

    if (choice.kind === "copyPath") {
      await vscode.env.clipboard.writeText(path);
      vscode.window.showInformationMessage("DV Quick Run: Query path copied to clipboard.");
      continue;
    }

    if (choice.kind === "copyFullUrl") {
      await vscode.env.clipboard.writeText(fullUrl);
      vscode.window.showInformationMessage("DV Quick Run: Full URL copied to clipboard.");
      continue;
    }

    if (choice.kind === "openInRunGet") {
      await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));
      await vscode.commands.executeCommand("dvQuickRun.runGet");
      return undefined;
    }

    if (choice.kind === "run") {
      return { state: current, fields };
    }

    if (choice.kind === "editTop") {
      const top = await promptTop(current.top);
      if (top === undefined) {return undefined;}
      current = { ...current, top };
      continue;
    }

    if (choice.kind === "editOrderBy") {
      const fieldMap = new Map(fields.map((f) => [f.logicalName.toLowerCase(), f]));
      const selected = current.selectedFieldLogicalNames
        .map((ln) => fieldMap.get(ln.toLowerCase()))
        .filter((x): x is SmartField => !!x);

      const orderBy = await promptOrderBy(selected, current.orderBy);
      current = { ...current, orderBy };
      continue;
    }

    if (choice.kind === "editEntity") {
      const edited = await buildOrEditState(session, current);
      if (!edited) {return undefined;}
      current = edited.state;
      fields = edited.fields;
      continue;
    }

    if (choice.kind === "copyCurl") {
      const curl = buildGetCurl(fullUrl);
      await vscode.env.clipboard.writeText(curl);
      vscode.window.showInformationMessage("DV Quick Run: curl command copied.");
      continue;
    }

    if (choice.kind === "editFields") {
      const currentDef = await session.getEntityByLogicalName(current.entityLogicalName);
      if (!currentDef) {return undefined;}

      const pickedFields = await pickFields(currentDef, fields, current.selectedFieldLogicalNames);
      if (!pickedFields) {return undefined;}

      current = { ...current, selectedFieldLogicalNames: pickedFields.map((f) => f.logicalName) };
      continue;
    }

    if (choice.kind === "editFilter") {
      const filterField = await pickOptionalFilterField(fields, current.filter?.fieldLogicalName);
      if (!filterField) {
        current = { ...current, filter: undefined };
        continue;
      }

      const expr = await pickFilterOperator(filterField, current.filter?.expr);
      if (!expr) {return undefined;}

      const raw = await vscode.window.showInputBox({
        title: `DV Quick Run: Filter value`,
        prompt: `Enter value for ${filterField.logicalName} (${filterField.attributeType})`,
        value:
          current.filter?.fieldLogicalName?.toLowerCase() === filterField.logicalName.toLowerCase()
            ? (current.filter?.rawValue ?? "")
            : undefined,
        ignoreFocusOut: true
      });

      if (!raw || raw.trim().length === 0) {
        current = { ...current, filter: undefined };
        continue;
      }

      const type = (filterField.attributeType || "").toLowerCase();
      const value = raw.trim();

      const isGuidType =
        type === "uniqueidentifier" || type === "lookup" || type === "customer" || type === "owner";

      if (isGuidType && !isGuidLike(value)) {
        vscode.window.showErrorMessage(
          `DV Quick Run: ${filterField.logicalName} expects a GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b).`
        );
        continue;
      }

      current = {
        ...current,
        filter: { fieldLogicalName: filterField.logicalName, expr, rawValue: value }
      };
      continue;
    }
  }
}

function ensureTransportPath(path: string): string {
  const t = path.trim();
  if (!t) {return "";}
  return t.startsWith("/") ? t : `/${t}`;
}

async function executeState(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartGetState,
  fields: SmartField[]
): Promise<void> {
  const { path } = buildQueryFromState(state, fields, buildFilterClause);
  const transportPath = ensureTransportPath(path);
  
  const shouldExecute = await shouldExecuteQueryWithGuardrails(
    ctx,
    client,
    token,
    path,
    "Smart GET execution cancelled by guardrails."
  );

  if (!shouldExecute) {
    return;
  }

  await saveLastState(ctx, state);
  await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));

  logInfo(ctx.output, `Query: ${path}`);
  logInfo(ctx.output, `GET ${transportPath}`);

  const result = await client.get(transportPath, token);
  await showJsonNamed(buildResultTitle(path), result);
}

async function initContext(
  ctx: CommandContext
): Promise<{
  baseUrl: string;
  scope: string;
  token: string;
  client: DataverseClient;
  session: SmartMetadataSession;
}> {
  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client = ctx.getClient();
  const session = new SmartMetadataSession(ctx, client, token);

  return { baseUrl, scope, token, client, session };
}

export async function runSmartGetAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
      const { token, client, session } = await initContext(ctx);

      const built = await buildOrEditState(session, undefined);
      if (!built) {return;}

      const reviewed = await reviewAndEditLoop(
        ctx,
        client,
        token,
        session,
        built.state,
        built.fields
      );
      if (!reviewed) {return;}

      await executeState(ctx, client, token, reviewed.state, reviewed.fields);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Smart GET failed. Check Output.");
  }
}

export async function runSmartGetRerunLastAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const last = loadLastState(ctx);
    if (!last) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart GET state found yet.");
      return;
    }

    const { token, client, session } = await initContext(ctx);
    const fields = await getFieldsForEntity(
      ctx,
      client,
      token,
      last.entityLogicalName,
      session
    );

    await executeState(ctx, client, token, last, fields);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output, msg);
    vscode.window.showErrorMessage("DV Quick Run: Re-run last failed. Check Output.");
  }
}

export async function runSmartGetEditLastAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const last = loadLastState(ctx);
    if (!last) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart GET state found yet.");
      return;
    }

    const { token, client, session } = await initContext(ctx);
    const fields = await getFieldsForEntity(
      ctx,
      client,
      token,
      last.entityLogicalName,
      session
    );

    const reviewed = await reviewAndEditLoop(
      ctx,
      client,
      token,
      session,
      last,
      fields
    );
    if (!reviewed) {
      return;
    }

    await executeState(ctx, client, token, reviewed.state, reviewed.fields);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logInfo(ctx.output, msg);
    vscode.window.showErrorMessage("DV Quick Run: Edit last failed. Check Output.");
  }
}

export async function runSmartGetFromGuidRawAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const guid = getSelectedGuidOrThrow();

    const { token, client, session } = await initContext(ctx);

    const defs = await session.getEntityDefs();
    const def = await pickEntity(defs);
    if (!def) {return;}

    const path = normalizePath(`${def.entitySetName}(${guid})`);
    const transportPath = ensureTransportPath(path);
      
    logInfo(ctx.output, `Smart GET (GUID raw): entity=${def.entitySetName} id=${guid}`);
    logInfo(ctx.output, `GET ${transportPath}`);
      
    const shouldExecute = await shouldExecuteQueryWithGuardrails(
      ctx,
      client,
      token,
      path,
      "Smart GET GUID execution cancelled by guardrails."
    );
    
    if (!shouldExecute) {
      return;
    }
    
    const result = await client.get(transportPath, token);
    await showJsonNamed(buildResultTitle(path), result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Smart GET from GUID (Raw) failed. Check Output.");
  }
}

export async function runSmartGetFromGuidPickFieldsAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const guid = getSelectedGuidOrThrow();

    const { token, client, session } = await initContext(ctx);

    const defs = await session.getEntityDefs();
    const def = await pickEntity(defs);
    if (!def) {return;}

    const fields = await session.getSmartFields(def.logicalName);

    const pickedFields = await pickFields(def, fields);
    if (!pickedFields) {return;}

    const selectTokens = pickedFields
      .map((f) => f.selectToken)
      .filter((x): x is string => !!x);

    if (selectTokens.length === 0) {
      vscode.window.showWarningMessage("DV Quick Run: None of the selected fields are selectable via $select.");
      return;
    }

    const select = selectTokens.join(",");
    const path = normalizePath(`${def.entitySetName}(${guid})?$select=${select}`);
    const transportPath = ensureTransportPath(path);
      
    logInfo(ctx.output, `Smart GET (GUID pick fields): entity=${def.entitySetName} id=${guid} fields=${selectTokens.length}`);
    logInfo(ctx.output, `GET ${transportPath}`);
      
    const shouldExecute = await shouldExecuteQueryWithGuardrails(
      ctx,
      client,
      token,
      path,
      "Smart GET GUID execution cancelled by guardrails."
    );
    
    if (!shouldExecute) {
      return;
    }
    
    const result = await client.get(transportPath, token);
    await showJsonNamed(buildResultTitle(path), result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Smart GET from GUID (Pick Fields) failed. Check Output.");
  }
}