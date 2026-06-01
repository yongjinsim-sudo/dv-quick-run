import * as vscode from "vscode";
import { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } from "../../product/capabilities/capabilityResolver.js";

export async function promptForCrossEnvironmentDiffProAccess(surface: string): Promise<boolean> {
  if (canRunCrossEnvironmentDiff()) {
    return true;
  }

  const message = shouldShowComparisonTeaser()
    ? `${surface} is a DV Quick Run Pro workflow. Free keeps operational understanding available; Pro unlocks saved snapshot comparison, Snapshot Library, and cross-environment drift workflows.`
    : `${surface} is not available for the current DV Quick Run plan.`;

  await vscode.window.showInformationMessage(message, "OK");
  return false;
}
