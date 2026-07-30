/**
 * Resolves the root Dataverse entity-set segment from a relative or absolute OData query.
 * Supports collection queries and record-navigation paths such as
 * contacts(<guid>)/Contact_Tasks?$select=activityid.
 */
export function rootEntitySetFromODataQuery(query: string): string | undefined {
  const candidate = query
    .trim()
    .replace(/^https:\/\/[^/]+\/api\/data\/v[0-9.]+\//i, "")
    .replace(/^\/+/, "");
  const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|\?|\/|$)/.exec(candidate);
  return match?.[1];
}
