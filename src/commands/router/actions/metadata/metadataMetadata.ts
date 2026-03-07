import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";

import { getCachedEntityDefs, setCachedEntityDefs, EntityDef } from "../../../../utils/entitySetCache.js";
import { fetchEntityDefs } from "../../../../services/entityMetadataService.js";

export async function getEntityDefs(
  ctx: CommandContext,
  client: DataverseClient,
  token: string
): Promise<EntityDef[]> {
  const cached = getCachedEntityDefs(ctx.ext);
  if (cached?.length) {
    ctx.output.appendLine(`Entity defs cache hit: ${cached.length} items.`);
    return cached;
  }

  const defs = await vscode.window.withProgress<EntityDef[]>(
    {
      location: vscode.ProgressLocation.Notification,
      title: "DV Quick Run: Loading Dataverse entity list...",
      cancellable: false
    },
    async () => await fetchEntityDefs(client, token)
  );

  await setCachedEntityDefs(ctx.ext, defs);
  ctx.output.appendLine(`Entity defs fetched: ${defs.length} items.`);
  return defs;
}