import {
  FetchXmlDocumentNode,
  FetchXmlEntityNode,
  FetchXmlFilterNode,
  FetchXmlLinkEntityNode,
  FetchXmlResolvedAttribute,
  FetchXmlResolvedCondition,
  FetchXmlResolvedEntityNode,
  FetchXmlResolvedTree,
  FetchXmlScopePath
} from './fetchXmlTypes.js';

function buildScopePath(entityPath: string[], aliasPath: string[]): FetchXmlScopePath {
  return {
    entityPath: [...entityPath],
    aliasPath: [...aliasPath]
  };
}

function flattenConditions(
  filter: FetchXmlFilterNode,
  ownerEntityName: string,
  ownerAlias: string | undefined,
  scopePath: FetchXmlScopePath,
  depth: number,
  filterTypePath: Array<'and' | 'or' | undefined>,
  filterGroupPath: string[],
  target: FetchXmlResolvedCondition[]
): void {
  for (const condition of filter.conditions) {
    target.push({
      node: condition,
      ownerEntityName,
      ownerAlias,
      scopePath,
      filterTypePath,
      filterGroupPath,
      depth
    });
  }

  for (const childFilter of filter.childFilters) {
    flattenConditions(
      childFilter,
      ownerEntityName,
      ownerAlias,
      scopePath,
      depth,
      [...filterTypePath, childFilter.type],
      [...filterGroupPath, `filter:${filter.childFilters.indexOf(childFilter)}`],
      target
    );
  }
}

function resolveEntityNode(
  node: FetchXmlEntityNode | FetchXmlLinkEntityNode,
  kind: 'entity' | 'link-entity',
  depth: number,
  entityPath: string[],
  aliasPath: string[],
  entities: FetchXmlResolvedEntityNode[],
  attributes: FetchXmlResolvedAttribute[],
  conditions: FetchXmlResolvedCondition[]
): void {
  const scopePath = buildScopePath(entityPath, aliasPath);

  const resolvedAttributes = node.attributes.map((attribute) => ({
    node: attribute,
    ownerEntityName: node.name,
    ownerAlias: node.alias,
    scopePath,
    depth
  }));

  const resolvedConditions: FetchXmlResolvedCondition[] = [];

  for (const filter of node.filters) {
    flattenConditions(
      filter,
      node.name,
      node.alias,
      scopePath,
      depth,
      [filter.type],
      [`filter:${node.filters.indexOf(filter)}`],
      resolvedConditions
    );
  }

  entities.push({
    kind,
    name: node.name,
    alias: node.alias,
    from: 'from' in node ? node.from : undefined,
    to: 'to' in node ? node.to : undefined,
    linkType: 'linkType' in node ? node.linkType : undefined,
    depth,
    scopePath,
    attributes: resolvedAttributes,
    conditions: resolvedConditions
  });

  attributes.push(...resolvedAttributes);
  conditions.push(...resolvedConditions);

  for (const child of node.linkEntities) {
    resolveEntityNode(
      child,
      'link-entity',
      depth + 1,
      [...entityPath, child.name],
      child.alias ? [...aliasPath, child.alias] : [...aliasPath],
      entities,
      attributes,
      conditions
    );
  }
}

export function resolveFetchXmlScopes(document: FetchXmlDocumentNode): FetchXmlResolvedTree {
  const entities: FetchXmlResolvedEntityNode[] = [];
  const attributes: FetchXmlResolvedAttribute[] = [];
  const conditions: FetchXmlResolvedCondition[] = [];

  resolveEntityNode(
    document.rootEntity,
    'entity',
    0,
    [document.rootEntity.name],
    document.rootEntity.alias ? [document.rootEntity.alias] : [],
    entities,
    attributes,
    conditions
  );

  return {
    document,
    entities,
    attributes,
    conditions
  };
}
