import type { UnderstandingComplexity, UnderstandingDocument, UnderstandingReturnedShapeNode, UnderstandingSignal, UnderstandingTraversalNode } from '../../../../../product/understanding/understandingTypes.js';
import type { FetchXmlDocumentNode, FetchXmlExplainModel } from './fetchXmlTypes.js';

function fetchSettings(document: FetchXmlDocumentNode): string[] {
  return Object.entries(document.fetchAttributes).map(([key, value]) => value ? `${key}=${value}` : key);
}

function buildComplexity(model: FetchXmlExplainModel, document: FetchXmlDocumentNode): UnderstandingComplexity {
  let score = 15;
  const reasons: string[] = ['FetchXML-native query understanding.'];

  if (model.overview.selectedAttributeCount > 0) {
    score += Math.min(20, model.overview.selectedAttributeCount);
    reasons.push(`${model.overview.selectedAttributeCount} selected attribute${model.overview.selectedAttributeCount === 1 ? '' : 's'}.`);
  } else {
    score += 15;
    reasons.push('No explicit attributes detected at the root/link scopes.');
  }
  if (model.overview.linkedEntityCount) {
    score += model.overview.linkedEntityCount * 18;
    reasons.push(`${model.overview.linkedEntityCount} linked entit${model.overview.linkedEntityCount === 1 ? 'y' : 'ies'}.`);
  }
  if (model.overview.hasFilters) {
    score += 15;
    reasons.push('FetchXML filters define an evidence boundary.');
  }
  if (!document.fetchAttributes.top && !model.overview.hasFilters) {
    score += 10;
    reasons.push('No top setting and no filter can broaden evidence review.');
  }
  if (model.diagnostics.length) {
    score += 8;
    reasons.push(`${model.diagnostics.length} diagnostic note${model.diagnostics.length === 1 ? '' : 's'} require review.`);
  }

  const boundedScore = Math.min(100, score);
  return {
    level: boundedScore >= 65 ? 'High' : boundedScore >= 35 ? 'Medium' : 'Low',
    score: boundedScore,
    reasons
  };
}

function buildTraversal(model: FetchXmlExplainModel): UnderstandingTraversalNode[] {
  return model.structure.map((item) => ({
    label: item.entityName,
    technicalName: item.entityAlias,
    depth: item.depth,
    relationship: item.depth === 0 ? undefined : 'FetchXML link-entity',
    joinType: model.relationships.find((relationship) => relationship.childEntityName === item.entityName && relationship.childAlias === item.entityAlias)?.linkType ?? undefined
  }));
}

function buildReturnedShape(model: FetchXmlExplainModel): UnderstandingReturnedShapeNode[] {
  return model.structure.map((item) => ({
    label: item.entityName,
    technicalName: item.entityAlias,
    depth: item.depth,
    fields: item.selectedAttributes.map((attribute) => `\`${attribute}\``)
  }));
}

function buildSignals(model: FetchXmlExplainModel): UnderstandingSignal[] {
  const signals: UnderstandingSignal[] = [];

  if (model.overview.selectedAttributeCount > 0) {
    signals.push({
      kind: 'positive',
      title: 'Explicit FetchXML projection',
      detail: 'The query selects attributes explicitly, which makes the result shape easier to inspect and hand off.',
      confidence: 'high',
      sourceContributor: 'fetchxml.understanding.v2.2'
    });
  }
  if (model.overview.hasFilters) {
    signals.push({
      kind: 'positive',
      title: 'Explicit filter boundary',
      detail: 'The FetchXML includes filters, so the evidence set is scoped rather than purely exploratory.',
      confidence: 'high',
      sourceContributor: 'fetchxml.understanding.v2.2'
    });
  }
  // Bounded retrieval is added in buildFetchXmlUnderstandingDocument because it reads raw fetch attributes.
  if (!model.overview.hasFilters) {
    signals.push({
      kind: 'smell',
      title: 'Unfiltered FetchXML retrieval',
      detail: 'The query is useful for discovery, but it is weaker as evidence for a specific operational question until scoped.',
      confidence: 'medium',
      sourceContributor: 'fetchxml.understanding.v2.2'
    });
  }
  for (const diagnostic of model.diagnostics) {
    signals.push({
      kind: diagnostic.severity === 'warning' ? 'risk' : 'smell',
      title: diagnostic.code,
      detail: diagnostic.summary,
      confidence: diagnostic.severity === 'warning' ? 'medium' : 'low',
      sourceContributor: 'fetchxml.diagnostics'
    });
  }

  return signals;
}

