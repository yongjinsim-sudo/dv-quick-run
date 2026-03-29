import type {
  TraversalGraph,
  TraversalRelationshipEdge
} from "../traversal/traversalTypes.js";

type TraversalEntityNode = TraversalGraph["entities"][string];

const HUMAN_READABLE_FIELD_CANDIDATES = [
  "fullname",
  "name",
  "subject",
  "title",
  "displayname",
  "description"
];

export function isPolymorphicEntity(node: TraversalEntityNode): boolean {
  return node.logicalName === "principal";
}

export function isAttributeSelectable(
  node: TraversalEntityNode,
  attribute: string
): boolean {
  if (!attribute) {
    return false;
  }

  // Current traversal nodes do not yet carry full attribute metadata.
  // Fall back to fieldLogicalNames when available.
  if (Array.isArray(node.fieldLogicalNames) && node.fieldLogicalNames.length > 0) {
    return node.fieldLogicalNames.includes(attribute);
  }

  // Safe fallback for now until richer attribute metadata is wired through.
  return false;
}

export function getPreferredDisplayField(
  node: TraversalEntityNode
): string | undefined {
  if (isPolymorphicEntity(node)) {
    return undefined;
  }

  for (const candidate of HUMAN_READABLE_FIELD_CANDIDATES) {
    if (isAttributeSelectable(node, candidate)) {
      return candidate;
    }
  }

  if (
    node.primaryNameAttribute &&
    isAttributeSelectable(node, node.primaryNameAttribute)
  ) {
    return node.primaryNameAttribute;
  }

  return undefined;
}

export function buildSafeSelectFields(
  node: TraversalEntityNode,
  nextEdge?: TraversalRelationshipEdge
): string[] {
  const fields = new Set<string>();

  if (node.primaryIdAttribute) {
    fields.add(node.primaryIdAttribute);
  }

  const preferredDisplayField = getPreferredDisplayField(node);
  if (preferredDisplayField) {
    fields.add(preferredDisplayField);
  }

  if (nextEdge?.direction === "manyToOne" && nextEdge.referencingAttribute) {
    fields.add(nextEdge.referencingAttribute);
  }

  return [...fields];
}

export function toLookupValueFilterField(attributeName: string): string {
  const trimmed = attributeName.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("_") && trimmed.endsWith("_value")) {
    return trimmed;
  }

  return `_${trimmed}_value`;
}

export function buildPrimaryIdFilter(
  primaryIdAttribute: string | undefined,
  ids: string[]
): string | undefined {
  if (!primaryIdAttribute || !ids.length) {
    return undefined;
  }

  const expressions = ids.map((id) => `${primaryIdAttribute} eq ${quoteODataValue(id)}`);
  return `$filter=${expressions.join(" or ")}`;
}

export function quoteODataValue(value: string): string {
  const escaped = value.replace(/'/g, "''");
  return `'${escaped}'`;
}