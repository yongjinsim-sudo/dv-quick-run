import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { FieldDef } from "../../../services/entityFieldMetadataService.js";
import { loadEntityDefs, loadFields } from "./shared/metadataAccess.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";
import { addQueryToHistory } from "../../../utils/queryHistory.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import { SmartField, PatchFieldValue, SmartPatchState } from "./smartPatch/smartPatchTypes.js";
import { isGuidLike, isPatchSupportedField } from "./smartPatch/smartPatchValueParser.js";
import { buildPatchBody, buildPatchPath, buildPatchCurl } from "./smartPatch/smartPatchQueryBuilder.js";

const LAST_SMART_PATCH_STATE_KEY = "dvQuickRun.smartPatch.lastState";

async function saveLastState(ctx: CommandContext, state: SmartPatchState): Promise<void> {
  await ctx.ext.globalState.update(LAST_SMART_PATCH_STATE_KEY, state);
}

function loadLastState(ctx: CommandContext): SmartPatchState | undefined {
  return ctx.ext.globalState.get<SmartPatchState>(LAST_SMART_PATCH_STATE_KEY);
}

async function initContext(ctx: CommandContext): Promise<{ baseUrl: string; scope: string; token: string; client: DataverseClient }> {
  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope(baseUrl);

  ctx.output.appendLine(`BaseUrl: ${baseUrl}`);
  ctx.output.appendLine(`Scope: ${scope}`);
  ctx.output.appendLine(`Getting token via Azure CLI...`);

  const token = await ctx.getToken(scope);
  const client = ctx.getClient(baseUrl);

  return { baseUrl, scope, token, client };
}

