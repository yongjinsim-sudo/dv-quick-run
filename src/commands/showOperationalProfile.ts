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
  buildSnapshotFileName,
  buildSnapshotWorkspaceFileUri,
  ensureSnapshotWorkspace,
  ensureSnapshotWorkspaceFileParent,
  buildSnapshotRegistryEntry,
  createComparisonEvidenceSnapshot,
  createOperationalComparisonSnapshotDocument,
  registerComparisonSnapshot
} from "../product/comparison/index.js";
import type { ComparisonEvidenceSnapshot, OperationalComparisonSnapshotDocument } from "../product/comparison/index.js";
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

async function pickSnapshotCaptureEnvironment(ctx: CommandContext): Promise<import("../services/environmentContext.js").EnvironmentProfile | undefined> {
  const environments = ctx.envContext.getConfiguredEnvironments();

  if (!environments.length) {
    void vscode.window.showWarningMessage("DV Quick Run: No Dataverse environments are configured. Add an environment before capturing a workspace snapshot.");
    return undefined;
  }

  if (environments.length === 1) {
    return environments[0];
  }

  const picked = await vscode.window.showQuickPick(
    environments.map((env) => ({
      label: env.name,
      description: env.url,
      detail: ctx.envContext.getActiveEnvironment()?.name === env.name ? "Current active environment" : undefined,
      environment: env
    })),
    {
      title: "DV Quick Run: Select snapshot environment",
      placeHolder: "Choose the Dataverse environment to capture from",
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  return picked?.environment;
}

async function promptForSnapshotCaptureLabel(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: "DV Quick Run: Snapshot label",
    prompt: "Optional label for this workspace snapshot.",
    placeHolder: "before-release, after-deploy, baseline",
    ignoreFocusOut: true
  });

  if (value === undefined) {
    return undefined;
  }

  return value.trim();
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

function buildOperationalProfileSnapshotDocument(args: {
  readonly ctx: CommandContext;
  readonly entityLogicalName: string;
  readonly profile: ReturnType<typeof buildOperationalProfile>;
  readonly entityMetadata?: ReturnType<typeof buildEntityMetadataSnapshotPayload>;
  readonly capturedAt: Date;
}): OperationalComparisonSnapshotDocument {
  const activeEnvironment = args.ctx.envContext.getActiveEnvironment();
  const environment = {
    label: activeEnvironment?.name ?? args.ctx.envContext.getEnvironmentName(),
    environmentUrl: activeEnvironment?.url
  };

  const evidenceSnapshots: ComparisonEvidenceSnapshot[] = [
    createComparisonEvidenceSnapshot({
      environment,
      evidenceType: "OperationalProfile",
      evidence: args.profile,
      capturedAt: args.capturedAt,
      sourceFeature: "Operational Profile"
    })
  ];

  if (args.entityMetadata) {
    evidenceSnapshots.push(createComparisonEvidenceSnapshot({
      environment,
      evidenceType: "EntityMetadata",
      evidence: args.entityMetadata,
      capturedAt: args.capturedAt,
      sourceFeature: "Operational Profile / Metadata"
    }));
  }

  const identityParticipation = buildIdentityParticipationSnapshotPayloadFromProfile(args.profile);
  if (identityParticipation) {
    evidenceSnapshots.push(createComparisonEvidenceSnapshot({
      environment,
      evidenceType: "IdentityParticipation",
      evidence: identityParticipation,
      capturedAt: args.capturedAt,
      sourceFeature: "Operational Profile / Operational Context"
    }));
  }

  return createOperationalComparisonSnapshotDocument({
    environment,
    evidenceSnapshots,
    capturedAt: args.capturedAt,
    sourceFeature: "Operational Profile",
    entityLogicalName: args.entityLogicalName,
    entityDisplayName: args.profile.entityDisplayName
  });
}

async function writeSnapshotDocument(args: {
  readonly ctx: CommandContext;
  readonly document: OperationalComparisonSnapshotDocument;
  readonly fileUri: vscode.Uri;
}): Promise<vscode.Uri> {
  await ensureSnapshotWorkspaceFileParent(args.fileUri);
  await vscode.workspace.fs.writeFile(args.fileUri, new TextEncoder().encode(`${JSON.stringify(args.document, null, 2)}\n`));
  await registerComparisonSnapshot(args.ctx.ext, buildSnapshotRegistryEntry({
    document: args.document,
    fileUri: args.fileUri
  }));
  return args.fileUri;
}

async function chooseManualSnapshotSaveUri(args: {
  readonly ctx: CommandContext;
  readonly document: OperationalComparisonSnapshotDocument;
  readonly entityLogicalName: string;
}): Promise<vscode.Uri | undefined> {
  const capturedAt = new Date(args.document.capturedAtIso);
  const activeEnvironment = args.ctx.envContext.getActiveEnvironment();
  const environmentLabel = args.document.snapshotIdentity?.environmentLabel
    ?? activeEnvironment?.name
    ?? args.ctx.envContext.getEnvironmentName();
  const workspace = await ensureSnapshotWorkspace();
  const defaultUri = workspace.available && workspace.snapshotsRoot
    ? buildSnapshotWorkspaceFileUri({
      snapshotsRoot: workspace.snapshotsRoot,
      entityLogicalName: args.entityLogicalName,
      environmentLabel,
      capturedAt,
      label: args.entityLogicalName
    })
    : vscode.Uri.file(buildSnapshotFileName({ capturedAt, label: args.entityLogicalName }));

  if (workspace.available) {
    await ensureSnapshotWorkspaceFileParent(defaultUri);
  }

  return await vscode.window.showSaveDialog({
    defaultUri,
    filters: {
      "DVQR comparison snapshots": ["json"]
    },
    saveLabel: "Save Comparison Snapshot",
    title: "Save Operational Profile Comparison Snapshot"
  });
}

async function writeOperationalProfileSnapshotFile(args: {
  readonly ctx: CommandContext;
  readonly entityLogicalName: string;
  readonly profile: ReturnType<typeof buildOperationalProfile>;
  readonly entityMetadata?: ReturnType<typeof buildEntityMetadataSnapshotPayload>;
  readonly mode: "manualExport" | "workspaceCapture";
  readonly label?: string;
}): Promise<vscode.Uri | undefined> {
  const capturedAt = new Date();
  const document = buildOperationalProfileSnapshotDocument({
    ctx: args.ctx,
    entityLogicalName: args.entityLogicalName,
    profile: args.profile,
    entityMetadata: args.entityMetadata,
    capturedAt
  });

  if (args.mode === "workspaceCapture") {
    const workspace = await ensureSnapshotWorkspace();
    if (!workspace.available || !workspace.snapshotsRoot) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${workspace.reason ?? "Open a VS Code workspace folder to use workspace-backed DVQR snapshots."}`);
      return undefined;
    }

    const fileUri = buildSnapshotWorkspaceFileUri({
      snapshotsRoot: workspace.snapshotsRoot,
      entityLogicalName: args.entityLogicalName,
      environmentLabel: document.snapshotIdentity?.environmentLabel ?? document.environment.label,
      capturedAt,
      label: args.label
    });
    return await writeSnapshotDocument({ ctx: args.ctx, document, fileUri });
  }

  const saveUri = await chooseManualSnapshotSaveUri({
    ctx: args.ctx,
    document,
    entityLogicalName: args.entityLogicalName
  });

  if (!saveUri) {
    return undefined;
  }

  return await writeSnapshotDocument({ ctx: args.ctx, document, fileUri: saveUri });
}

async function exportOperationalProfileSnapshot(
  ctx: CommandContext,
  entityLogicalName: string | undefined,
  mode: "manualExport" | "workspaceCapture" = "manualExport",
  label?: string
): Promise<void> {
  if (!(await promptForSnapshotExportProAccess())) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: mode === "workspaceCapture" ? "DV Quick Run: Capturing snapshot with fresh metadata..." : "DV Quick Run: Exporting Operational Profile Snapshot...",
      cancellable: false
    },
    async () => {
      const token = await ctx.getToken(ctx.getScope());
      const client = ctx.getClient();
      const entity = await resolveEntity(ctx, entityLogicalName, token);

      if (!entity) {
        return;
      }

      const metadataLoadOptions = { silent: true, forceRefresh: true } as const;
      const [fields, choices, relationships, entityConfiguration] = await Promise.all([
        loadFields(ctx, client, token, entity.logicalName, metadataLoadOptions).catch(() => []),
        loadChoiceMetadata(ctx, client, token, entity.logicalName, metadataLoadOptions).catch(() => []),
        loadEntityRelationships(ctx, client, token, entity.logicalName, metadataLoadOptions).catch(() => undefined),
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
        entityMetadata,
        mode,
        label
      });

      if (!file) {
        return;
      }

      const action = await vscode.window.showInformationMessage(
        mode === "workspaceCapture"
          ? "DV Quick Run: Snapshot captured to the workspace."
          : "DV Quick Run: Operational Profile comparison snapshot saved.",
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
      await exportOperationalProfileSnapshot(ctx, entityLogicalName, "manualExport");
    }
  );

  const captureDisposable = vscode.commands.registerCommand(
    "dvQuickRun.captureOperationalProfileSnapshot",
    async () => {
      if (!(await promptForSnapshotExportProAccess())) {
        return;
      }

      const workspace = await ensureSnapshotWorkspace();
      if (!workspace.available || !workspace.snapshotsRoot) {
        void vscode.window.showWarningMessage(`DV Quick Run: ${workspace.reason ?? "Open a VS Code workspace folder to use workspace-backed DVQR snapshots."}`);
        return;
      }

      const selectedEnvironment = await pickSnapshotCaptureEnvironment(ctx);
      if (!selectedEnvironment) {
        return;
      }

      const label = await promptForSnapshotCaptureLabel();
      if (label === undefined) {
        return;
      }

      const previousEnvironment = ctx.envContext.getActiveEnvironment();
      const changedEnvironment = !previousEnvironment
        || previousEnvironment.name !== selectedEnvironment.name
        || previousEnvironment.url !== selectedEnvironment.url;

      if (changedEnvironment) {
        await ctx.envContext.setActiveEnvironment(selectedEnvironment);
      }

      try {
        await exportOperationalProfileSnapshot(ctx, undefined, "workspaceCapture", label || undefined);
      } finally {
        if (changedEnvironment && previousEnvironment) {
          await ctx.envContext.setActiveEnvironment(previousEnvironment);
        }
      }
    }
  );

  const legacyDisposable = vscode.commands.registerCommand(
    "dvQuickRun.showOperationalProfile",
    async (entityLogicalName?: string) => {
      await exportOperationalProfileSnapshot(ctx, entityLogicalName, "manualExport");
    }
  );

  ext.subscriptions.push(exportDisposable, captureDisposable, legacyDisposable);
}
