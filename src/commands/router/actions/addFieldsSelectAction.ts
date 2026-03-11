import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { logError, logInfo } from "../../../utils/logger.js";
import { loadEntityDefs, loadFields } from "./shared/metadataAccess.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import { FieldDef } from "../../../services/entityFieldMetadataService.js";
import { getSelectableFields } from "./shared/selectableFields.js";
import { getEditorQueryTarget } from "./shared/queryMutation/editorQueryTarget.js";
import {
  parseEditorQuery,
  buildEditorQuery,
  getEntitySetNameFromEditorQuery
} from "./shared/queryMutation/parsedEditorQuery.js";
import { upsertCsvQueryOption } from "./shared/queryMutation/queryOptionMutator.js";
import { applyEditorQueryUpdate } from "./shared/queryMutation/applyEditorQueryUpdate.js";

function pickEntity(defs: EntityDef[], entitySetName: string): EntityDef | undefined {
  return defs.find((d) => d.entitySetName.toLowerCase() === entitySetName.toLowerCase());
}

async function pickFields(entitySetName: string, fields: FieldDef[]): Promise<string[] | undefined> {
  const selectable = getSelectableFields(fields);

  const picked = await vscode.window.showQuickPick(
    selectable.map((f) => ({
      label: f.logicalName,
      description: f.attributeType,
      detail: `$select token: ${f.selectToken}`,
      token: f.selectToken as string
    })),
    {
      title: `DV Quick Run: Add Fields ($select) — ${entitySetName}`,
      placeHolder: "Pick fields to add to $select",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {
    return undefined;
  }

  return picked.map((p) => p.token);
}

export async function runAddFieldsSelectAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const target = getEditorQueryTarget();
    const parsed = parseEditorQuery(target.text);

    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
    if (!entitySetName) {
      throw new Error(`Could not detect entity set name from: ${target.text}`);
    }

    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);

    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient(baseUrl);

    const defs = await loadEntityDefs(ctx, client, token);
    const def = await pickEntity(defs, entitySetName);
    if (!def) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const fields = await loadFields(ctx, client, token, def.logicalName);
    const pickedTokens = await pickFields(def.entitySetName, fields);
    if (!pickedTokens?.length) {
      return;
    }

    upsertCsvQueryOption(parsed, "$select", pickedTokens, "appendCsv");

    const updated = buildEditorQuery(parsed);
    await applyEditorQueryUpdate(target, updated);

    logInfo(ctx.output,`Add Fields ($select): ${target.text} -> ${updated}`);
    vscode.window.showInformationMessage("DV Quick Run: Added fields to $select.");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Add Fields ($select) failed. Check Output.");
  }
}