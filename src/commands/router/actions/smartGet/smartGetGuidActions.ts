import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { initSmartGetContext } from "./smartGetContext.js";
import { executeSmartGetGuidPickFields, executeSmartGetGuidRaw, getSelectedGuidOrThrow } from "./smartGetExecution.js";
import { pickSmartGetEntity, pickSmartGetFields } from "./smartGetFieldSelection.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import type { SmartField } from "./smartGetTypes.js";

async function pickGuidTargetEntity(session: SmartMetadataSession): Promise<EntityDef | undefined> {
  const defs = await session.getEntityDefs();
  return pickSmartGetEntity(defs);
}

type GuidInitResult = { token: string; client: DataverseClient; session: SmartMetadataSession };
type SmartGetGuidDeps = {
  getGuid: () => string;
  initContext: (ctx: CommandContext) => Promise<GuidInitResult>;
  pickEntity: (session: SmartMetadataSession) => Promise<EntityDef | undefined>;
  getSmartFields: (session: SmartMetadataSession, logicalName: string) => Promise<SmartField[]>;
  pickFields: (def: EntityDef, fields: SmartField[]) => Promise<SmartField[] | undefined>;
  executeRaw: (ctx: CommandContext, client: DataverseClient, token: string, entitySetName: string, guid: string) => Promise<void>;
  executePickFields: (
    ctx: CommandContext,
    client: DataverseClient,
    token: string,
    entitySetName: string,
    guid: string,
    selectTokens: string[]
  ) => Promise<void>;
  showWarning: (message: string) => Thenable<string | undefined>;
};

const defaultDeps: SmartGetGuidDeps = {
  getGuid: getSelectedGuidOrThrow,
  initContext: initSmartGetContext,
  pickEntity: pickGuidTargetEntity,
  getSmartFields: (session, logicalName) => session.getSmartFields(logicalName),
  pickFields: pickSmartGetFields,
  executeRaw: executeSmartGetGuidRaw,
  executePickFields: executeSmartGetGuidPickFields,
  showWarning: (message) => vscode.window.showWarningMessage(message)
};

export async function runSmartGetFromGuidRawWorkflowWithDeps(ctx: CommandContext, deps: SmartGetGuidDeps): Promise<void> {
  const guid = deps.getGuid();
  const { token, client, session } = await deps.initContext(ctx);

  const def = await deps.pickEntity(session);
  if (!def) {return;}

  await deps.executeRaw(ctx, client, token, def.entitySetName, guid);
}

export async function runSmartGetFromGuidPickFieldsWorkflowWithDeps(ctx: CommandContext, deps: SmartGetGuidDeps): Promise<void> {
  const guid = deps.getGuid();
  const { token, client, session } = await deps.initContext(ctx);

  const def = await deps.pickEntity(session);
  if (!def) {return;}

  const fields = await deps.getSmartFields(session, def.logicalName);
  const pickedFields = await deps.pickFields(def, fields);
  if (!pickedFields) {return;}

  const selectTokens = pickedFields.map((f) => f.selectToken).filter((x): x is string => !!x);
  if (selectTokens.length === 0) {
    await deps.showWarning("DV Quick Run: None of the selected fields are selectable via $select.");
    return;
  }

  await deps.executePickFields(ctx, client, token, def.entitySetName, guid, selectTokens);
}

export async function runSmartGetFromGuidRawWorkflow(ctx: CommandContext): Promise<void> {
  await runSmartGetFromGuidRawWorkflowWithDeps(ctx, defaultDeps);
}

export async function runSmartGetFromGuidPickFieldsWorkflow(ctx: CommandContext): Promise<void> {
  await runSmartGetFromGuidPickFieldsWorkflowWithDeps(ctx, defaultDeps);
}
