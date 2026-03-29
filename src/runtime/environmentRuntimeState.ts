import type { OutputChannel } from "vscode";
import { clearHoverFieldContextCache } from "../providers/hoverFieldContextCache.js";
import { clearNavigationHoverEnrichmentCache } from "../providers/queryHoverProvider.js";
import { clearMetadataSessionCache } from "../commands/router/actions/shared/metadataAccess/metadataSessionCache.js";
import { clearRelationshipMetadataMemory } from "../commands/router/actions/shared/metadataAccess/metadataRelationshipAccess.js";
import { TraversalCacheService  } from "../commands/router/actions/shared/traversal/traversalCacheService.js";
import { logInfo } from "../utils/logger.js";
import { clearActiveTraversalProgress } from "../commands/router/actions/shared/traversal/traversalProgressStore.js";

export type EnvironmentRuntimeCacheDeps = {
  clearMetadataSessionCache: () => void;
  clearRelationshipMetadataMemory: () => void;
  clearHoverFieldContextCache: () => void;
  clearNavigationHoverEnrichmentCache: () => void;
  clearTraversalCache: () => void;
  logInfo: (message: string) => void;
};

export function clearEnvironmentScopedRuntimeCachesWithDeps(
  deps: EnvironmentRuntimeCacheDeps,
  output?: OutputChannel
): void {
  deps.clearMetadataSessionCache();
  deps.clearRelationshipMetadataMemory();
  deps.clearTraversalCache();
  clearActiveTraversalProgress();
  deps.clearHoverFieldContextCache();
  deps.clearNavigationHoverEnrichmentCache();

  if (output) {
        deps.logInfo("DV Quick Run: Cleared metadata, traversal caches, and active traversal state after environment change.");
  }
}

export function clearEnvironmentScopedRuntimeCaches(output?: OutputChannel): void {
  clearEnvironmentScopedRuntimeCachesWithDeps(
    {
      clearMetadataSessionCache,
      clearRelationshipMetadataMemory,
      clearTraversalCache: () => {
        TraversalCacheService.clearAll();
      },
      clearHoverFieldContextCache,
      clearNavigationHoverEnrichmentCache,
      logInfo: (message: string) => {
        if (output) {
          logInfo(output, message);
        }
      }
    },
    output
  );
}
