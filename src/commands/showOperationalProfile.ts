import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { buildOperationalProfile } from "../product/operationalProfile/operationalProfileEngine.js";
import { buildOperationalContextViewModel } from "../product/operationalContext/operationalContextEngine.js";
import { createDefaultOperationalContextProviders } from "../product/operationalContext/defaultOperationalContextProviders.js";
import {
  loadEntityDefByLogicalName,
  loadEntityDefs,
  loadFields,
  loadNavigationProperties
} from "./router/actions/shared/metadataAccess.js";
import type { EntityDef } from "../utils/entitySetCache.js";
import {
  buildSnapshotRegistryEntry,
  createComparisonEvidenceSnapshot,
  createOperationalComparisonSnapshotDocument,
  registerComparisonSnapshot
} from "../product/comparison/index.js";
import type { ComparisonEvidenceSnapshot } from "../product/comparison/index.js";
import { buildIdentityParticipationSnapshotPayloadFromProfile } from "../product/comparison/comparisonSnapshotExtraction.js";
import { canExportComparison } from "../product/capabilities/capabilityResolver.js";
import { promptForProAccelerationAccess } from "./commercial/proPricingPrompt.js";


async function promptForSnapshotExportProAccess(): Promise<boolean> {
  if (canExportComparison()) {
    return true;
  }

  return await promptForProAccelerationAccess("Export Snapshot");
}

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
  return `dv-quick-run-profile-${safeEntity}-${Date.now()}.dvqrsnapshot.json`;
}

async function writeOperationalProfileSnapshotFile(args: {
  readonly ctx: CommandContext;
  readonly entityLogicalName: string;
  readonly profile: ReturnType<typeof buildOperationalProfile>;
}): Promise<vscode.Uri | undefined> {
  const defaultUri = vscode.Uri.file(toSafeProfileFileName(args.entityLogicalName));
  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: {
      "DVQR comparison snapshots": ["json"]
    },
    saveLabel: "Save Comparison Snapshot",
    title: "Save Operational Profile Comparison Snapshot"
  });

  if (!saveUri) {
    return undefined;
  }

  const activeEnvironment = args.ctx.envContext.getActiveEnvironment();
  const environment = {
    label: activeEnvironment?.name ?? args.ctx.envContext.getEnvironmentName(),
    environmentUrl: activeEnvironment?.url
  };

  const capturedAt = new Date();
  const evidenceSnapshots: ComparisonEvidenceSnapshot[] = [
    createComparisonEvidenceSnapshot({
      environment,
      evidenceType: "OperationalProfile",
      evidence: args.profile,
      capturedAt,
      sourceFeature: "Operational Profile"
    })
  ];

  const identityParticipation = buildIdentityParticipationSnapshotPayloadFromProfile(args.profile);
  if (identityParticipation) {
    evidenceSnapshots.push(createComparisonEvidenceSnapshot({
      environment,
      evidenceType: "IdentityParticipation",
      evidence: identityParticipation,
      capturedAt,
      sourceFeature: "Operational Profile / Operational Context"
    }));
  }

  const jsonSnapshot = createOperationalComparisonSnapshotDocument({
    environment,
    evidenceSnapshots,
    capturedAt,
    sourceFeature: "Operational Profile"
  });

  await vscode.workspace.fs.writeFile(saveUri, new TextEncoder().encode(`${JSON.stringify(jsonSnapshot, null, 2)}\n`));
  await registerComparisonSnapshot(args.ctx.ext, buildSnapshotRegistryEntry({
    document: jsonSnapshot,
    fileUri: saveUri
  }));
  return saveUri;
}

async function exportOperationalProfileSnapshot(
  ctx: CommandContext,
  entityLogicalName?: string
): Promise<void> {
  if (!(await promptForSnapshotExportProAccess())) {
    return;
  }

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

      const file = await writeOperationalProfileSnapshotFile({
        ctx,
        entityLogicalName: entity.logicalName,
        profile
      });

      if (!file) {
        return;
      }

      const action = await vscode.window.showInformationMessage(
        "DV Quick Run: Operational Profile comparison snapshot saved.",
        "Open Snapshot"
      );

      if (action === "Open Snapshot") {
        await vscode.commands.executeCommand("vscode.open", file);
      }
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
      await exportOperationalProfileSnapshot(ctx, entityLogicalName);
    }
  );

  const legacyDisposable = vscode.commands.registerCommand(
    "dvQuickRun.showOperationalProfile",
    async (entityLogicalName?: string) => {
      await exportOperationalProfileSnapshot(ctx, entityLogicalName);
    }
  );

  ext.subscriptions.push(exportDisposable, legacyDisposable);
}
