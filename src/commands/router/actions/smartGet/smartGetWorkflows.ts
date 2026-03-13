import { CommandContext } from "../../../context/commandContext.js";
import { initSmartGetContext } from "./smartGetContext.js";
import { executeSmartGetState } from "./smartGetExecution.js";
import { getGuidTargetFields, buildOrEditState, reviewAndEditLoop } from "./smartGetReview.js";
import { loadLastSmartGetState } from "./smartGetPersistence.js";
import type { SmartField, SmartGetState } from "./smartGetTypes.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import type { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

type InitResult = { token: string; client: DataverseClient; session: SmartMetadataSession };
type ReviewedResult = { state: SmartGetState; fields: SmartField[] } | undefined;
type BuiltResult = ReviewedResult;

type SmartGetWorkflowDeps = {
  initContext: (ctx: CommandContext) => Promise<InitResult>;
  buildState: (session: SmartMetadataSession, initial?: SmartGetState) => Promise<BuiltResult>;
  reviewLoop: (
    ctx: CommandContext,
    client: DataverseClient,
    token: string,
    session: SmartMetadataSession,
    initial: SmartGetState,
    initialFields: SmartField[]
  ) => Promise<ReviewedResult>;
  executeState: (
    ctx: CommandContext,
    client: DataverseClient,
    token: string,
    state: SmartGetState,
    fields: SmartField[]
  ) => Promise<void>;
  loadLastState: (ctx: CommandContext) => SmartGetState | undefined;
  getGuidFields: (
    session: SmartMetadataSession,
    entityLogicalName: string,
    ctx: CommandContext,
    client: DataverseClient,
    token: string
  ) => Promise<SmartField[]>;
};

const defaultDeps: SmartGetWorkflowDeps = {
  initContext: initSmartGetContext,
  buildState: buildOrEditState,
  reviewLoop: reviewAndEditLoop,
  executeState: executeSmartGetState,
  loadLastState: loadLastSmartGetState,
  getGuidFields: getGuidTargetFields
};

export async function runSmartGetMainWorkflowWithDeps(
  ctx: CommandContext,
  deps: SmartGetWorkflowDeps
): Promise<void> {
  const { token, client, session } = await deps.initContext(ctx);

  const built = await deps.buildState(session, undefined);
  if (!built) {return;}

  const reviewed = await deps.reviewLoop(
    ctx,
    client,
    token,
    session,
    built.state,
    built.fields
  );
  if (!reviewed) {return;}

  await deps.executeState(ctx, client, token, reviewed.state, reviewed.fields);
}

export async function rerunSmartGetLastWorkflowWithDeps(
  ctx: CommandContext,
  deps: SmartGetWorkflowDeps
): Promise<boolean> {
  const last = deps.loadLastState(ctx);
  if (!last) {
    return false;
  }

  const { token, client, session } = await deps.initContext(ctx);
  const fields = await deps.getGuidFields(session, last.entityLogicalName, ctx, client, token);

  await deps.executeState(ctx, client, token, last, fields);
  return true;
}

export async function editSmartGetLastWorkflowWithDeps(
  ctx: CommandContext,
  deps: SmartGetWorkflowDeps
): Promise<boolean> {
  const last = deps.loadLastState(ctx);
  if (!last) {
    return false;
  }

  const { token, client, session } = await deps.initContext(ctx);
  const fields = await deps.getGuidFields(session, last.entityLogicalName, ctx, client, token);

  const reviewed = await deps.reviewLoop(ctx, client, token, session, last, fields);
  if (!reviewed) {
    return true;
  }

  await deps.executeState(ctx, client, token, reviewed.state, reviewed.fields);
  return true;
}

export async function runSmartGetMainWorkflow(ctx: CommandContext): Promise<void> {
  await runSmartGetMainWorkflowWithDeps(ctx, defaultDeps);
}

export async function rerunSmartGetLastWorkflow(ctx: CommandContext): Promise<boolean> {
  return rerunSmartGetLastWorkflowWithDeps(ctx, defaultDeps);
}

export async function editSmartGetLastWorkflow(ctx: CommandContext): Promise<boolean> {
  return editSmartGetLastWorkflowWithDeps(ctx, defaultDeps);
}
