import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logError } from "../../../../utils/logger.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { findEntityByEntitySetName, loadEntityDefs } from "../shared/metadataAccess.js";

export async function tryResolveEntity(
  ctx: CommandContext,
  entitySetName?: string
): Promise<EntityDef | undefined> {
  if (!entitySetName) {
    return undefined;
  }

  try {
    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient();
    const defs = await loadEntityDefs(ctx, client, token);

    return findEntityByEntitySetName(defs, entitySetName);
  } catch (e: any) {
    logError(ctx.output, `Explain Query metadata resolution skipped: ${e?.message ?? String(e)}`);
    return undefined;
  }
}

export async function openMarkdownPreview(markdown: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: markdown
  });

  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside
  });

  return doc;
}