export function buildFetchXmlUnderstandingDocument(
  document: FetchXmlDocumentNode,
  model: FetchXmlExplainModel,
  rawFetchXml: string
): UnderstandingDocument {
  const settings = fetchSettings(document);
  const confidence = model.diagnostics.some((item) => item.severity === 'warning') ? 'medium' : 'high';
  const root = model.overview.rootEntityName;

  return {
    schemaVersion: '1.0',
    engineVersion: 'v2.3',
    title: 'DV Quick Run - Query Understanding Report',
    generatedAt: new Date().toISOString(),
    subject: {
      kind: 'fetchxml',
      entityLogicalName: root,
      entitySetName: root
    },
    confidence,
    audience: ['investigator', 'developer', 'admin', 'handoff'],
    invariant: 'Narrative must never replace technical truth.',
    narrative: {
      overview: model.overview.hasFilters
        ? `${model.overview.executiveSummary} The filter makes this more useful for validation than broad discovery.`
        : model.overview.executiveSummary,
      intent: [
        model.overview.hasFilters ? '- Validate rows that match FetchXML filter conditions.' : '- Explore available rows before narrowing the investigation.',
        model.overview.selectedAttributeCount ? '- Return the attributes selected by the FetchXML projection.' : '- Inspect the default row shape produced by the FetchXML.',
        ...(model.overview.linkedEntityCount ? ['- Bring linked entity context into the same result shape.'] : [])
      ],
      investigationStage: model.overview.hasFilters ? 'Validation' : 'Discovery',
      investigationPattern: model.overview.linkedEntityCount ? 'Relationship Inspection Query' : (model.overview.hasFilters ? 'Targeted Retrieval Query' : 'Inspection Query')
    },
    technical: {
      summary: [
        `- Root entity: \`${model.overview.rootEntityName}\`${model.overview.rootEntityDisplayName ? ` (${model.overview.rootEntityDisplayName})` : ''}`,
        `- Selected attributes: ${model.overview.selectedAttributeCount}`,
        `- Linked entities: ${model.overview.linkedEntityCount}`,
        `- Filters present: ${model.overview.hasFilters ? 'yes' : 'no'}`,
        `- Fetch settings: ${settings.length ? settings.map((setting) => `\`${setting}\``).join(', ') : 'none'}`,
        `- Result shape summary: ${model.overview.estimatedResultShapeSummary}`
      ],
      sections: [
        { heading: 'Structure Walkthrough', lines: model.structure.map((item) => `${'  '.repeat(item.depth)}- ${item.summary}`), confidence: 'high' as const, sourceContributor: 'fetchxml.structure' },
        { heading: 'Relationship Explanation', lines: model.relationships.map((item) => `- ${item.summary}`), confidence: model.relationships.length ? 'medium' as const : 'high' as const, sourceContributor: 'fetchxml.relationships' },
        { heading: 'Filter Narration', lines: model.filters.flatMap((filterGroup) => [`- ${filterGroup.summary}`, ...filterGroup.conditionSummaries.map((condition) => `  - ${condition}`)]), confidence: model.filters.length ? 'high' as const : 'medium' as const, sourceContributor: 'fetchxml.filters' },
        { heading: 'Operator Meaning', lines: model.operators.map((item) => `- ${item.summary}`), confidence: model.operators.length ? 'high' as const : 'medium' as const, sourceContributor: 'fetchxml.operators' },
        { heading: 'Diagnostics', lines: model.diagnostics.map((item) => `- [${item.severity}] ${item.summary}`), confidence: 'medium' as const, sourceContributor: 'fetchxml.diagnostics' },
        { heading: 'Trust Model', lines: [
          '- Structure explanations are based on a FetchXML-native parse tree rather than flattened OData-style clauses.',
          '- Metadata hints are applied when entity, field, and operator information can be resolved confidently, including choice labels when metadata is available locally.',
          '- Diagnostics are advisory only and do not mutate the query.'
        ], confidence: 'high' as const, sourceContributor: 'fetchxml.trust' }
      ].filter((section) => section.lines.length)
    },
    mechanics: {
      rootTarget: root,
      operation: 'Retrieve multiple records',
      projection: model.structure[0]?.selectedAttributes ?? [],
      filters: model.filters.flatMap((filterGroup) => filterGroup.conditionSummaries),
      ordering: [],
      expands: model.relationships.map((relationship) => ({
        navigationProperty: relationship.childAlias ?? relationship.childEntityName,
        nestedProjection: model.structure.find((item) => item.entityName === relationship.childEntityName && item.entityAlias === relationship.childAlias)?.selectedAttributes ?? [],
        raw: relationship.summary,
        explanation: relationship.summary
      })),
      rowLimit: document.fetchAttributes.top ? Number(document.fetchAttributes.top) : undefined,
      unknownOptions: []
    },
    traversal: buildTraversal(model),
    returnedShape: buildReturnedShape(model),
    complexity: buildComplexity(model, document),
    signals: [
      ...buildSignals(model),
      ...(document.fetchAttributes.top ? [{
        kind: 'positive' as const,
        title: 'Bounded retrieval',
        detail: `The FetchXML uses top=${document.fetchAttributes.top}, keeping the result set reviewable during investigation.`,
        confidence: 'high' as const,
        sourceContributor: 'fetchxml.understanding.v2.2'
      }] : [])
    ],
    recommendations: model.suggestions.map((suggestion) => ({
      title: suggestion.code,
      detail: suggestion.summary,
      rationale: 'Recommendation is derived from FetchXML structure, diagnostics, or investigation posture. It is advisory and should be reviewed before applying.',
      confidence: 'medium',
      actionability: 'none',
      sourceContributor: 'fetchxml.diagnostics'
    })),
    evidence: [
      { label: 'Parsed FetchXML', detail: `Root entity \`${root}\`, selected attributes ${model.overview.selectedAttributeCount}, linked entities ${model.overview.linkedEntityCount}.`, confidence: 'high' }
    ],
    rawReference: {
      language: 'fetchxml',
      text: rawFetchXml.trim()
    },
    sourceContributors: [
      { id: 'fetchxml.structure', title: 'FetchXML Structure Analysis' },
      { id: 'fetchxml.diagnostics', title: 'FetchXML Diagnostics' },
      { id: 'fetchxml.trust', title: 'FetchXML Trust Model' }
    ]
  };
}
