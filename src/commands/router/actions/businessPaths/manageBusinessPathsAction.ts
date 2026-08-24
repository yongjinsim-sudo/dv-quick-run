import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import type {
  BusinessPathArtifact,
  BusinessPathRevalidationResult
} from "../../../../core/businessPaths/index.js";
import { BusinessPathRevalidationService } from "../../../../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../../../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { BusinessPathManagementService } from "../../../../runtime/businessPaths/businessPathManagementService.js";
import { GuidedTraversalBusinessPathMetadataProvider } from "../traversal/guidedTraversalBusinessPathMetadataProvider.js";
import { McpRelationshipMetadataRepository } from "../../../../mcp/mcpRelationshipMetadataRepository.js";
import { McpRelationshipProbeService } from "../../../../mcp/mcpRelationshipProbeService.js";
import { McpBusinessPathRuntimeValidationApplicationService } from "../../../../mcp/mcpBusinessPathRuntimeValidationApplicationService.js";
import { McpPreferredBusinessPathRuntimeValidationService } from "../../../../mcp/mcpPreferredBusinessPathRuntimeValidationService.js";
import { getTenantId } from "../../../../utils/authConfig.js";
import {
  buildBusinessPathDetail,
  buildBusinessPathLibraryItem
} from "./businessPathManagementPresentation.js";
import { runAction } from "../shared/actionRunner.js";

type PathAction =
  | "inspect"
  | "rename"
  | "description"
  | "priority"
  | "enable"
  | "disable"
  | "revalidate"
  | "test"
  | "delete";

interface PathQuickPickItem {
  readonly pathId: string;
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  readonly alwaysShow?: boolean;
}

interface ActionQuickPickItem {
  readonly action: PathAction;
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
}

function workspaceRoot(): string | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const active = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
  return active?.uri.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function activeEnvironmentIdentity(ctx: CommandContext): string | undefined {
  const active = ctx.envContext.getActiveEnvironment();
  if (active?.url?.trim()) {
    try {
      return new URL(active.url).hostname.toLowerCase();
    } catch {
      return active.url.trim().toLowerCase();
    }
  }
  return active?.name?.trim().toLowerCase();
}

async function pickPath(
  repository: WorkspaceBusinessPathRepository
): Promise<BusinessPathArtifact | undefined> {
  const inspection = repository.inspect();
  if (!inspection.artifacts.length) {
    await vscode.window.showInformationMessage(
      "DV Quick Run: No saved Business Paths exist in this workspace yet."
    );
    return undefined;
  }

  if (inspection.diagnostics.length) {
    void vscode.window.showWarningMessage(
      `DV Quick Run: ${inspection.diagnostics.length} Business Path artifact issue${inspection.diagnostics.length === 1 ? "" : "s"} detected. Valid paths remain available.`
    );
  }

  const items: PathQuickPickItem[] = inspection.artifacts.map((artifact) => {
    const model = buildBusinessPathLibraryItem(artifact);
    return {
      pathId: model.id,
      label: model.label,
      description: model.description,
      detail: model.detail,
      alwaysShow: true
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    title: "DV Quick Run: Manage Business Paths",
    placeHolder: "Select a saved Business Path"
  });
  return selected ? repository.findById(selected.pathId) : undefined;
}

async function pickAction(artifact: BusinessPathArtifact): Promise<PathAction | undefined> {
  const stateAction: ActionQuickPickItem = artifact.state === "preferred"
    ? { action: "disable", label: "$(circle-slash) Disable", description: "Keep the artifact but stop using it as active workspace guidance" }
    : { action: "enable", label: "$(star-full) Enable as Preferred", description: "Promote this saved path to BusinessPreferred guidance" };

  const items: ActionQuickPickItem[] = [
    { action: "inspect", label: "$(eye) View details" },
    { action: "revalidate", label: "$(refresh) Revalidate metadata", description: "Check exact saved relationships against the active environment" },
    { action: "test", label: "$(beaker) Test with source record", description: "Use existing bounded runtime path validation" },
    { action: "rename", label: "$(edit) Rename" },
    { action: "description", label: "$(note) Edit description" },
    { action: "priority", label: "$(list-ordered) Set priority", description: "Lower number appears before higher numbers" },
    stateAction,
    { action: "delete", label: "$(trash) Delete", description: "Remove workspace preference; historical investigation evidence is unaffected" }
  ];

  return (await vscode.window.showQuickPick(items, {
    title: artifact.name,
    placeHolder: "Choose a Business Path action"
  }))?.action;
}

async function revalidatePath(
  ctx: CommandContext,
  artifact: BusinessPathArtifact
): Promise<BusinessPathRevalidationResult> {
  const service = new BusinessPathRevalidationService(
    new GuidedTraversalBusinessPathMetadataProvider(ctx)
  );
  return await service.revalidate(artifact, activeEnvironmentIdentity(ctx));
}

async function showDetails(
  ctx: CommandContext,
  artifact: BusinessPathArtifact
): Promise<void> {
  const validation = await revalidatePath(ctx, artifact);
  const detail = buildBusinessPathDetail(artifact, validation);
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: [
      `# ${detail.title}`,
      "",
      ...detail.lines.map((line) => line.startsWith("  ") ? line : `${line}`),
      "",
      "> Saved preference is workspace guidance. Current metadata validation and runtime evidence remain separate."
    ].join("\n")
  });
  await vscode.window.showTextDocument(document, { preview: true });
}

