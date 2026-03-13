import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { addQueryToHistory } from "../../../../utils/queryHistory.js";
import { buildPatchBody, buildPatchCurl, buildPatchPath } from "./smartPatchQueryBuilder.js";
import { SmartField, SmartPatchState } from "./smartPatchTypes.js";
import {
  getFieldsForPatchEntity,
  pickPatchEntity,
  pickPatchableFields,
  promptPatchRecordId,
  promptPatchValues
} from "./smartPatchFieldSelection.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

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

export async function runSmartPatchReviewLoop(
  ctx: CommandContext,
  _client: DataverseClient,
  _token: string,
  baseUrl: string,
  session: SmartMetadataSession,
  initial: SmartPatchState,
  initialFields: SmartField[]
): Promise<{ state: SmartPatchState; fields: SmartField[] } | undefined> {
  let current = initial;
  let fields = initialFields;

  while (true) {
    const patchPath = buildPatchPath(current);
    const patchBody = buildPatchBody(current);

    const fieldSummary =
      current.fields.length <= 5
        ? current.fields.map((x) => `${x.logicalName}=${x.rawValue}`).join(", ")
        : `${current.fields.length} fields`;

    const items: Array<{ label: string; description?: string; choice: ReviewChoice }> = [
      { label: "✅ Run PATCH", description: `${patchPath}`, choice: { kind: "run" } },
      {
        label: "✏️ Edit entity",
        description: `${current.entitySetName} (${current.entityLogicalName})`,
        choice: { kind: "editEntity" }
      },
      { label: "✏️ Edit record id", description: current.id, choice: { kind: "editId" } },
      { label: "✏️ Edit fields", description: `${current.fields.length} fields`, choice: { kind: "editFields" } },
      { label: "✏️ Edit values", description: fieldSummary, choice: { kind: "editValues" } },
      { label: "📋 Copy payload", description: "Copies JSON body to clipboard", choice: { kind: "copyPayload" } },
      { label: "📋 Copy PATCH path", description: "Copies /<entitySet>(<guid>) to clipboard", choice: { kind: "copyPatchPath" } },
      { label: "📋 Copy PATCH as curl", description: "Copies curl command to clipboard", choice: { kind: "copyCurl" } },
      {
        label: "➡️ Open in Run GET",
        description: "Adds a GET for this record to history and opens Run GET",
        choice: { kind: "openInRunGet" }
      },
      { label: "❌ Cancel", choice: { kind: "cancel" } }
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: "DV Quick Run: Smart PATCH — Review",
      placeHolder: "Run or adjust parameters",
      ignoreFocusOut: true
    });

    const choice = picked?.choice;
    if (!choice || choice.kind === "cancel") {
      return undefined;
    }

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

    if (choice.kind === "run") {
      return { state: current, fields };
    }

    if (choice.kind === "editId") {
      const id = await promptPatchRecordId(current.id);
      if (!id) {
        return undefined;
      }

      current = { ...current, id };
      continue;
    }

    if (choice.kind === "editEntity") {
      const defs = await session.getEntityDefs();
      const def = await pickPatchEntity(defs, current.entityLogicalName);
      if (!def) {
        return undefined;
      }

      const id = await promptPatchRecordId(undefined);
      if (!id) {
        return undefined;
      }

      fields = await getFieldsForPatchEntity(session, def.logicalName);

      current = {
        entityLogicalName: def.logicalName,
        entitySetName: def.entitySetName,
        id,
        fields: [],
        ifMatch: current.ifMatch
      };
      continue;
    }

    if (choice.kind === "editFields") {
      const pre = current.fields.map((x) => x.logicalName);
      const pickedFields = await pickPatchableFields(current.entitySetName, fields, pre);
      if (!pickedFields) {
        return undefined;
      }

      const values = await promptPatchValues(pickedFields, current.fields);
      if (!values) {
        return undefined;
      }

      current = { ...current, fields: values };
      continue;
    }

    if (choice.kind === "editValues") {
      const map = new Map(fields.map((f) => [f.logicalName.toLowerCase(), f]));
      const pickedFields = current.fields
        .map((x) => map.get(x.logicalName.toLowerCase()))
        .filter((x): x is SmartField => !!x);

      const values = await promptPatchValues(pickedFields, current.fields);
      if (!values) {
        return undefined;
      }

      current = { ...current, fields: values };
      continue;
    }
  }
}
