import type { McpRankedRelationshipPath } from "./mcpRelationshipIntelligence.js";

export function pathMatchesRelationshipHint(path: McpRankedRelationshipPath, hint: string): boolean {
  const normalized = hint.trim().toLowerCase();
  return path.hops.some((hop) =>
    hop.navigationProperty.toLowerCase() === normalized
    || hop.relationshipSchemaName?.toLowerCase() === normalized
    || hop.referencingAttribute?.toLowerCase() === normalized
  );
}

export function selectRelationshipPath(
  paths: readonly McpRankedRelationshipPath[],
  pathId?: string,
  relationshipHint?: string
): McpRankedRelationshipPath | undefined {
  if (pathId) {
    return paths.find((path) => path.pathId === pathId);
  }
  if (relationshipHint) {
    return paths.find((path) => pathMatchesRelationshipHint(path, relationshipHint));
  }
  return paths[0];
}
