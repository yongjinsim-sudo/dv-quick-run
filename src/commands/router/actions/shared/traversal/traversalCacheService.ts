export interface TraversalRouteKey {
  environmentId: string;
  sourceTable: string;
  targetTable: string;
  maxDepth: number;
}

export class TraversalCacheService {
  private static metadataCache = new Map<string, any>();
  private static routeCache = new Map<string, any>();

  // ---------- Metadata Cache ----------

  public static getMetadata(environmentId: string): any | undefined {
    const hit = this.metadataCache.get(environmentId);
    console.log(`[Traversal] Metadata cache ${hit ? 'HIT' : 'MISS'} (${environmentId})`);
    return hit;
  }

  public static setMetadata(environmentId: string, metadata: any): void {
    this.metadataCache.set(environmentId, metadata);
  }

  // ---------- Route Cache ----------

  private static buildRouteKey(key: TraversalRouteKey): string {
    return `${key.environmentId}::${key.sourceTable}::${key.targetTable}::${key.maxDepth}`;
  }

  public static getRoute(key: TraversalRouteKey): any | undefined {
    const cacheKey = this.buildRouteKey(key);
    const hit = this.routeCache.get(cacheKey);
    console.log(`[Traversal] Route cache ${hit ? 'HIT' : 'MISS'} (${cacheKey})`);
    return hit;
  }

  public static setRoute(key: TraversalRouteKey, route: any): void {
    const cacheKey = this.buildRouteKey(key);
    this.routeCache.set(cacheKey, route);
  }

  // ---------- Clear ----------

  public static clearAll(): void {
    this.metadataCache.clear();
    this.routeCache.clear();
    console.log('[Traversal] Cache cleared');
  }

  public static clearEnvironment(environmentId: string): void {
    this.metadataCache.delete(environmentId);

    for (const key of this.routeCache.keys()) {
      if (key.startsWith(environmentId + '::')) {
        this.routeCache.delete(key);
      }
    }

    console.log(`[Traversal] Cache cleared for environment ${environmentId}`);
  }
}