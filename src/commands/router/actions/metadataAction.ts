import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";
import { EntityDef } from "../../../utils/entitySetCache.js";

import { loadEntityDefs } from "./shared/metadataAccess.js";
import { METADATA_KINDS, MetadataKind } from "./metadata/metadataTypes.js";
import { buildMetadataPath, metadataVirtualPath } from "./metadata/metadataBuilders.js";

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
  ctx.output.show(true);

  try {
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);

    ctx.output.appendLine(`BaseUrl: ${baseUrl}`);
    ctx.output.appendLine(`Scope: ${scope}`);
    ctx.output.appendLine(`Getting token via Azure CLI...`);

    const token = await ctx.getToken(scope);
    const client = ctx.getClient(baseUrl);

    const defs = await loadEntityDefs(ctx, client, token);
    const def = await pickEntity(defs);
    if (!def) {return;}

    const kind = await pickKind();
    if (!kind) {return;}

    const path = buildMetadataPath(def.logicalName, kind);

    ctx.output.appendLine(`Metadata: entity=${def.logicalName} kind=${kind}`);
    ctx.output.appendLine(`GET ${path}`);

    const result = await client.get(path, token);
    await showJsonNamed(metadataVirtualPath(def.logicalName, kind), result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Get Metadata failed. Check Output.");
  }
}