import * as vscode from "vscode";
import { logDebug, logInfo } from "../utils/logger.js";
import {
  buildConfigMigrationPlan,
  type ConfigInspection
} from "./configMigrationCore.js";

export const CONFIG_SECTIONS_TO_MIGRATE = [
  "productPlan",
  "traversal.allowedTables",
  "traversal.excludedTables",
  "traversal.explainVerbosity",
  "investigate.searchScopeTables",
  "investigate.maxSearchTables",
  "investigate.maxSearchColumns"
] as const;

function readConfigInspections(
  config: vscode.WorkspaceConfiguration
): ConfigInspection[] {
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

export async function ensureDvQuickRunSettingsExist(
  output: vscode.OutputChannel
): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("dvQuickRun");
  const inspections = readConfigInspections(config);
  const plan = buildConfigMigrationPlan(inspections);

  if (!plan.writes.length) {
    logDebug(output, "DV Quick Run: Settings migration not needed.");
    return false;
  }

  let addedFeatureSetting = false;

  for (const write of plan.writes) {
    await config.update(write.section, write.value, vscode.ConfigurationTarget.Global);

    if (write.section !== "productPlan") {
      addedFeatureSetting = true;
      logInfo(output, `DV Quick Run: Added missing setting 'dvQuickRun.${write.section}'.`);
    }
  }

  if (addedFeatureSetting) {
    logInfo(
      output,
      "DV Quick Run: Added missing DV Quick Run settings to your configuration for feature compatibility."
    );
  }

  return true;
}
