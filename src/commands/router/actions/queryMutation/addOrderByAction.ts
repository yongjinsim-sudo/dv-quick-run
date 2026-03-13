import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import { loadFields } from "../shared/metadataAccess.js";
import { getSelectableFields } from "../shared/selectableFields.js";
import { appendOrderByExpression } from "../shared/queryMutation/queryOptionMutator.js";
import { runQueryMutationAction } from "../shared/queryMutation/runQueryMutationAction.js";

type OrderableField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
  selectToken?: string;
};

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
  await runQueryMutationAction(
    ctx,
    "Add Order ($orderby)",
    "DV Quick Run: Added order to $orderby.",
    async ({ parsed, token, client, entityDef }) => {
      const rawFields = await loadFields(ctx, client, token, entityDef.logicalName);
      const fields = toOrderableFields(rawFields);

      const pickedField = await pickField(entityDef.entitySetName, fields);
      if (!pickedField) {
        return false;
      }

      const direction = await pickDirection();
      if (!direction) {
        return false;
      }

      const newClause = buildOrderClause(pickedField, direction);

      const existingOrder = parsed.queryOptions.get("$orderby");
      let replaceExisting = false;

      if (existingOrder) {
        const pickedStrategy = await pickExistingOrderStrategy(existingOrder);
        if (!pickedStrategy) {
          return false;
        }
        replaceExisting = pickedStrategy === "replace";
      }

      appendOrderByExpression(parsed, newClause, replaceExisting);
      return true;
    }
  );
}