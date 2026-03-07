import * as vscode from "vscode";
import { OrderByPickItem, SmartField, SmartGetOrderByState } from "./smartGetTypes.js";

export async function promptOrderBy(
  selectedFields: SmartField[],
  pre?: SmartGetOrderByState
): Promise<SmartGetOrderByState | undefined> {
  const byLogical = new Map(selectedFields.map((f) => [(f.logicalName || "").toLowerCase(), f]));
  const hasCreatedOn = byLogical.has("createdon");
  const hasModifiedOn = byLogical.has("modifiedon");

  const items: OrderByPickItem[] = [{ label: "🚫 None", description: "No $orderby", action: "none" }];

  if (hasCreatedOn) {
    items.push(
      {
        label: "createdon desc",
        description: "Most recent first",
        action: "pick",
        value: { fieldLogicalName: "createdon", direction: "desc" }
      },
      {
        label: "createdon asc",
        description: "Oldest first",
        action: "pick",
        value: { fieldLogicalName: "createdon", direction: "asc" }
      }
    );
  }

  if (hasModifiedOn) {
    items.push(
      {
        label: "modifiedon desc",
        description: "Most recently updated first",
        action: "pick",
        value: { fieldLogicalName: "modifiedon", direction: "desc" }
      },
      {
        label: "modifiedon asc",
        description: "Least recently updated first",
        action: "pick",
        value: { fieldLogicalName: "modifiedon", direction: "asc" }
      }
    );
  }

  items.push({
    label: "🔎 Choose from selected fields…",
    description: "Pick any selected field + direction",
    action: "chooseOther"
  });

  const picked = await vscode.window.showQuickPick<OrderByPickItem>(items, {
    title: "DV Quick Run: $orderby",
    placeHolder: pre ? `${pre.fieldLogicalName} ${pre.direction}` : "Choose ordering (or none)",
    ignoreFocusOut: true
  });

  if (!picked) {return pre;} // preserve if cancelled
  if (picked.action === "none") {return undefined;}
  if (picked.action === "pick") {return picked.value;}

  // chooseOther
  const sortable = selectedFields.filter((f) => {
    const t = (f.attributeType || "").toLowerCase();
    if (!f.logicalName) {return false;}
    if (t === "lookup" || t === "customer" || t === "owner") {return false;}
    if (t === "virtual" || t === "managedproperty" || t === "partylist") {return false;}
    return true;
  });

  if (sortable.length === 0) {
    vscode.window.showWarningMessage("DV Quick Run: No sortable fields available from your selected fields.");
    return pre;
  }

  const fieldPick = await vscode.window.showQuickPick(
    sortable.map((f) => ({ label: f.logicalName, description: f.attributeType })),
    {
      title: "DV Quick Run: Pick $orderby field",
      placeHolder: "Choose a field",
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  if (!fieldPick) {return pre;}

  const dirPick = await vscode.window.showQuickPick(
    [
      { label: "desc", description: "Descending" },
      { label: "asc", description: "Ascending" }
    ],
    {
      title: "DV Quick Run: Pick $orderby direction",
      placeHolder: "Choose direction",
      ignoreFocusOut: true
    }
  );

  if (!dirPick) {return pre;}

  return { fieldLogicalName: fieldPick.label, direction: dirPick.label as "asc" | "desc" };
}