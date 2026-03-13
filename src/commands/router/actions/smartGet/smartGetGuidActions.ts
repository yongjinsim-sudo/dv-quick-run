import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { initSmartGetContext } from "./smartGetContext.js";
import { executeSmartGetGuidPickFields, executeSmartGetGuidRaw, getSelectedGuidOrThrow } from "./smartGetExecution.js";
import { pickSmartGetEntity, pickSmartGetFields } from "./smartGetFieldSelection.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

async function pickGuidTargetEntity(session: SmartMetadataSession): Promise<EntityDef | undefined> {
  const defs = await session.getEntityDefs();
  return pickSmartGetEntity(defs);
}

export async function runSmartGetFromGuidRawWorkflow(ctx: CommandContext): Promise<void> {
  const guid = getSelectedGuidOrThrow();
  const { token, client, session } = await initSmartGetContext(ctx);

  const def = await pickGuidTargetEntity(session);
  if (!def) {return;}

  await executeSmartGetGuidRaw(ctx, client, token, def.entitySetName, guid);
}

export async function runSmartGetFromGuidPickFieldsWorkflow(ctx: CommandContext): Promise<void> {
  const guid = getSelectedGuidOrThrow();
  const { token, client, session } = await initSmartGetContext(ctx);

  const def = await pickGuidTargetEntity(session);
  if (!def) {return;}

  const fields = await session.getSmartFields(def.logicalName);
  const pickedFields = await pickSmartGetFields(def, fields);
  if (!pickedFields) {return;}

  const selectTokens = pickedFields.map((f) => f.selectToken).filter((x): x is string => !!x);
  if (selectTokens.length === 0) {
    vscode.window.showWarningMessage("DV Quick Run: None of the selected fields are selectable via $select.");
    return;
  }

  await executeSmartGetGuidPickFields(ctx, client, token, def.entitySetName, guid, selectTokens);
}
