export type ExpandNode = {
  relationship: string;
  select?: string[];
  expand?: ExpandNode[];
  additionalOptions?: string[];
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function sortStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const items: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of input) {
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (character === delimiter && depth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function parseSelectOption(value: string): string[] {
  return sortStrings(value.split(","));
}

function parseExpandOption(value: string): ExpandNode[] {
  return parseExpandClause(value);
}

function parseExpandItem(item: string): ExpandNode | undefined {
  const trimmed = item.trim();
  if (!trimmed) {
    return undefined;
  }

  const openParen = trimmed.indexOf("(");
  if (openParen === -1) {
    return {
      relationship: trimmed,
      select: [],
      expand: [],
      additionalOptions: []
    };
  }

  const relationship = trimmed.slice(0, openParen).trim();
  if (!relationship) {
    return undefined;
  }

  const closeParen = trimmed.lastIndexOf(")");
  if (closeParen <= openParen) {
    return {
      relationship,
      select: [],
      expand: [],
      additionalOptions: []
    };
  }

  const inner = trimmed.slice(openParen + 1, closeParen).trim();
  const options = splitTopLevel(inner, ";");
  const select: string[] = [];
  const expand: ExpandNode[] = [];
  const additionalOptions: string[] = [];

  for (const option of options) {
    const equalsIndex = option.indexOf("=");
    if (equalsIndex === -1) {
      additionalOptions.push(option.trim());
      continue;
    }

    const key = option.slice(0, equalsIndex).trim().toLowerCase();
    const value = option.slice(equalsIndex + 1).trim();

    if (key === "$select") {
      select.push(...parseSelectOption(value));
      continue;
    }

    if (key === "$expand") {
      expand.push(...parseExpandOption(value));
      continue;
    }

    additionalOptions.push(option.trim());
  }

  return {
    relationship,
    select: sortStrings(select),
    expand: sortNodes(expand),
    additionalOptions: sortStrings(additionalOptions)
  };
}

function mergeNode(existing: ExpandNode, incoming: ExpandNode): ExpandNode {
  return {
    relationship: existing.relationship,
    select: sortStrings([...(existing.select ?? []), ...(incoming.select ?? [])]),
    expand: mergeExpandNodes(existing.expand ?? [], incoming.expand ?? []),
    additionalOptions: sortStrings([...(existing.additionalOptions ?? []), ...(incoming.additionalOptions ?? [])])
  };
}

function sortNodes(nodes: ExpandNode[]): ExpandNode[] {
  return [...nodes].sort((left, right) => left.relationship.localeCompare(right.relationship));
}

export function mergeExpandNodes(existingNodes: ExpandNode[], incomingNodes: ExpandNode[]): ExpandNode[] {
  const merged = new Map<string, ExpandNode>();

  for (const node of existingNodes) {
    merged.set(normalizeName(node.relationship), {
      relationship: node.relationship,
      select: sortStrings(node.select ?? []),
      expand: sortNodes(node.expand ?? []),
      additionalOptions: sortStrings(node.additionalOptions ?? [])
    });
  }

  for (const node of incomingNodes) {
    const key = normalizeName(node.relationship);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        relationship: node.relationship,
        select: sortStrings(node.select ?? []),
        expand: sortNodes(node.expand ?? []),
        additionalOptions: sortStrings(node.additionalOptions ?? [])
      });
      continue;
    }

    merged.set(key, mergeNode(existing, node));
  }

  return sortNodes(Array.from(merged.values()));
}

export function parseExpandClause(expand: string | undefined): ExpandNode[] {
  if (!expand?.trim()) {
    return [];
  }

  return splitTopLevel(expand, ",")
    .map((item) => parseExpandItem(item))
    .filter((node): node is ExpandNode => !!node);
}

export function serializeExpandNode(node: ExpandNode): string {
  const parts: string[] = [];
  const select = sortStrings(node.select ?? []);
  const expand = sortNodes(node.expand ?? []);
  const additionalOptions = sortStrings(node.additionalOptions ?? []);

  if (select.length) {
    parts.push(`$select=${select.join(",")}`);
  }

  if (expand.length) {
    parts.push(`$expand=${serializeExpandNodes(expand)}`);
  }

  parts.push(...additionalOptions);

  if (!parts.length) {
    return node.relationship;
  }

  return `${node.relationship}(${parts.join(";")})`;
}

export function serializeExpandNodes(nodes: ExpandNode[]): string {
  return sortNodes(nodes).map((node) => serializeExpandNode(node)).join(",");
}

export function applyExpand(existingExpand: string | undefined, request: ExpandNode): string {
  const existingNodes = parseExpandClause(existingExpand);
  const mergedNodes = mergeExpandNodes(existingNodes, [request]);
  return serializeExpandNodes(mergedNodes);
}
