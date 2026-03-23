import {
  FetchXmlAttributeNode,
  FetchXmlConditionNode,
  FetchXmlDocumentNode,
  FetchXmlEntityNode,
  FetchXmlFilterNode,
  FetchXmlLinkEntityNode
} from './fetchXmlTypes.js';

type TagToken = {
  type: 'open' | 'close';
  tagName: string;
  attributes: Record<string, string | undefined>;
  selfClosing: boolean;
};

type NodeContext =
  | { kind: 'entity'; node: FetchXmlEntityNode }
  | { kind: 'link-entity'; node: FetchXmlLinkEntityNode }
  | { kind: 'filter'; node: FetchXmlFilterNode }
  | { kind: 'condition'; node: FetchXmlConditionNode };

function getExpectedCloseTagName(context: NodeContext): string {
  switch (context.kind) {
    case 'entity':
      return 'entity';
    case 'link-entity':
      return 'link-entity';
    case 'filter':
      return 'filter';
    case 'condition':
      return 'condition';
    default:
      return assertNever(context);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected node context: ${JSON.stringify(value)}`);
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizeName(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed || undefined;
}

function parseAttributes(raw: string): Record<string, string | undefined> {
  const attributes: Record<string, string | undefined> = {};
  const pattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    attributes[match[1]] = decodeXmlText(match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function tokenizeFetchXml(text: string): TagToken[] {
  const tokens: TagToken[] = [];
  const pattern = /<\/?[^>]+>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const rawTag = match[0];

    if (rawTag.startsWith('<?') || rawTag.startsWith('<!--') || rawTag.startsWith('<!DOCTYPE')) {
      continue;
    }

    const closeMatch = /^<\/\s*([A-Za-z_:][-A-Za-z0-9_:.]*)\s*>$/.exec(rawTag);
    if (closeMatch) {
      tokens.push({
        type: 'close',
        tagName: closeMatch[1].toLowerCase(),
        attributes: {},
        selfClosing: false
      });
      continue;
    }

    const openMatch = /^<\s*([A-Za-z_:][-A-Za-z0-9_:.]*)([\s\S]*?)\s*(\/?)>$/.exec(rawTag);
    if (!openMatch) {
      continue;
    }

    tokens.push({
      type: 'open',
      tagName: openMatch[1].toLowerCase(),
      attributes: parseAttributes(openMatch[2] ?? ''),
      selfClosing: openMatch[3] === '/'
    });
  }

  return tokens;
}

function createEntityNode(attributes: Record<string, string | undefined>): FetchXmlEntityNode {
  const name = normalizeName(attributes.name);
  if (!name) {
    throw new Error('FetchXML entity is missing a name attribute.');
  }

  return {
    kind: 'entity',
    name,
    alias: normalizeName(attributes.alias),
    attributes: [],
    filters: [],
    linkEntities: []
  };
}

function createLinkEntityNode(attributes: Record<string, string | undefined>): FetchXmlLinkEntityNode {
  const name = normalizeName(attributes.name);
  if (!name) {
    throw new Error('FetchXML link-entity is missing a name attribute.');
  }

  return {
    kind: 'link-entity',
    name,
    alias: normalizeName(attributes.alias),
    from: normalizeName(attributes.from),
    to: normalizeName(attributes.to),
    linkType: normalizeName(attributes['link-type']),
    attributes: [],
    filters: [],
    linkEntities: []
  };
}

function createAttributeNode(attributes: Record<string, string | undefined>): FetchXmlAttributeNode {
  const name = normalizeName(attributes.name);
  if (!name) {
    throw new Error('FetchXML attribute is missing a name attribute.');
  }

  return {
    kind: 'attribute',
    name,
    alias: normalizeName(attributes.alias)
  };
}

function createFilterNode(attributes: Record<string, string | undefined>): FetchXmlFilterNode {
  const rawType = normalizeName(attributes.type)?.toLowerCase();
  const type = rawType === 'and' || rawType === 'or' ? rawType : undefined;

  return {
    kind: 'filter',
    type,
    conditions: [],
    childFilters: []
  };
}

function createConditionNode(attributes: Record<string, string | undefined>): FetchXmlConditionNode {
  const directValue = normalizeName(attributes.value);

  return {
    kind: 'condition',
    attribute: normalizeName(attributes.attribute),
    operator: normalizeName(attributes.operator)?.toLowerCase(),
    values: directValue ? [directValue] : [],
    entityName: normalizeName(attributes.entityname)
  };
}

function getCurrentContainer(stack: NodeContext[]): NodeContext | undefined {
  return stack[stack.length - 1];
}

function attachAttribute(node: FetchXmlAttributeNode, stack: NodeContext[]): void {
  const current = getCurrentContainer(stack);
  if (!current || (current.kind !== 'entity' && current.kind !== 'link-entity')) {
    throw new Error('FetchXML attribute found outside entity/link-entity scope.');
  }

  current.node.attributes.push(node);
}

function attachFilter(node: FetchXmlFilterNode, stack: NodeContext[]): void {
  const current = getCurrentContainer(stack);
  if (!current) {
    throw new Error('FetchXML filter found outside supported scope.');
  }

  if (current.kind === 'entity' || current.kind === 'link-entity') {
    current.node.filters.push(node);
    return;
  }

  if (current.kind === 'filter') {
    current.node.childFilters.push(node);
    return;
  }

  throw new Error('FetchXML filter found in invalid scope.');
}

function attachCondition(node: FetchXmlConditionNode, stack: NodeContext[]): void {
  const current = getCurrentContainer(stack);
  if (!current || current.kind !== 'filter') {
    throw new Error('FetchXML condition found outside filter scope.');
  }

  current.node.conditions.push(node);
}

function attachLinkEntity(node: FetchXmlLinkEntityNode, stack: NodeContext[]): void {
  const current = getCurrentContainer(stack);
  if (!current || (current.kind !== 'entity' && current.kind !== 'link-entity')) {
    throw new Error('FetchXML link-entity found outside entity/link-entity scope.');
  }

  current.node.linkEntities.push(node);
}

function pushConditionValue(text: string, stack: NodeContext[]): void {
  const trimmed = decodeXmlText(text.trim());
  if (!trimmed) {
    return;
  }

  const current = getCurrentContainer(stack);
  if (!current || current.kind !== 'condition') {
    return;
  }

  current.node.values.push(trimmed);
}

export function parseFetchXml(fetchXml: string): FetchXmlDocumentNode {
  const trimmed = fetchXml.trim();
  if (!trimmed) {
    throw new Error('FetchXML is empty.');
  }

  const fetchMatch = /<fetch\b([^>]*)>/i.exec(trimmed);
  if (!fetchMatch) {
    throw new Error('FetchXML does not contain a <fetch> root element.');
  }

  const documentNode: FetchXmlDocumentNode = {
    kind: 'document',
    fetchAttributes: parseAttributes(fetchMatch[1] ?? ''),
    rootEntity: undefined as unknown as FetchXmlEntityNode
  };

  const tokens = tokenizeFetchXml(trimmed);
  const stack: NodeContext[] = [];
  let currentConditionCapturingValues = false;
  let lastIndex = 0;
  const tagPattern = /<\/?[^>]+>/g;
  let tagMatch: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((tagMatch = tagPattern.exec(trimmed)) !== null) {
    const textBetween = trimmed.slice(lastIndex, tagMatch.index);
    if (currentConditionCapturingValues) {
      pushConditionValue(textBetween, stack);
    }

    lastIndex = tagPattern.lastIndex;
    const token = tokens[tokenIndex++];
    if (!token) {
      continue;
    }

    if (token.type === 'close') {
      const closeTag = token.tagName;

      // Ignore non-structural tags
      if (closeTag === 'fetch' || closeTag === 'value') {
        continue;
      }

      const current = stack.pop();
      if (!current) {
        throw new Error(`Unexpected closing tag </${closeTag}> in FetchXML.`);
      }

      const expected = getExpectedCloseTagName(current);
      if (expected !== closeTag) {
        throw new Error(
          `Mismatched closing tag </${closeTag}> in FetchXML. Expected </${expected}>.`
        );
      }

      if (closeTag === 'condition') {
        currentConditionCapturingValues = false;
      }

      continue;
    }

    switch (token.tagName) {
      case 'fetch':
        break;
      case 'entity': {
        const entity = createEntityNode(token.attributes);
        documentNode.rootEntity = entity;
        if (!token.selfClosing) {
          stack.push({ kind: 'entity', node: entity });
        }
        break;
      }
      case 'attribute': {
        attachAttribute(createAttributeNode(token.attributes), stack);
        break;
      }
      case 'filter': {
        const filter = createFilterNode(token.attributes);
        attachFilter(filter, stack);
        if (!token.selfClosing) {
          stack.push({ kind: 'filter', node: filter });
        }
        break;
      }
      case 'condition': {
        const condition = createConditionNode(token.attributes);
        attachCondition(condition, stack);
        if (!token.selfClosing) {
          stack.push({ kind: 'condition', node: condition });
          currentConditionCapturingValues = true;
        }
        break;
      }
      case 'value':
        break;
      case 'link-entity': {
        const linkEntity = createLinkEntityNode(token.attributes);
        attachLinkEntity(linkEntity, stack);
        if (!token.selfClosing) {
          stack.push({ kind: 'link-entity', node: linkEntity });
        }
        break;
      }
      default:
        break;
    }
  }

  if (currentConditionCapturingValues) {
    pushConditionValue(trimmed.slice(lastIndex), stack);
  }

  if (!documentNode.rootEntity) {
    throw new Error('FetchXML does not contain an <entity> definition.');
  }

  if (stack.length > 0) {
    const current = stack[stack.length - 1];
    throw new Error(`Malformed FetchXML: missing closing tag </${getExpectedCloseTagName(current)}>.`);
  }

  return documentNode;
}
