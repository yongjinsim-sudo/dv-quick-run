import * as vscode from "vscode";
import type { IdentifierResolutionResult } from "./identifierResolutionTypes.js";

export async function reportIdentifierResolutionOutcome(
  result: IdentifierResolutionResult
): Promise<void> {
  switch (result.outcome) {
    case "missingAllowedTables": {
      const choice = await vscode.window.showWarningMessage(
        "DV Quick Run: Identifier resolution needs dvQuickRun.investigate.searchScopeTables to be configured for bounded search.",
        "Open Settings (JSON)"
      );

      if (choice === "Open Settings (JSON)") {
        await vscode.commands.executeCommand("workbench.action.openSettingsJson");
      }
      return;
    }

    case "unresolved": {
      const searched = result.searchedEntityLogicalNames?.length
        ? ` Searched: ${result.searchedEntityLogicalNames.join(", ")}.`
        : "";

      void vscode.window.showWarningMessage(
        `DV Quick Run: Identifier could not be resolved within the current search scope.${searched}`
      );
      return;
    }

    case "multipleMatches":
    case "resolved":
      return;
  }
}
