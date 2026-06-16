import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { buildOperationalProfile } from "../product/operationalProfile/operationalProfileEngine.js";
import { buildOperationalContextViewModel } from "../product/operationalContext/operationalContextEngine.js";
import { createDefaultOperationalContextProviders } from "../product/operationalContext/defaultOperationalContextProviders.js";
import {
  loadChoiceMetadata,
  loadEntityDefByLogicalName,
  loadEntityDefs,
  loadEntityRelationships,
  loadFields
} from "./router/actions/shared/metadataAccess.js";
import type { EntityDef } from "../utils/entitySetCache.js";
import {
  buildSnapshotRegistryEntry,
  createComparisonEvidenceSnapshot,
  createOperationalComparisonSnapshotDocument,
  registerComparisonSnapshot
} from "../product/comparison/index.js";
import type { ComparisonEvidenceSnapshot } from "../product/comparison/index.js";
import type { SnapshotEntityConfigurationMetadata } from "../product/comparison/comparisonSnapshotTypes.js";
import { buildIdentityParticipationSnapshotPayloadFromProfile } from "../product/comparison/comparisonSnapshotExtraction.js";
import { buildEntityMetadataSnapshotPayload } from "../product/comparison/comparisonSnapshotMetadataPayload.js";
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


function normalizeEntityConfigString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function normalizeEntityConfigBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value && typeof value === "object" && "Value" in value) {
    const wrapped = (value as { readonly Value?: unknown }).Value;
    return typeof wrapped === "boolean" ? wrapped : undefined;
  }
  return undefined;
}

async function loadEntityConfigurationSnapshot(
  ctx: CommandContext,
  logicalName: string,
  token: string
): Promise<SnapshotEntityConfigurationMetadata | undefined> {
  const safeLogicalName = logicalName.replace(/'/g, "''");
  const client = ctx.getClient();
  const selectAttempts = [
    [
      "EntitySetName",
      "OwnershipType",
      "IsAuditEnabled",
      "ChangeTrackingEnabled",
      "IsActivity",
      "IsCustomEntity",
      "IsManaged",
      "IsValidForAdvancedFind"
    ],
    [
      "EntitySetName",
      "OwnershipType",
      "IsAuditEnabled",
      "IsActivity",
      "IsCustomEntity",
      "IsManaged",
      "IsValidForAdvancedFind"
    ]
  ];

  for (const selectFields of selectAttempts) {
    try {
      const row = await client.get(
        `/EntityDefinitions(LogicalName='${safeLogicalName}')?$select=${selectFields.join(",")}`,
        token
      );
      const rowData = row as Record<string, unknown>;

      return {
        entitySetName: normalizeEntityConfigString(rowData.EntitySetName),
        ownershipType: normalizeEntityConfigString(rowData.OwnershipType),
        isAuditEnabled: normalizeEntityConfigBoolean(rowData.IsAuditEnabled),
        changeTrackingEnabled: normalizeEntityConfigBoolean(rowData.ChangeTrackingEnabled),
        isActivity: normalizeEntityConfigBoolean(rowData.IsActivity),
        isCustomEntity: normalizeEntityConfigBoolean(rowData.IsCustomEntity),
        isManaged: normalizeEntityConfigBoolean(rowData.IsManaged),
        isValidForAdvancedFind: normalizeEntityConfigBoolean(rowData.IsValidForAdvancedFind)
      };
    } catch {
      // Try a smaller EntityDefinitions projection for older/limited metadata surfaces.
    }
  }

  return undefined;
}

async function writeOperationalProfileSnapshotFile(args: {
  readonly ctx: CommandContext;
  readonly entityLogicalName: string;
  readonly profile: ReturnType<typeof buildOperationalProfile>;
  readonly entityMetadata?: ReturnType<typeof buildEntityMetadataSnapshotPayload>;
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

  if (args.entityMetadata) {
    evidenceSnapshots.push(createComparisonEvidenceSnapshot({
      environment,
      evidenceType: "EntityMetadata",
      evidence: args.entityMetadata,
      capturedAt,
      sourceFeature: "Operational Profile / Metadata"
    }));
  }

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

      const [fields, choices, relationships, entityConfiguration] = await Promise.all([
        loadFields(ctx, client, token, entity.logicalName, { silent: true }).catch(() => []),
        loadChoiceMetadata(ctx, client, token, entity.logicalName, { silent: true }).catch(() => []),
        loadEntityRelationships(ctx, client, token, entity.logicalName, { silent: true }).catch(() => undefined),
        loadEntityConfigurationSnapshot(ctx, entity.logicalName, token).catch(() => undefined)
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
        relationshipCount: (relationships?.manyToOne.length ?? 0) + (relationships?.oneToMany.length ?? 0) + (relationships?.manyToMany.length ?? 0),
        operationalContext
      });

      const entityMetadata = buildEntityMetadataSnapshotPayload({
        entityLogicalName: entity.logicalName,
        entityDisplayName: entity.displayName ?? entity.logicalName,
        fields,
        choices,
        relationships,
        configuration: entityConfiguration
      });

      const file = await writeOperationalProfileSnapshotFile({
        ctx,
        entityLogicalName: entity.logicalName,
        profile,
        entityMetadata
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
