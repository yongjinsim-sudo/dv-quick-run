import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { clearCachedEntityDefs } from "../../../../utils/entitySetCache.js";
import { clearCachedFields } from "../../../../utils/entityFieldCache.js";
import { clearCachedChoiceMetadata } from "../../../../utils/entityChoiceCache.js";
import { clearCachedNavigationProperties } from "../../../../utils/entityRelationshipCache.js";
import { clearMetadataSessionCache } from "../shared/metadataAccess/metadataSessionCache.js";
import { clearRelationshipMetadataMemory } from "../shared/metadataAccess/metadataRelationshipAccess.js";
import { clearHoverFieldContextCache } from "../../../../providers/hoverFieldContextCache.js";
import { clearNavigationHoverEnrichmentCache } from "../../../../providers/queryHoverProvider.js";
import { logInfo } from "../../../../utils/logger.js";
import { clearCachedEntityRelationships } from "../../../../utils/entityRelationshipExplorerCache.js";

export async function runClearPersistedMetadataCacheAction(
  ctx: CommandContext
): Promise<void> {
  const confirmed = await vscode.window.showWarningMessage(
    "DV Quick Run: Clear persisted metadata cache? This will force metadata to be reloaded next time.",
    { modal: true },
    "Clear Cache"
  );

  if (confirmed !== "Clear Cache") {
    return;
  }
  const envName = ctx.envContext.getEnvironmentName();
  await clearCachedEntityDefs(ctx.ext, envName);
  await clearCachedFields(ctx.ext, envName);
  await clearCachedChoiceMetadata(ctx.ext, envName);
  await clearCachedNavigationProperties(ctx.ext, envName);
  await clearCachedEntityRelationships(ctx.ext, envName);

  clearMetadataSessionCache();
  clearRelationshipMetadataMemory();
  clearHoverFieldContextCache();
  clearNavigationHoverEnrichmentCache();

  logInfo(ctx.output, "DV Quick Run: Cleared persisted and session metadata caches.");
  vscode.window.showInformationMessage("DV Quick Run: Persisted metadata cache cleared.");
}