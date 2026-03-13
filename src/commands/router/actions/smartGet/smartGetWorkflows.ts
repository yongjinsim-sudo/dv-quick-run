import { CommandContext } from "../../../context/commandContext.js";
import { initSmartGetContext } from "./smartGetContext.js";
import { executeSmartGetState } from "./smartGetExecution.js";
import { getGuidTargetFields, buildOrEditState, reviewAndEditLoop } from "./smartGetReview.js";
import { loadLastSmartGetState } from "./smartGetPersistence.js";

export async function runSmartGetMainWorkflow(ctx: CommandContext): Promise<void> {
  const { token, client, session } = await initSmartGetContext(ctx);

  const built = await buildOrEditState(session, undefined);
  if (!built) {return;}

  const reviewed = await reviewAndEditLoop(
    ctx,
    client,
    token,
    session,
    built.state,
    built.fields
  );
  if (!reviewed) {return;}

  await executeSmartGetState(ctx, client, token, reviewed.state, reviewed.fields);
}

export async function rerunSmartGetLastWorkflow(ctx: CommandContext): Promise<boolean> {
  const last = loadLastSmartGetState(ctx);
  if (!last) {
    return false;
  }

  const { token, client, session } = await initSmartGetContext(ctx);
  const fields = await getGuidTargetFields(session, last.entityLogicalName, ctx, client, token);

  await executeSmartGetState(ctx, client, token, last, fields);
  return true;
}

export async function editSmartGetLastWorkflow(ctx: CommandContext): Promise<boolean> {
  const last = loadLastSmartGetState(ctx);
  if (!last) {
    return false;
  }

  const { token, client, session } = await initSmartGetContext(ctx);
  const fields = await getGuidTargetFields(session, last.entityLogicalName, ctx, client, token);

  const reviewed = await reviewAndEditLoop(ctx, client, token, session, last, fields);
  if (!reviewed) {
    return true;
  }

  await executeSmartGetState(ctx, client, token, reviewed.state, reviewed.fields);
  return true;
}
