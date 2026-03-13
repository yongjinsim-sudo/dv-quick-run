import type { OutputChannel } from "vscode";
import { clearHoverFieldContextCache } from "../providers/hoverFieldContextCache.js";
import { clearNavigationHoverEnrichmentCache } from "../providers/queryHoverProvider.js";
import { clearMetadataSessionCache } from "../commands/router/actions/shared/metadataAccess/metadataSessionCache.js";
import { logInfo } from "../utils/logger.js";

export function clearEnvironmentScopedRuntimeCaches(output?: OutputChannel): void {
  clearMetadataSessionCache();
  clearHoverFieldContextCache();
  clearNavigationHoverEnrichmentCache();

  if (output) {
    logInfo(output, "DV Quick Run: Cleared metadata session caches after environment change.");
  }
}
