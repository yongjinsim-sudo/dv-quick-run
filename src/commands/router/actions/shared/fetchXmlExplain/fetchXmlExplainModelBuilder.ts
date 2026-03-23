import {
  FetchXmlEnrichedEntityNode,
  FetchXmlEnrichedTree,
  FetchXmlExplainFilterGroup,
  FetchXmlExplainModel,
  FetchXmlExplainOperatorItem,
  FetchXmlExplainRelationshipItem,
  FetchXmlExplainStructureItem
} from './fetchXmlTypes.js';

function formatFieldLabel(logicalName: string, displayName?: string): string {
  return displayName ? `\`${logicalName}\` (${displayName})` : `\`${logicalName}\``;
}

function formatEntityLabel(entityName: string, displayName?: string): string {
  return displayName ? `\`${entityName}\` (${displayName})` : `\`${entityName}\``;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function titleCaseFilterType(filterType?: 'and' | 'or'): string {
  if (filterType === 'and') {
    return 'AND';
  }

  if (filterType === 'or') {
    return 'OR';
  }

  return 'grouped';
}

function describeCondition(condition: FetchXmlEnrichedTree['conditions'][number]): string {
  const fieldName = condition.resolved.node.attribute ?? '(unknown field)';
  const fieldDisplayName = condition.metadataHint?.field?.displayName;
  const operator = condition.operatorHint?.labels.polished
    ?? condition.operatorHint?.labels.raw
    ?? condition.resolved.node.operator
    ?? '(unknown operator)';

  const values = condition.resolved.node.values;
  const valueLabels = condition.resolvedValueLabels;
  const renderedValues = values.map((value, index) => {
    const label = valueLabels[index];
    return label ? `\`${value}\` (${label})` : `\`${value}\``;
  });

  if (!renderedValues.length) {
    return `${formatFieldLabel(fieldName, fieldDisplayName)} ${operator}.`;
  }

  return `${formatFieldLabel(fieldName, fieldDisplayName)} ${operator} ${renderedValues.join(', ')}.`;
}


function buildExecutiveSummary(tree: FetchXmlEnrichedTree): string {
  const root = tree.entities[0];
  if (!root) {
    return 'This query could not determine a root entity confidently.';
  }

  const rootLabel = root.entity?.displayName
    ? `${root.resolved.name} (${root.entity.displayName})`
    : root.resolved.name;

  const rootConditions = tree.conditions.filter((condition) => condition.resolved.depth === 0).length;
  const linkedEntities = tree.entities.slice(1);
  const selectedAliasesOrNames = linkedEntities
    .slice(0, 4)
    .map((entityNode) => `\`${entityNode.resolved.alias ?? entityNode.resolved.name}\``);

  const parts: string[] = [
    `This query retrieves ${rootConditions ? 'filtered ' : ''}${rootLabel} rows${tree.document.fetchAttributes.distinct === 'true' ? ' with duplicate root rows removed' : ''}.`
  ];

  if (linkedEntities.length) {
    parts.push(`It also brings in related data through ${pluralize(linkedEntities.length, 'linked entity', 'linked entities')}${selectedAliasesOrNames.length ? `, including ${selectedAliasesOrNames.join(', ')}` : ''}.`);
  }

  const operatorHighlights = new Set(
    tree.conditions
      .map((condition) => condition.operatorHint?.labels.polished ?? condition.resolved.node.operator)
      .filter((value): value is string => !!value)
      .filter((value) => ['This Month', 'Contains Values', 'Like', 'Not Null', 'In', 'On Or After', 'On Or Before'].includes(value))
  );

  if (operatorHighlights.size) {
    parts.push(`Notable filter behaviour includes ${[...operatorHighlights].map((value) => `\`${value}\``).join(', ')} conditions.`);
  }

  return parts.join(' ');
}

function buildResultShapeSummary(tree: FetchXmlEnrichedTree): string {
  const root = tree.entities[0];
  const linkedCount = Math.max(0, tree.entities.length - 1);
  const rootEntityLabel = root?.entity?.displayName ? `${root.resolved.name} (${root.entity.displayName})` : root?.resolved.name ?? 'unknown entity';

  if (!root) {
    return 'This query has no resolvable root entity.';
  }

  if (!linkedCount) {
    return `This query returns ${rootEntityLabel} rows based on the root entity only.`;
  }

  return `This query returns ${rootEntityLabel} rows and includes data from ${linkedCount} linked entit${linkedCount === 1 ? 'y' : 'ies'}.`;
}

function buildResultShape(tree: FetchXmlEnrichedTree): string[] {
  const root = tree.entities[0];
  if (!root) {
    return [];
  }

  const rootRenderedAttributes = root.resolved.attributes.map((attribute) => {
    const enriched = tree.attributes.find((item) => item.resolved === attribute);
    return enriched ? formatFieldLabel(attribute.node.name, enriched.metadataHint?.field?.displayName) : `\`${attribute.node.name}\``;
  });

  const lines: string[] = [
    `Each result row is anchored on the root entity ${formatEntityLabel(root.resolved.name, root.entity?.displayName)}${tree.document.fetchAttributes.distinct === 'true' ? ', with distinct root rows requested' : ''}.`
  ];

  if (rootRenderedAttributes.length) {
    lines.push(`From the root entity, the query explicitly selects ${rootRenderedAttributes.join(', ')}.`);
  }

  const linkedSelections = tree.entities
    .filter((entityNode) => entityNode.resolved.kind === 'link-entity' && entityNode.resolved.attributes.length > 0)
    .map((entityNode) => {
      const renderedAttributes = entityNode.resolved.attributes.map((attribute) => {
        const enriched = tree.attributes.find((item) => item.resolved === attribute);
        return enriched ? formatFieldLabel(attribute.node.name, enriched.metadataHint?.field?.displayName) : `\`${attribute.node.name}\``;
      });

      return `Linked ${formatEntityLabel(entityNode.resolved.name, entityNode.entity?.displayName)}${entityNode.resolved.alias ? ` via alias \`${entityNode.resolved.alias}\`` : ''} contributes ${renderedAttributes.join(', ')}.`;
    });

  lines.push(...linkedSelections);
  return lines;
}

function buildStructure(tree: FetchXmlEnrichedTree): FetchXmlExplainStructureItem[] {
  return tree.entities.map((entityNode) => {
    const selectedAttributes = entityNode.resolved.attributes.map((attribute) => attribute.node.name);
    const renderedAttributes = entityNode.resolved.attributes.map((attribute) => {
      const enriched = tree.attributes.find((item) => item.resolved === attribute);
      return enriched ? formatFieldLabel(attribute.node.name, enriched.metadataHint?.field?.displayName) : `\`${attribute.node.name}\``;
    });

    const entityLabel = formatEntityLabel(entityNode.resolved.name, entityNode.entity?.displayName);
    const aliasSummary = entityNode.resolved.alias ? ` using alias \`${entityNode.resolved.alias}\`` : '';
    let summary: string;

    if (entityNode.resolved.depth === 0) {
      summary = `The root entity is ${entityLabel}${aliasSummary}. Each result row starts from this entity${renderedAttributes.length ? `, and the query explicitly selects ${renderedAttributes.join(', ')}` : ''}.`;
    } else {
      const parentPath = entityNode.resolved.scopePath.entityPath;
      const parentName = parentPath.length > 1 ? parentPath[parentPath.length - 2] : tree.document.rootEntity.name;
      summary = `The query then links to ${entityLabel}${aliasSummary} from \`${parentName}\`${renderedAttributes.length ? ` to bring in ${renderedAttributes.join(', ')}` : ' without selecting explicit attributes at this level'}.`;
    }

    return {
      entityName: entityNode.resolved.name,
      entityAlias: entityNode.resolved.alias,
      depth: entityNode.resolved.depth,
      selectedAttributes,
      summary
    };
  });
}

