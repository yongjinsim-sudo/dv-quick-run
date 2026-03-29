import type { CommandContext } from "../../../../context/commandContext.js";
import type { TraversalRoute } from "./traversalTypes.js";

export interface TraversalHistoryEntry {
  environmentKey: string;
  sourceEntity: string;
  targetEntity: string;
  routeId: string;
  pathSignature: string;
  successCount: number;
  lastSucceededAt: number;
}

const traversalHistoryStore = new Map<string, TraversalHistoryEntry>();

export function buildTraversalEnvironmentKey(ctx: CommandContext): string {
  const activeEnvironment = ctx.envContext.getActiveEnvironment();

  return (
    activeEnvironment?.url?.trim().toLowerCase() ||
    activeEnvironment?.name?.trim().toLowerCase() ||
    "default"
  );
}

export function buildTraversalPathSignature(route: TraversalRoute): string {
  return route.edges
    .map((edge) => {
      const fromEntity = edge.fromEntity?.trim().toLowerCase() || "";
      const relationship = edge.schemaName?.trim().toLowerCase() || "";
      const toEntity = edge.toEntity?.trim().toLowerCase() || "";

      return `${fromEntity}:${relationship}:${toEntity}`;
    })
    .join(" | ");
}

function buildHistoryKey(
  environmentKey: string,
  sourceEntity: string,
  targetEntity: string,
  routeId: string,
  pathSignature: string
): string {
  return `${environmentKey}::${sourceEntity}::${targetEntity}::${routeId}::${pathSignature}`;
}

export function recordSuccessfulTraversalRoute(
  ctx: CommandContext,
  route: TraversalRoute
): void {
  const environmentKey = buildTraversalEnvironmentKey(ctx);
  const pathSignature = buildTraversalPathSignature(route);
  const key = buildHistoryKey(
    environmentKey,
    route.sourceEntity,
    route.targetEntity,
    route.routeId,
    pathSignature
  );

  const existing = traversalHistoryStore.get(key);

  if (existing) {
    traversalHistoryStore.set(key, {
      ...existing,
      successCount: existing.successCount + 1,
      lastSucceededAt: Date.now()
    });
    return;
  }

  traversalHistoryStore.set(key, {
    environmentKey,
    sourceEntity: route.sourceEntity,
    targetEntity: route.targetEntity,
    routeId: route.routeId,
    pathSignature,
    successCount: 1,
    lastSucceededAt: Date.now()
  });
}

export function getSuccessfulTraversalRouteMap(
  ctx: CommandContext,
  sourceEntity: string,
  targetEntity: string
): Map<string, TraversalHistoryEntry> {
  const environmentKey = buildTraversalEnvironmentKey(ctx);
  const result = new Map<string, TraversalHistoryEntry>();

  for (const entry of traversalHistoryStore.values()) {
    if (
      entry.environmentKey === environmentKey &&
      entry.sourceEntity === sourceEntity &&
      entry.targetEntity === targetEntity
    ) {
      result.set(entry.routeId, entry);
    }
  }

  return result;
}

export function sortRoutesByHistoricalSuccess(
  routes: TraversalRoute[],
  successMap: Map<string, TraversalHistoryEntry>
): TraversalRoute[] {
  return [...routes].sort((left, right) => {
    const leftHistory = successMap.get(left.routeId);
    const rightHistory = successMap.get(right.routeId);

    const leftSuccessCount = leftHistory?.successCount ?? 0;
    const rightSuccessCount = rightHistory?.successCount ?? 0;

    if (leftSuccessCount !== rightSuccessCount) {
      return rightSuccessCount - leftSuccessCount;
    }

    const leftLastSucceededAt = leftHistory?.lastSucceededAt ?? 0;
    const rightLastSucceededAt = rightHistory?.lastSucceededAt ?? 0;

    if (leftLastSucceededAt !== rightLastSucceededAt) {
      return rightLastSucceededAt - leftLastSucceededAt;
    }

    return 0;
  });
}

export function buildSuccessfulRouteBadgeText(
  history?: TraversalHistoryEntry
): string | undefined {
  if (!history) {
    return undefined;
  }

  return history.successCount > 1
    ? `Previously successful · used ${history.successCount} times`
    : "Previously successful";
}