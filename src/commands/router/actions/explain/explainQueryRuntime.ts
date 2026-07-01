import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logError } from "../../../../utils/logger.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { findEntityByEntitySetName, loadEntityDefs } from "../shared/metadataAccess.js";
import { ensureDvForgeLabWorkspace } from "../../../../product/workspace/dvForgeLabWorkspaceService.js";

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

function buildExplainFileName(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `DVQR-Explain-${stamp}.md`;
}

async function createWorkspaceBackedMarkdownDocument(markdown: string): Promise<vscode.TextDocument> {
  const workspace = await ensureDvForgeLabWorkspace({ preferLegacyIfPresent: true });
  const explainRoot = workspace.dvqrRoot
    ? vscode.Uri.joinPath(workspace.dvqrRoot, "explain")
    : undefined;

  if (explainRoot) {
    await vscode.workspace.fs.createDirectory(explainRoot);
    const uri = vscode.Uri.joinPath(explainRoot, buildExplainFileName());
    await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, "utf8"));
    return await vscode.workspace.openTextDocument(uri);
  }

  return await vscode.workspace.openTextDocument({
    language: "markdown",
    content: markdown
  });
}

export async function openMarkdownPreview(markdown: string): Promise<vscode.TextDocument> {
  const doc = await createWorkspaceBackedMarkdownDocument(markdown);

  // Open only the rendered Markdown preview.
  // The backing document is intentionally not shown in the editor group, so Query Explain
  // behaves like a report surface rather than exposing the generated host artifact first.
  await vscode.commands.executeCommand("markdown.showPreview", doc.uri);

  return doc;
}
