import type { OutputChannel } from "vscode";
import { clearHoverFieldContextCache } from "../providers/hoverFieldContextCache.js";
import { clearNavigationHoverEnrichmentCache } from "../providers/queryHoverProvider.js";
import { clearMetadataSessionCache } from "../commands/router/actions/shared/metadataAccess/metadataSessionCache.js";
import { clearRelationshipMetadataMemory } from "../commands/router/actions/shared/metadataAccess/metadataRelationshipAccess.js";
import { TraversalCacheService } from "../commands/router/actions/shared/traversal/traversalCacheService.js";
import { logInfo } from "../utils/logger.js";
import { clearActiveTraversalProgress } from "../commands/router/actions/shared/traversal/traversalProgressStore.js";
import { investigationContextStore } from "../investigation/context/investigationContextStore.js";
import { clearODataOperationRegistryCache } from "../commands/router/actions/shared/metadataAccess.js";
import { closePreviewSurface } from "../services/previewSurfaceService.js";
import { closeCapabilityExplorer } from "../commands/capabilityExplorer/openCapabilityExplorerCommand.js";

export type EnvironmentRuntimeCacheDeps = {
  clearMetadataSessionCache: () => void;
  clearRelationshipMetadataMemory: () => void;
  clearODataOperationRegistryCache: () => void;
  clearHoverFieldContextCache: () => void;
  clearNavigationHoverEnrichmentCache: () => void;
  clearTraversalCache: () => void;
  clearInvestigationContext: () => void;
  closeCapabilitySurfaces: () => void;
  logInfo: (message: string) => void;
};

export function clearEnvironmentScopedRuntimeCachesWithDeps(
  deps: EnvironmentRuntimeCacheDeps,
  output?: OutputChannel
): void {
  deps.clearMetadataSessionCache();
  deps.clearRelationshipMetadataMemory();
  deps.clearODataOperationRegistryCache();
  deps.clearTraversalCache();
  clearActiveTraversalProgress();
  deps.clearInvestigationContext();
  deps.closeCapabilitySurfaces();
  deps.clearHoverFieldContextCache();
  deps.clearNavigationHoverEnrichmentCache();

  if (output) {
    deps.logInfo("DV Quick Run: Cleared metadata, OData operation registry, traversal caches, active traversal state, investigation context, and open capability surfaces after environment change.");
  }
}

export function clearEnvironmentScopedRuntimeCaches(output?: OutputChannel): void {
  clearEnvironmentScopedRuntimeCachesWithDeps(
    {
      clearMetadataSessionCache,
      clearRelationshipMetadataMemory,
      clearODataOperationRegistryCache,
      clearTraversalCache: () => {
        TraversalCacheService.clearAll();
      },
      clearInvestigationContext: () => {
        investigationContextStore.reset();
      },
      closeCapabilitySurfaces: () => {
        closePreviewSurface();
        closeCapabilityExplorer();
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
