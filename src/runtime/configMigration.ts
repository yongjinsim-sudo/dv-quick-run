import * as vscode from "vscode";
import { logDebug, logInfo } from "../utils/logger.js";
import {
  buildTraversalConfigMigrationPlan,
  type TraversalConfigInspection
} from "./configMigrationCore.js";

export const CONFIG_SECTIONS_TO_MIGRATE = [
  "productPlan",
  "traversal.allowedTables",
  "traversal.excludedTables",
  "traversal.explainVerbosity"
] as const;

function readConfigInspections(
  config: vscode.WorkspaceConfiguration
): TraversalConfigInspection[] {
  return CONFIG_SECTIONS_TO_MIGRATE.map((section) => {
    const inspection = config.inspect(section);

    return {
      section,
      defaultValue: inspection?.defaultValue,
      globalValue: inspection?.globalValue,
      workspaceValue: inspection?.workspaceValue,
      workspaceFolderValue: inspection?.workspaceFolderValue
    };
  });
}

export async function ensureTraversalSettingsExist(
  output: vscode.OutputChannel
): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("dvQuickRun");
  const inspections = readConfigInspections(config);
  const plan = buildTraversalConfigMigrationPlan(inspections);

  if (!plan.writes.length) {
    logDebug(output, "DV Quick Run: Traversal settings migration not needed.");
    return false;
  }

  let addedTraversalSetting = false;

  for (const write of plan.writes) {
    await config.update(write.section, write.value, vscode.ConfigurationTarget.Global);

    if (write.section !== "productPlan") {
      addedTraversalSetting = true;
      logInfo(output, `DV Quick Run: Added missing setting 'dvQuickRun.${write.section}'.`);
    }
  }

  if (addedTraversalSetting) {
    logInfo(
      output,
      "DV Quick Run: Added missing traversal settings to your configuration for Guided Traversal compatibility."
    );
  }

  return true;
}
