import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import type { BusinessPathHop } from "../../../../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../../../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { SaveOrVerifyBusinessPathService } from "../../../../runtime/businessPaths/saveOrVerifyBusinessPathService.js";
import type { ActiveTraversalProgress } from "../shared/traversal/traversalTypes.js";

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function exactHops(progress: ActiveTraversalProgress): readonly BusinessPathHop[] {
  return progress.route.edges.map((edge, index) => {
    if (!edge.schemaName?.trim()) {
      throw new Error(`Completed traversal hop ${index + 1} has no stable relationship schema name.`);
    }
    return {
      ordinal: index + 1,
      fromTable: edge.fromEntity,
      toTable: edge.toEntity,
      relationshipSchemaName: edge.schemaName,
      relationshipType: edge.relationshipType,
      direction: "forward",
      navigationProperty: edge.navigationPropertyName,
      ...(edge.referencingAttribute ? { lookupAttribute: edge.referencingAttribute } : {})
    };
  });
}

export async function offerCompletedTraversalBusinessPathCapture(
  ctx: CommandContext,
  progress: ActiveTraversalProgress
): Promise<void> {
  if (!progress.isCompleted || !progress.lastLanding?.ids.length) return;

  const choice = await vscode.window.showInformationMessage(
    `Guided Traversal reached ${progress.route.targetEntity}. Save or verify this exact route as a workspace Business Path?`,
    "Save / Reverify Business Path",
    "Not Now"
  );
  if (choice !== "Save / Reverify Business Path") return;

  const root = workspaceRoot();
  if (!root) {
    await vscode.window.showWarningMessage("DV Quick Run: Open a workspace before saving a Business Path.");
    return;
  }

  const active = ctx.envContext.getActiveEnvironment();
  const environmentId = active?.url?.trim() || active?.name?.trim();
  if (!environmentId) {
    await vscode.window.showWarningMessage("DV Quick Run: An active environment is required to verify this Business Path.");
    return;
  }

  try {
    const result = new SaveOrVerifyBusinessPathService(
      new WorkspaceBusinessPathRepository(root)
    ).execute({
      environmentId,
      sourceTable: progress.route.sourceEntity,
      targetTable: progress.route.targetEntity,
      hops: exactHops(progress),
      traversalResultId: progress.sessionId,
      observedTargetRows: progress.lastLanding.ids.length,
      userRequestedAction: "saveOrVerify"
    });

    await vscode.window.showInformationMessage(
      result.outcome === "Created"
        ? `Saved Business Path [${result.artifact.id}]. It is saved guidance, not BusinessPreferred until you explicitly promote it.`
        : `Verified Business Path [${result.artifact.id}]. Existing preference/governance state was preserved.`
    );
  } catch (error) {
    await vscode.window.showErrorMessage(
      `DV Quick Run: Business Path capture failed. ${error instanceof Error ? error.message : "Unknown error."}`
    );
  }
}