async function pickEntity(defs: EntityDef[], preselectLogicalName?: string): Promise<EntityDef | undefined> {
  const items = defs.map((d) => ({
    label: d.entitySetName,
    description: d.logicalName,
    picked: preselectLogicalName ? d.logicalName === preselectLogicalName : false,
    def: d
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: "DV Quick Run: Smart PATCH — Pick table",
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
  logicalName: string
): Promise<SmartField[]> {
  const fields = await loadFields(ctx, client, token, logicalName);

  return fields.map((f: FieldDef) => ({
    logicalName: f.logicalName,
    attributeType: f.attributeType ?? "",
    isValidForRead: f.isValidForRead
  }));
}

async function promptRecordId(pre?: string): Promise<string | undefined> {
  const id = (await vscode.window.showInputBox({
    title: "DV Quick Run: Smart PATCH — Record ID",
    prompt: "Enter record GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b)",
    value: pre,
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {return "GUID is required";}
      return isGuidLike(t) ? undefined : "Enter a valid GUID";
    }
  }))?.trim();

  if (!id) {return undefined;}
  return id;
}

async function pickPatchableFields(
  entitySetName: string,
  fields: SmartField[],
  preselected?: string[]
): Promise<SmartField[] | undefined> {
  const patchable = fields.filter(isPatchSupportedField);
  const pre = new Set((preselected ?? []).map((x) => x.toLowerCase()));

  const picked = await vscode.window.showQuickPick(
    patchable.map((f) => ({
      label: f.logicalName,
      description: f.attributeType,
      picked: pre.has(f.logicalName.toLowerCase()),
      field: f
    })),
    {
      title: `DV Quick Run: Smart PATCH — Fields (${entitySetName})`,
      placeHolder: "Pick fields to update (lookup fields excluded for now)",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  if (!picked || picked.length === 0) {return undefined;}
  return picked.map((p) => p.field);
}

async function promptValues(
  pickedFields: SmartField[],
  pre?: PatchFieldValue[]
): Promise<PatchFieldValue[] | undefined> {
  const preMap = new Map((pre ?? []).map((x) => [x.logicalName.toLowerCase(), x]));

  const values: PatchFieldValue[] = [];

  for (const f of pickedFields) {
    const existing = preMap.get(f.logicalName.toLowerCase());
    const raw = await vscode.window.showInputBox({
      title: `DV Quick Run: Smart PATCH — Value`,
      prompt: `${f.logicalName} (${f.attributeType})`,
      value: existing?.rawValue,
      ignoreFocusOut: true
    });

    if (raw === undefined) {return undefined;}
    if (!raw.trim()) {continue;}

    values.push({ logicalName: f.logicalName, attributeType: f.attributeType, rawValue: raw.trim() });
  }

  if (values.length === 0) {return undefined;}
  return values;
}

type ReviewChoice =
  | { kind: "run" }
  | { kind: "editEntity" }
  | { kind: "editId" }
  | { kind: "editFields" }
  | { kind: "editValues" }
  | { kind: "copyPayload" }
  | { kind: "copyPatchPath" }
  | { kind: "openInRunGet" }
  | { kind: "copyCurl" }
  | { kind: "cancel" };

async function reviewLoop(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  baseUrl: string,
  state: SmartPatchState
): Promise<SmartPatchState | undefined> {
  let current = state;

  while (true) {
    const patchPath = buildPatchPath(current);
    const patchBody = buildPatchBody(current);

    const fieldSummary =
      current.fields.length <= 5
        ? current.fields.map((x) => `${x.logicalName}=${x.rawValue}`).join(", ")
        : `${current.fields.length} fields`;

    const items: Array<{ label: string; description?: string; choice: ReviewChoice }> = [
      { label: "✅ Run PATCH", description: `${patchPath}`, choice: { kind: "run" } },

      { label: "✏️ Edit entity", description: `${current.entitySetName} (${current.entityLogicalName})`, choice: { kind: "editEntity" } },
      { label: "✏️ Edit record id", description: current.id, choice: { kind: "editId" } },
      { label: "✏️ Edit fields", description: `${current.fields.length} fields`, choice: { kind: "editFields" } },
      { label: "✏️ Edit values", description: fieldSummary, choice: { kind: "editValues" } },

      { label: "📋 Copy payload", description: "Copies JSON body to clipboard", choice: { kind: "copyPayload" } },
      { label: "📋 Copy PATCH path", description: "Copies /<entitySet>(<guid>) to clipboard", choice: { kind: "copyPatchPath" } },
      { label: "📋 Copy PATCH as curl", description: "Copies curl command to clipboard", choice: { kind: "copyCurl" } },      
      { label: "➡️ Open in Run GET", description: "Adds a GET for this record to history and opens Run GET", choice: { kind: "openInRunGet" } },
      { label: "❌ Cancel", choice: { kind: "cancel" } }
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: "DV Quick Run: Smart PATCH — Review",
      placeHolder: "Run or adjust parameters",
      ignoreFocusOut: true
    });

    const choice = picked?.choice;
    if (!choice) {return undefined;}

    if (choice.kind === "cancel") {return undefined;}

    if (choice.kind === "copyPayload") {
      await vscode.env.clipboard.writeText(JSON.stringify(patchBody, null, 2));
      vscode.window.showInformationMessage("DV Quick Run: PATCH payload copied.");
      continue;
    }

    if (choice.kind === "copyPatchPath") {
      await vscode.env.clipboard.writeText(patchPath);
      vscode.window.showInformationMessage("DV Quick Run: PATCH path copied.");
      continue;
    }

    if (choice.kind === "copyCurl") {
      const curl = buildPatchCurl(baseUrl, patchPath, patchBody);
      await vscode.env.clipboard.writeText(curl);
      vscode.window.showInformationMessage("DV Quick Run: curl command copied.");
      continue;
    }

    if (choice.kind === "openInRunGet") {
      const getPath = `${current.entitySetName}(${current.id})`;
      await addQueryToHistory(ctx.ext, getPath);
      await vscode.commands.executeCommand("dvQuickRun.runGet");
      return undefined;
    }

    if (choice.kind === "run") {return current;}

    if (choice.kind === "editId") {
      const id = await promptRecordId(current.id);
      if (!id) {return undefined;}
      current = { ...current, id };
      continue;
    }

    if (choice.kind === "editEntity") {
      const defs = await loadEntityDefs(ctx, client, token);
      const def = await pickEntity(defs, current.entityLogicalName);
      if (!def) {return undefined;}

      const id = await promptRecordId(undefined);
      if (!id) {return undefined;}

      current = { entityLogicalName: def.logicalName, entitySetName: def.entitySetName, id, fields: [], ifMatch: current.ifMatch };
      continue;
    }

    if (choice.kind === "editFields") {
      const fields = await getFieldsForEntity(ctx, client, token, current.entityLogicalName);

      const pre = current.fields.map((x) => x.logicalName);
      const pickedFields = await pickPatchableFields(current.entitySetName, fields, pre);
      if (!pickedFields) {return undefined;}

      const values = await promptValues(pickedFields, current.fields);
      if (!values) {return undefined;}

      current = { ...current, fields: values };
      continue;
    }

    if (choice.kind === "editValues") {
      const fields = await getFieldsForEntity(ctx, client, token, current.entityLogicalName);

      const map = new Map(fields.map((f) => [f.logicalName.toLowerCase(), f]));
      const pickedFields = current.fields
        .map((x) => map.get(x.logicalName.toLowerCase()))
        .filter((x): x is SmartField => !!x);

      const values = await promptValues(pickedFields, current.fields);
      if (!values) {return undefined;}

      current = { ...current, fields: values };
      continue;
    }
  }
}

async function executePatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState
): Promise<void> {
  const patchPath = buildPatchPath(state);
  const body = buildPatchBody(state);

  await saveLastState(ctx, state);

  ctx.output.appendLine(`Smart PATCH: entity=${state.entitySetName} id=${state.id} fields=${state.fields.length}`);
  ctx.output.appendLine(`PATCH ${patchPath}`);
  ctx.output.appendLine(`Payload:\n${JSON.stringify(body, null, 2)}`);

  const result = await client.patch(patchPath, token, body, state.ifMatch);

  await showJsonNamed(`DVQR_PATCH_${state.entitySetName}_${state.id}`, {
    entity: state.entitySetName,
    id: state.id,
    path: patchPath,
    ifMatch: state.ifMatch,
    payload: body,
    result
  });
}

async function buildInitialState(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  pre?: SmartPatchState
): Promise<SmartPatchState | undefined> {
  const defs = await loadEntityDefs(ctx, client, token);
  const def = await pickEntity(defs, pre?.entityLogicalName);
  if (!def) {return undefined;}

  const id = await promptRecordId(pre?.id);
  if (!id) {return undefined;}

  const fields = await getFieldsForEntity(ctx, client, token, def.logicalName);
  const pickedFields = await pickPatchableFields(def.entitySetName, fields, pre?.fields?.map((x) => x.logicalName));
  if (!pickedFields) {return undefined;}

  const values = await promptValues(pickedFields, pre?.fields);
  if (!values) {return undefined;}

  const state: SmartPatchState = {
    entityLogicalName: def.logicalName,
    entitySetName: def.entitySetName,
    id,
    fields: values,
    ifMatch: pre?.ifMatch ?? "*"
  };

  return state;
}

export async function runSmartPatchAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const { token, client, baseUrl } = await initContext(ctx);

    const built = await buildInitialState(ctx, client, token, undefined);
    if (!built) {return;}

    const reviewed = await reviewLoop(ctx, client, token, baseUrl, built);
    if (!reviewed) {return;}

    await executePatch(ctx, client, token, reviewed);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Smart PATCH failed. Check Output.");
  }
}

export async function runSmartPatchRerunLastAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const last = loadLastState(ctx);
    if (!last) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart PATCH state found yet.");
      return;
    }

    const { token, client } = await initContext(ctx);
    await executePatch(ctx, client, token, last);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Re-run last PATCH failed. Check Output.");
  }
}

export async function runSmartPatchEditLastAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const last = loadLastState(ctx);
    if (!last) {
      vscode.window.showInformationMessage("DV Quick Run: No previous Smart PATCH state found yet.");
      return;
    }

    const { token, client, baseUrl } = await initContext(ctx);

    const rebuilt = await buildInitialState(ctx, client, token, last);
    if (!rebuilt) {return;}

    const reviewed = await reviewLoop(ctx, client, token, baseUrl, rebuilt);
    if (!reviewed) {return;}

    await executePatch(ctx, client, token, reviewed);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Edit last PATCH failed. Check Output.");
  }
}