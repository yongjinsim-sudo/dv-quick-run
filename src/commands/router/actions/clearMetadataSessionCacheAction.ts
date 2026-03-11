import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { clearMetadataSessionCache } from "./shared/metadataLoadCache.js";
import { clearHoverFieldContextCache } from "../../../providers/hoverFieldContextCache.js";
import { clearNavigationHoverEnrichmentCache } from "../../../providers/queryHoverProvider.js";
import { logInfo } from "../../../utils/logger.js";

export async function runClearMetadataSessionCacheAction(
  ctx: CommandContext
): Promise<void> {
  clearMetadataSessionCache();
  clearHoverFieldContextCache();
  clearNavigationHoverEnrichmentCache();

  logInfo(ctx.output, "DV Quick Run: Cleared metadata session caches.");
  vscode.window.showInformationMessage("DV Quick Run: Metadata session caches cleared.");
}