function inferRelationshipPurpose(entityNode: FetchXmlEnrichedEntityNode): string | undefined {
  const alias = entityNode.resolved.alias?.toLowerCase();
  const name = entityNode.resolved.name.toLowerCase();

  if (alias?.includes('identifier') || name.includes('identifier')) {
    return 'This linked entity appears to retrieve identifier values related to the parent record.';
  }

  if (alias?.includes('patient')) {
    return 'This linked entity appears to represent a related patient/contact record connected to the parent row.';
  }

  if (name.includes('careplan')) {
    return 'This linked entity brings in care-plan context associated with the parent scope.';
  }

  if (alias?.includes('task') || name.includes('task')) {
    return 'This linked entity contributes task-level details associated with the parent activity or workflow.';
  }

  if (alias?.includes('healthcheck') || name.includes('healthcheck')) {
    return 'This linked entity adds health-check definition metadata for the related task or activity.';
  }

  return undefined;
}

function buildRelationships(tree: FetchXmlEnrichedTree): FetchXmlExplainRelationshipItem[] {
  return tree.entities
    .filter((entityNode) => entityNode.resolved.kind === 'link-entity')
    .map((entityNode) => {
      const parentDepth = Math.max(0, entityNode.resolved.depth - 1);
      const parentEntity = [...tree.entities].reverse().find((candidate) => candidate.resolved.depth === parentDepth && candidate.resolved.scopePath.entityPath.length === entityNode.resolved.scopePath.entityPath.length - 1);
      const parentName = parentEntity?.resolved.name ?? tree.document.rootEntity.name;
      const childName = entityNode.resolved.name;
      const relationshipSummary = entityNode.resolved.from && entityNode.resolved.to
        ? `The query links \`${parentName}.${entityNode.resolved.to}\` to \`${childName}.${entityNode.resolved.from}\`${entityNode.resolved.alias ? ` using alias \`${entityNode.resolved.alias}\`` : ''}.`
        : `The query links \`${parentName}\` to \`${childName}\`${entityNode.resolved.alias ? ` using alias \`${entityNode.resolved.alias}\`` : ''}.`;
      const linkType = entityNode.resolved.linkType?.toLowerCase();
      const linkTypeSummary = linkType === 'outer'
        ? 'Because this is an outer join, parent rows may still appear even when no matching linked record exists.'
        : linkType === 'inner'
          ? 'Because this is an inner join, a matching linked record is required for the row to participate fully in this join path.'
          : 'The link type is not explicitly specified, so standard FetchXML join behaviour applies.';
      const purpose = inferRelationshipPurpose(entityNode);

      return {
        parentEntityName: parentName,
        childEntityName: childName,
        childAlias: entityNode.resolved.alias,
        from: entityNode.resolved.from,
        to: entityNode.resolved.to,
        linkType: entityNode.resolved.linkType,
        summary: [relationshipSummary, purpose, linkTypeSummary].filter((value): value is string => !!value).join(' ')
      };
    });
}

function buildFilters(tree: FetchXmlEnrichedTree): FetchXmlExplainFilterGroup[] {
  const groups = new Map<string, FetchXmlExplainFilterGroup>();

  for (const condition of tree.conditions) {
    const key = [
      condition.resolved.ownerEntityName,
      condition.resolved.ownerAlias ?? '',
      condition.resolved.filterGroupPath.join('>'),
      condition.resolved.filterTypePath.join('>')
    ].join('|');
    const existing = groups.get(key);
    const conditionSummary = describeCondition(condition);

    if (existing) {
      existing.conditionSummaries.push(conditionSummary);
      existing.summary = `At the ${existing.ownerAlias ? `linked alias \`${existing.ownerAlias}\`` : `entity \`${existing.ownerEntityName}\``} scope, the query applies ${titleCaseFilterType(existing.filterType)} conditions.`;
      continue;
    }

    groups.set(key, {
      ownerEntityName: condition.resolved.ownerEntityName,
      ownerAlias: condition.resolved.ownerAlias,
      filterType: condition.resolved.filterTypePath[0],
      conditionSummaries: [conditionSummary],
      summary: `At the ${condition.resolved.ownerAlias ? `linked alias \`${condition.resolved.ownerAlias}\`` : `entity \`${condition.resolved.ownerEntityName}\``} scope, the query applies ${titleCaseFilterType(condition.resolved.filterTypePath[0])} conditions.`
    });
  }

  return [...groups.values()];
}

function buildOperators(tree: FetchXmlEnrichedTree): FetchXmlExplainOperatorItem[] {
  const seen = new Set<string>();
  const items: FetchXmlExplainOperatorItem[] = [];

  for (const condition of tree.conditions) {
    const key = condition.resolved.node.operator ?? '';
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const operatorLabel = condition.operatorHint?.labels.polished ?? key;
    const description = condition.operatorHint?.description ?? 'No additional operator guidance is available.';

    items.push({
      operator: key,
      summary: `\`${key}\` (${operatorLabel}) — ${description}`
    });
  }

  return items;
}

export function buildFetchXmlExplainModel(tree: FetchXmlEnrichedTree): FetchXmlExplainModel {
  const root = tree.entities[0];

  return {
    overview: {
      rootEntityName: root?.resolved.name ?? tree.document.rootEntity.name,
      rootEntityDisplayName: root?.entity?.displayName,
      selectedAttributeCount: tree.attributes.length,
      linkedEntityCount: Math.max(0, tree.entities.length - 1),
      hasFilters: tree.conditions.length > 0,
      estimatedResultShapeSummary: buildResultShapeSummary(tree),
      executiveSummary: buildExecutiveSummary(tree)
    },
    resultShape: buildResultShape(tree),
    structure: buildStructure(tree),
    relationships: buildRelationships(tree),
    filters: buildFilters(tree),
    operators: buildOperators(tree),
    diagnostics: [],
    suggestions: []
  };
}
