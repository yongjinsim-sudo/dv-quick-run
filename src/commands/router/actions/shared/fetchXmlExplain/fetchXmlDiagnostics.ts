import { FetchXmlEnrichedTree, FetchXmlExplainDiagnostic, FetchXmlExplainSuggestion } from './fetchXmlTypes.js';

export function buildFetchXmlDiagnostics(tree: FetchXmlEnrichedTree): {
  diagnostics: FetchXmlExplainDiagnostic[];
  suggestions: FetchXmlExplainSuggestion[];
} {
  const diagnostics: FetchXmlExplainDiagnostic[] = [];
  const suggestions: FetchXmlExplainSuggestion[] = [];

  const linkedEntitiesWithoutAlias = tree.entities.filter(
    (entityNode) => entityNode.resolved.kind === 'link-entity' && !entityNode.resolved.alias
  );

  if (linkedEntitiesWithoutAlias.length) {
    diagnostics.push({
      severity: 'note',
      code: 'missing-alias',
      summary: `This query contains ${linkedEntitiesWithoutAlias.length} linked entit${linkedEntitiesWithoutAlias.length === 1 ? 'y' : 'ies'} without an alias. Meaningful aliases usually make larger FetchXML queries easier to reason about.`
    });

    suggestions.push({
      code: 'add-aliases',
      summary: 'Consider adding short but meaningful aliases to linked entities so later filters and joins are easier to read.'
    });
  }

  const maxDepth = Math.max(...tree.entities.map((entityNode) => entityNode.resolved.depth), 0);
  if (maxDepth >= 2) {
    diagnostics.push({
      severity: 'info',
      code: 'deep-nesting',
      summary: 'This query uses nested link-entities. That is valid, but deeper hierarchies can become harder to review and troubleshoot.'
    });
  }

  const outerJoinCount = tree.entities.filter((entityNode) => entityNode.resolved.linkType?.toLowerCase() === 'outer').length;
  if (outerJoinCount > 0) {
    diagnostics.push({
      severity: 'info',
      code: 'outer-join',
      summary: 'The query uses one or more outer joins, so root records may still appear even when some linked records are missing.'
    });
  }

  if (!tree.conditions.length) {
    suggestions.push({
      code: 'no-filters',
      summary: 'This query has no filters. That may be intentional, but adding scope-appropriate filters can make large result sets easier to inspect.'
    });
  }

  return {
    diagnostics,
    suggestions
  };
}
