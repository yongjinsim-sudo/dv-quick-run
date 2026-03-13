import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { SmartPatchState } from "./smartPatchTypes.js";
import { buildPatchBody, buildPatchPath } from "./smartPatchQueryBuilder.js";
import { saveLastState } from "./smartPatchPersistence.js";

export async function executeSmartPatch(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartPatchState
): Promise<void> {
  const patchPath = buildPatchPath(state);
  const body = buildPatchBody(state);

  await saveLastState(ctx, state);

  logInfo(ctx.output, `Smart PATCH: entity=${state.entitySetName} fields=${state.fields.length}`);
  logDebug(ctx.output, `PATCH ${patchPath}`);
  logDebug(ctx.output, `Payload fields: ${state.fields.map((x) => x.logicalName).join(", ")}`);

  const result = await client.patch(patchPath, token, body, state.ifMatch);

  await showJsonNamed(`DVQR_PATCH_${state.entitySetName}_${state.id}`, {
    entity: state.entitySetName,
    id: state.id,
    path: patchPath,
    ifMatch: state.ifMatch,
    payload: body,
    result
  });
}
