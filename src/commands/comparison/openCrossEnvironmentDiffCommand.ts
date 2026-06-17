import * as vscode from "vscode";
import { canRunCrossEnvironmentDiff } from "../../product/capabilities/capabilityResolver.js";
import { sampleSnapshots } from "../../product/comparison/snapshotLibrary/mockComparisonSnapshots.js";
import type { CommandContext } from "../context/commandContext.js";
import { registerCommand } from "../registerCommandHelpers.js";
import { createEvidenceWorkspace, openComparisonWorkspaceFolder, openReportWorkspaceFolder, openSnapshotWorkspaceFolder } from "../../product/comparison/index.js";
import { promptForCrossEnvironmentDiffProAccess } from "./comparisonCapabilityPrompt.js";
import { revealComparisonSurface } from "./comparisonSurfaceController.js";
import { buildComparisonViewModelFromSnapshots, readRegisteredSnapshotFiles, readSnapshotFiles } from "./comparisonSnapshotSelection.js";
import { canOpenSnapshotLibrarySurface, revealSnapshotLibrarySurface } from "./snapshotLibraryController.js";

export async function openSnapshotLibrary(ctx: CommandContext): Promise<void> {
  if (!canOpenSnapshotLibrarySurface()) {
    await promptForCrossEnvironmentDiffProAccess("Snapshot Library");
    return;
  }

  revealSnapshotLibrarySurface(ctx, () => openCrossEnvironmentDiff(ctx));
}

export async function openCrossEnvironmentDiff(ctx: CommandContext): Promise<void> {
  if (!(await promptForCrossEnvironmentDiffProAccess("Cross-Environment Diff"))) {
    return;
  }

  const mode = await vscode.window.showQuickPick(
    [
      {
        label: "Compare saved snapshots",
        description: "Pick source and target snapshots from the local DVQR snapshot registry."
      },
      {
        label: "Compare snapshot JSON files",
        description: "Step 1 selects Source, then Step 2 selects Target. Do not multi-select both files together."
      },
      {
        label: "Open sample diff preview",
        description: "Use local sample evidence to verify the Pro comparison surface."
      }
    ],
    {
      title: "Cross-Environment Diff",
      placeHolder: "Choose how to open the comparison workflow"
    }
  );

  if (!mode) {
    return;
  }

  const selection = mode.label === "Open sample diff preview"
    ? { snapshots: sampleSnapshots }
    : mode.label === "Compare saved snapshots"
      ? await readRegisteredSnapshotFiles(ctx.ext)
      : await readSnapshotFiles();

  if (!selection) {
    return;
  }

  const model = await buildComparisonViewModelFromSnapshots(selection);
  if (!model) {
    return;
  }

  revealComparisonSurface(ctx, model);
}

export function registerOpenCrossEnvironmentDiffCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.openSnapshotLibrary", openSnapshotLibrary, ctx);
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.createEvidenceWorkspace", createEvidenceWorkspace));
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.openSnapshotWorkspaceFolder", async () => {
    const resolution = await openSnapshotWorkspaceFolder();
    if (!resolution.available) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Snapshot workspace is unavailable."}`);
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.openComparisonWorkspaceFolder", async () => {
    const resolution = await openComparisonWorkspaceFolder();
    if (!resolution.available) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Comparison workspace is unavailable."}`);
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand("dvQuickRun.openReportWorkspaceFolder", async () => {
    const resolution = await openReportWorkspaceFolder();
    if (!resolution.available) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Report workspace is unavailable."}`);
    }
  }));
}
