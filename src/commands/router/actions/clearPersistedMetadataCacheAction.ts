import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { clearCachedEntityDefs } from "../../../utils/entitySetCache.js";
import { clearCachedFields } from "../../../utils/entityFieldCache.js";
import { clearCachedChoiceMetadata } from "../../../utils/entityChoiceCache.js";
import { clearCachedNavigationProperties } from "../../../utils/entityRelationshipCache.js";
import { clearMetadataSessionCache } from "./shared/metadataLoadCache.js";
import { clearHoverFieldContextCache } from "../../../providers/hoverFieldContextCache.js";
import { clearNavigationHoverEnrichmentCache } from "../../../providers/queryHoverProvider.js";
import { logInfo } from "../../../utils/logger.js";

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

  await clearCachedEntityDefs(ctx.ext);
  await clearCachedFields(ctx.ext);
  await clearCachedChoiceMetadata(ctx.ext);
  await clearCachedNavigationProperties(ctx.ext);

  clearMetadataSessionCache();
  clearHoverFieldContextCache();
  clearNavigationHoverEnrichmentCache();

  logInfo(ctx.output, "DV Quick Run: Cleared persisted and session metadata caches.");
  vscode.window.showInformationMessage("DV Quick Run: Persisted metadata cache cleared.");
}