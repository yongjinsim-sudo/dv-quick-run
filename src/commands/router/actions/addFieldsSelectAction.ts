import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { loadFields } from "./shared/metadataAccess.js";
import { FieldDef } from "../../../services/entityFieldMetadataService.js";
import { getSelectableFields } from "./shared/selectableFields.js";
import { upsertCsvQueryOption } from "./shared/queryMutation/queryOptionMutator.js";
import { runQueryMutationAction } from "./shared/queryMutation/runQueryMutationAction.js";

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
  await runQueryMutationAction(
    ctx,
    "Add Fields ($select)",
    "DV Quick Run: Added fields to $select.",
    async ({ parsed, token, client, entityDef }) => {
      const fields = await loadFields(ctx, client, token, entityDef.logicalName);
      const pickedTokens = await pickFields(entityDef.entitySetName, fields);
      if (!pickedTokens?.length) {
        return false;
      }

      upsertCsvQueryOption(parsed, "$select", pickedTokens, "appendCsv");
      return true;
    }
  );
}