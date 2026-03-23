import { FetchXmlDocumentNode, FetchXmlExplainModel } from './fetchXmlTypes.js';

function pushSection(lines: string[], heading: string, bodyLines: string[]): void {
  if (!bodyLines.length) {
    return;
  }

  lines.push(`## ${heading}`);
  lines.push('');
  lines.push(...bodyLines);
  lines.push('');
}

export function narrateFetchXmlExplain(
  document: FetchXmlDocumentNode,
  model: FetchXmlExplainModel,
  rawFetchXml: string
): string {
  const lines: string[] = [];

  lines.push('# DV Quick Run - Explain Query');
  lines.push('');
  lines.push('## Raw Query');
  lines.push('');
  lines.push('```xml');
  lines.push(rawFetchXml.trim());
  lines.push('```');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(model.overview.executiveSummary);
  lines.push('');

  pushSection(lines, 'Query Overview', [
    `- Root entity: \`${model.overview.rootEntityName}\`${model.overview.rootEntityDisplayName ? ` (${model.overview.rootEntityDisplayName})` : ''}`,
    `- Selected attributes: ${model.overview.selectedAttributeCount}`,
    `- Linked entities: ${model.overview.linkedEntityCount}`,
    `- Filters present: ${model.overview.hasFilters ? 'yes' : 'no'}`,
    `- Fetch settings: ${Object.keys(document.fetchAttributes).length ? Object.entries(document.fetchAttributes).map(([key, value]) => `\`${key}\`${value ? `=${value}` : ''}`).join(', ') : 'none'}`,
    `- Result shape summary: ${model.overview.estimatedResultShapeSummary}`
  ]);

  pushSection(lines, 'Result Shape', model.resultShape.map((item) => `- ${item}`));
  pushSection(lines, 'Structure Walkthrough', model.structure.map((item) => `${'  '.repeat(item.depth)}- ${item.summary}`));
  pushSection(lines, 'Relationship Explanation', model.relationships.map((item) => `- ${item.summary}`));

  const filterLines: string[] = [];
  for (const filterGroup of model.filters) {
    filterLines.push(`- ${filterGroup.summary}`);
    for (const conditionSummary of filterGroup.conditionSummaries) {
      filterLines.push(`  - ${conditionSummary}`);
    }
  }
  pushSection(lines, 'Filter Narration', filterLines);
  pushSection(lines, 'Operator Meaning', model.operators.map((item) => `- ${item.summary}`));
  pushSection(lines, 'Diagnostics', model.diagnostics.map((item) => `- [${item.severity}] ${item.summary}`));
  pushSection(lines, 'Suggestions', model.suggestions.map((item) => `- ${item.summary}`));

  pushSection(lines, 'Trust Model', [
    '- Structure explanations are based on a FetchXML-native parse tree rather than flattened OData-style clauses.',
    '- Metadata hints are applied when entity, field, and operator information can be resolved confidently, including choice labels when metadata is available locally.',
    '- Diagnostics are advisory only and do not mutate the query.'
  ]);

  return lines.join('\n');
}
