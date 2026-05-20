import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { buildOperationalProfile } from "../product/operationalProfile/operationalProfileEngine.js";
import { renderOperationalProfileMarkdown } from "../product/operationalProfile/operationalProfileMarkdownRenderer.js";
import { buildOperationalContextViewModel } from "../product/operationalContext/operationalContextEngine.js";
import { createDefaultOperationalContextProviders } from "../product/operationalContext/defaultOperationalContextProviders.js";
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

function toSafeProfileFileName(entityLogicalName: string): string {
  const safeEntity = entityLogicalName.replace(/[^a-zA-Z0-9_-]/g, "-") || "entity";
  return `dv-quick-run-profile-${safeEntity}-${Date.now()}.md`;
}

async function openProfilePreviewOnly(
  ext: vscode.ExtensionContext,
  entityLogicalName: string,
  markdown: string
): Promise<void> {
  const directory = vscode.Uri.joinPath(ext.globalStorageUri, "operational-profile-snapshots");
  await vscode.workspace.fs.createDirectory(directory);

  const uri = vscode.Uri.joinPath(directory, toSafeProfileFileName(entityLogicalName));
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(markdown));

  await vscode.commands.executeCommand("markdown.showPreviewToSide", uri);
}

async function exportOperationalProfileSnapshot(
  ext: vscode.ExtensionContext,
  ctx: CommandContext,
  entityLogicalName?: string
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "DV Quick Run: Exporting Operational Profile Snapshot...",
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

      const operationalContext = await buildOperationalContextViewModel({
        subject: {
          type: "entity",
          logicalName: entity.logicalName,
          displayName: entity.displayName ?? entity.logicalName
        },
        providers: createDefaultOperationalContextProviders(),
        dataverse: { client, token }
      });

      const profile = buildOperationalProfile({
        entityLogicalName: entity.logicalName,
        entityDisplayName: entity.displayName ?? entity.logicalName,
        attributeCount: fields.length,
        relationshipCount: relationships.length,
        operationalContext
      });

      await openProfilePreviewOnly(ext, entity.logicalName, renderOperationalProfileMarkdown(profile));
    }
  );
}

export function registerShowOperationalProfileCommand(
  ext: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  const exportDisposable = vscode.commands.registerCommand(
    "dvQuickRun.exportOperationalProfileSnapshot",
    async (entityLogicalName?: string) => {
      await exportOperationalProfileSnapshot(ext, ctx, entityLogicalName);
    }
  );

  const legacyDisposable = vscode.commands.registerCommand(
    "dvQuickRun.showOperationalProfile",
    async (entityLogicalName?: string) => {
      await exportOperationalProfileSnapshot(ext, ctx, entityLogicalName);
    }
  );

  ext.subscriptions.push(exportDisposable, legacyDisposable);
}
