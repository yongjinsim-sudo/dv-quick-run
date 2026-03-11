import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { logError, logInfo } from "../../../utils/logger.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import { FieldDef } from "../../../services/entityFieldMetadataService.js";
import { loadEntityDefs, loadFields } from "./shared/metadataAccess.js";
import { getSelectableFields } from "./shared/selectableFields.js";
import { getEditorQueryTarget } from "./shared/queryMutation/editorQueryTarget.js";
import {
  parseEditorQuery,
  buildEditorQuery,
  getEntitySetNameFromEditorQuery
} from "./shared/queryMutation/parsedEditorQuery.js";
import {
  appendOrderByExpression
} from "./shared/queryMutation/queryOptionMutator.js";
import { applyEditorQueryUpdate } from "./shared/queryMutation/applyEditorQueryUpdate.js";

type OrderableField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
  selectToken?: string;
};

function pickEntity(defs: EntityDef[], entitySetName: string): EntityDef | undefined {
  return defs.find((d) => d.entitySetName.toLowerCase() === entitySetName.toLowerCase());
}

function toOrderableFields(fields: FieldDef[]): OrderableField[] {
  return getSelectableFields(fields).map((f) => ({
    logicalName: f.logicalName,
    attributeType: f.attributeType,
    isValidForRead: f.isValidForRead,
    selectToken: f.selectToken
  }));
}

async function pickField(entitySetName: string, fields: OrderableField[]): Promise<OrderableField | undefined> {
  const picked = await vscode.window.showQuickPick(
    fields.map((f) => ({
      label: f.logicalName,
      description: f.attributeType || "",
      detail: f.selectToken && f.selectToken !== f.logicalName ? `Uses ${f.selectToken}` : undefined,
      field: f
    })),
    {
      title: `DV Quick Run: Add Order ($orderby) — ${entitySetName}`,
      placeHolder: "Pick a field to order by",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.field;
}

async function pickDirection(): Promise<"asc" | "desc" | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Ascending", description: "asc", value: "asc" as const },
      { label: "Descending", description: "desc", value: "desc" as const }
    ],
    {
      title: "DV Quick Run: Order direction",
      placeHolder: "Choose sort direction",
      ignoreFocusOut: true
    }
  );

  return picked?.value;
}

async function pickExistingOrderStrategy(existingOrder: string): Promise<"replace" | "append" | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Replace existing $orderby", value: "replace" as const, description: existingOrder },
      { label: "Append to existing $orderby", value: "append" as const, description: existingOrder }
    ],
    {
      title: "DV Quick Run: Existing $orderby found",
      placeHolder: "Choose how to combine the new order",
      ignoreFocusOut: true
    }
  );

  return picked?.value;
}

function buildOrderClause(field: OrderableField, direction: "asc" | "desc"): string {
  const left = field.selectToken ?? field.logicalName;
  return `${left} ${direction}`;
}

export async function runAddOrderByAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const target = getEditorQueryTarget();
    const parsed = parseEditorQuery(target.text);

    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
    if (!entitySetName) {
      throw new Error(`Could not detect entity set name from: ${target.text}`);
    }

    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope();

    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient();

    const defs = await loadEntityDefs(ctx, client, token);
    const def = await pickEntity(defs, entitySetName);
    if (!def) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const rawFields = await loadFields(ctx, client, token, def.logicalName);
    const fields = toOrderableFields(rawFields);

    const pickedField = await pickField(def.entitySetName, fields);
    if (!pickedField) {return;}

    const direction = await pickDirection();
    if (!direction) {return;}

    const newClause = buildOrderClause(pickedField, direction);

    const existingOrder = parsed.queryOptions.get("$orderby");
    let replaceExisting = false;

    if (existingOrder) {
      const pickedStrategy = await pickExistingOrderStrategy(existingOrder);
      if (!pickedStrategy) {return;}
      replaceExisting = pickedStrategy === "replace";
    }

    appendOrderByExpression(parsed, newClause, replaceExisting);

    const updated = buildEditorQuery(parsed);
    await applyEditorQueryUpdate(target, updated);

    logInfo(ctx.output,`Add Order ($orderby): ${target.text} -> ${updated}`);
    vscode.window.showInformationMessage("DV Quick Run: Added order to $orderby.");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Add Order ($orderby) failed. Check Output.");
  }
}