async function testPath(
  ctx: CommandContext,
  artifact: BusinessPathArtifact
): Promise<void> {
  if (artifact.state !== "preferred") {
    await vscode.window.showInformationMessage(
      "DV Quick Run: Enable this Business Path as Preferred before runtime-testing it through the managed-path flow."
    );
    return;
  }

  const validation = await revalidatePath(ctx, artifact);
  if (validation.state !== "valid") {
    await vscode.window.showWarningMessage(
      validation.state === "stale"
        ? "DV Quick Run: This Preferred Business Path is stale and cannot be runtime-tested until its saved relationships are updated."
        : "DV Quick Run: Metadata revalidation is unavailable, so the saved path will not be runtime-tested."
    );
    return;
  }

  const sourceRecordId = await vscode.window.showInputBox({
    title: `Test ${artifact.name}`,
    prompt: `Enter a ${artifact.sourceTable} record ID`,
    placeHolder: "00000000-0000-0000-0000-000000000000",
    ignoreFocusOut: true
  });
  if (!sourceRecordId?.trim()) {
    return;
  }

  const baseUrl = await ctx.getBaseUrl();
  const config = {
    environmentUrl: baseUrl,
    tenantId: getTenantId(),
    proEnabled: true,
    requestTimeoutMs: 30_000,
    emitTextMirror: false,
    textMirrorMaxCharacters: 32_768
  };
  const metadata = new McpRelationshipMetadataRepository(config);
  const probes = new McpRelationshipProbeService(config, metadata);
  const validator = new McpBusinessPathRuntimeValidationApplicationService(metadata, probes);
  const reuse = new McpPreferredBusinessPathRuntimeValidationService(validator);

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DV Quick Run: Testing Preferred Business Path`,
      cancellable: false
    },
    async () => await reuse.validatePreferredPath({
      artifact,
      revalidation: validation,
      sourceRecordId: sourceRecordId.trim(),
      runtimeArguments: { environmentUrl: baseUrl },
      maxCandidates: 5,
      maxRecordsPerStep: 3,
      maxProbeRequests: 16,
      maxDepth: Math.max(2, artifact.hops.length)
    })
  );

  if (!result.ok) {
    await vscode.window.showWarningMessage(`DV Quick Run: ${result.message}`);
    return;
  }

  ctx.output.appendLine(`[Managed Business Path] ${result.summary}`);
  ctx.output.show(true);
  await vscode.window.showInformationMessage(`DV Quick Run: ${result.summary}`);
}

async function applyAction(
  ctx: CommandContext,
  manager: BusinessPathManagementService,
  artifact: BusinessPathArtifact,
  action: PathAction
): Promise<void> {
  switch (action) {
    case "inspect":
      await showDetails(ctx, artifact);
      return;
    case "rename": {
      const name = await vscode.window.showInputBox({
        title: "Rename Business Path",
        value: artifact.name,
        prompt: "Business Path name"
      });
      if (name === undefined) return;
      manager.update(artifact.id, { name });
      return;
    }
    case "description": {
      const description = await vscode.window.showInputBox({
        title: "Edit Business Path Description",
        value: artifact.description ?? "",
        prompt: "Leave empty to clear the description"
      });
      if (description === undefined) return;
      manager.update(artifact.id, { description: description.trim() ? description : null });
      return;
    }
    case "priority": {
      const value = await vscode.window.showInputBox({
        title: "Set Business Path Priority",
        value: artifact.priority !== undefined ? String(artifact.priority) : "",
        prompt: "Non-negative integer. Leave empty to use default ordering.",
        validateInput: (input: string) => {
          if (!input.trim()) return undefined;
          const parsed = Number(input);
          return Number.isInteger(parsed) && parsed >= 0
            ? undefined
            : "Priority must be a non-negative integer.";
        }
      });
      if (value === undefined) return;
      manager.update(artifact.id, { priority: value.trim() ? Number(value) : null });
      return;
    }
    case "enable":
      manager.setEnabled(artifact.id, true);
      await vscode.window.showInformationMessage(`DV Quick Run: ${artifact.name} is now a Preferred Business Path.`);
      return;
    case "disable":
      manager.setEnabled(artifact.id, false);
      await vscode.window.showInformationMessage(`DV Quick Run: ${artifact.name} is disabled and will no longer be pinned in Guided Traversal.`);
      return;
    case "revalidate": {
      const validation = await revalidatePath(ctx, artifact);
      const issue = validation.issues[0]?.message;
      await vscode.window.showInformationMessage(
        `DV Quick Run: ${artifact.name} metadata is ${validation.state}.${issue ? ` ${issue}` : ""}`
      );
      return;
    }
    case "test":
      await testPath(ctx, artifact);
      return;
    case "delete": {
      const answer = await vscode.window.showWarningMessage(
        `Delete Business Path "${artifact.name}"? This removes workspace preference only.`,
        { modal: true },
        "Delete"
      );
      if (answer === "Delete") {
        manager.delete(artifact.id);
      }
      return;
    }
  }
}

export async function runManageBusinessPathsAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Manage Business Paths failed. Check Output.", async () => {
    const root = workspaceRoot();
    if (!root) {
      await vscode.window.showInformationMessage(
        "DV Quick Run: Open a workspace folder to manage Business Paths."
      );
      return;
    }

    const repository = new WorkspaceBusinessPathRepository(root);
    const manager = new BusinessPathManagementService(repository);
    const artifact = await pickPath(repository);
    if (!artifact) {
      return;
    }

    const action = await pickAction(artifact);
    if (!action) {
      return;
    }

    await applyAction(ctx, manager, artifact, action);
  });
}
