import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { loadEntityDefs } from "../shared/metadataAccess.js";
import { runAction } from "../shared/actionRunner.js";
import { METADATA_KINDS, MetadataKind } from "./metadataTypes.js";
import { buildMetadataPath, metadataVirtualPath } from "./metadataBuilders.js";
import { logDataverseExecutionResult, logDataverseExecutionStart } from "../shared/executionLogging.js";


async function pickEntity(defs: EntityDef[]): Promise<EntityDef | undefined> {
  const picked = await vscode.window.showQuickPick(
    defs.map((d) => ({
      label: d.logicalName,
      description: d.entitySetName,
      def: d
    })),
    {
      title: "DV Quick Run: Pick entity logical name",
      placeHolder: "Type to filter (e.g. contact)",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.def;
}

async function pickKind(): Promise<MetadataKind | undefined> {
  const picked = await vscode.window.showQuickPick(METADATA_KINDS as unknown as string[], {
    title: "DV Quick Run: Metadata type",
    placeHolder: "Choose metadata to view",
    ignoreFocusOut: true
  });

  if (!picked) {return undefined;}
  if ((METADATA_KINDS as readonly string[]).includes(picked)) {return picked as MetadataKind;}
  return undefined;
}

export async function runGetMetadataAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Get Metadata failed. Check Output.", async () => {
    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);
    const client = ctx.getClient();
    const defs = await loadEntityDefs(ctx, client, token);
    const def = await pickEntity(defs);
    if (!def) {return;}

    const kind = await pickKind();
    if (!kind) {return;}

    const path = buildMetadataPath(def.logicalName, kind);

    const env = ctx.envContext.getEnvironmentName();
    logDataverseExecutionStart(ctx.output, env, "GET", path);

    const start = Date.now();
    const result = await client.get(path, token);
    const duration = Date.now() - start;

    await showJsonNamed(metadataVirtualPath(def.logicalName, kind), result);
    logDataverseExecutionResult(ctx.output, 1, duration);
  });
}
