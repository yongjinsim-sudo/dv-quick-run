import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { buildOperationalProfile } from "../product/operationalProfile/operationalProfileEngine.js";
import { renderOperationalProfileMarkdown } from "../product/operationalProfile/operationalProfileMarkdownRenderer.js";
import {
  loadEntityDefByLogicalName,
  loadEntityDefs,
  loadFields,
  loadNavigationProperties
} from "./router/actions/shared/metadataAccess.js";
import type { EntityDef } from "../utils/entitySetCache.js";

async function pickEntity(defs: readonly EntityDef[]): Promise<EntityDef | undefined> {
  const picked = await vscode.window.showQuickPick(
    defs.map((definition) => ({
      label: definition.logicalName,
      description: definition.displayName ?? definition.entitySetName,
      detail: definition.entitySetName,
      definition
    })),
    {
      title: "DV Quick Run: Pick entity for Profile",
      placeHolder: "Choose an entity to profile (for example: contact)",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.definition;
}

async function resolveEntity(
  ctx: CommandContext,
  logicalName: string | undefined,
  token: string
): Promise<EntityDef | undefined> {
  const client = ctx.getClient();
  const requested = logicalName?.trim();

  if (requested) {
    const resolved = await loadEntityDefByLogicalName(ctx, client, token, requested);
    if (resolved) {
      return resolved;
    }

    return { logicalName: requested, entitySetName: requested };
  }

  const defs = await loadEntityDefs(ctx, client, token);
  return await pickEntity(defs);
}

async function openProfileDocument(markdown: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown"
  });

  await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside
  });

  await vscode.commands.executeCommand("markdown.showPreviewToSide", document.uri);
}

export function registerShowOperationalProfileCommand(
  ext: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  const disposable = vscode.commands.registerCommand(
    "dvQuickRun.showOperationalProfile",
    async (entityLogicalName?: string) => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "DV Quick Run: Building Operational Profile...",
          cancellable: false
        },
        async () => {
          const token = await ctx.getToken(ctx.getScope());
          const client = ctx.getClient();
          const entity = await resolveEntity(ctx, entityLogicalName, token);

          if (!entity) {
            return;
          }

          const [fields, relationships] = await Promise.all([
            loadFields(ctx, client, token, entity.logicalName, { silent: true }).catch(() => []),
            loadNavigationProperties(ctx, client, token, entity.logicalName, { silent: true }).catch(() => [])
          ]);

          const profile = buildOperationalProfile({
            entityLogicalName: entity.logicalName,
            entityDisplayName: entity.displayName ?? entity.logicalName,
            attributeCount: fields.length,
            relationshipCount: relationships.length
          });

          await openProfileDocument(renderOperationalProfileMarkdown(profile));
        }
      );
    }
  );

  ext.subscriptions.push(disposable);
}
