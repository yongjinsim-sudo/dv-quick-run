import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { loadFields } from "../shared/metadataAccess.js";
import { getNearestSelectScope, resolveScopeLogicalName, buildAddSelectPreviewForScope } from "../../../../refinement/addSelectPreview.js";
import { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import { getSelectableFields } from "../shared/selectableFields.js";
import { runQueryMutationAction } from "../shared/queryMutation/runQueryMutationAction.js";

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
    async ({ target, token, client, entityDef }) => {
      const scope = getNearestSelectScope(target);

      const targetLogicalName = await resolveScopeLogicalName(
        ctx,
        client,
        token,
        entityDef.logicalName,
        scope.relationshipPath
      );

      const fields = await loadFields(ctx, client, token, targetLogicalName);
      const pickerEntityLabel = scope.relationshipPath.length
        ? scope.relationshipPath[scope.relationshipPath.length - 1]
        : entityDef.entitySetName;

      const pickedTokens = await pickFields(pickerEntityLabel, fields);
      if (!pickedTokens?.length) {
        return false;
      }

      const updatedQuery = buildAddSelectPreviewForScope(
        target.text,
        pickedTokens,
        scope.relationshipPath
      );

      await target.editor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.replace(target.range, updatedQuery);
      });

      return false;
    }
  );
}