import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import {
  findEntityByEntitySetName,
  findEntityByLogicalName,
  loadEntityDefs,
  loadEntityRelationships
} from "../shared/metadataAccess.js";
import type {
  TraversalEntityNode,
  TraversalGraph,
  TraversalRelationshipEdge
} from "../shared/traversal/traversalTypes.js";
import type { TraversalEntityOption } from "./traversalActionTypes.js";

function mapManyToOneEdges(
  logicalName: string,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalRelationshipEdge[] {
  return relationships.manyToOne
    .filter((rel) => !!rel.navigationPropertyName && !!rel.referencedEntity)
    .map((rel) => ({
      fromEntity: logicalName,
      toEntity: rel.referencedEntity ?? "",
      navigationPropertyName: rel.navigationPropertyName,
      relationshipType: "ManyToOne",
      direction: "manyToOne" as const,
      schemaName: rel.schemaName,
      referencingAttribute: rel.referencingAttribute
    }));
}

function mapOneToManyEdges(
  logicalName: string,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalRelationshipEdge[] {
  return relationships.oneToMany
    .filter((rel) => !!rel.navigationPropertyName && !!rel.referencingEntity)
    .map((rel) => ({
      fromEntity: logicalName,
      toEntity: rel.referencingEntity ?? "",
      navigationPropertyName: rel.navigationPropertyName,
      relationshipType: "OneToMany",
      direction: "oneToMany" as const,
      schemaName: rel.schemaName,
      referencingAttribute: rel.referencingAttribute
    }));
}

function mapManyToManyEdges(
  logicalName: string,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalRelationshipEdge[] {
  return relationships.manyToMany
    .filter((rel) => !!rel.navigationPropertyName && !!rel.targetEntity)
    .map((rel) => ({
      fromEntity: logicalName,
      toEntity: rel.targetEntity ?? "",
      navigationPropertyName: rel.navigationPropertyName,
      relationshipType: "ManyToMany",
      direction: "manyToMany" as const,
      schemaName: rel.schemaName
    }));
}

function buildTraversalNode(
  option: TraversalEntityOption,
  relationships: Awaited<ReturnType<typeof loadEntityRelationships>>
): TraversalEntityNode {
  return {
    logicalName: option.logicalName,
    entitySetName: option.entitySetName,
    primaryIdAttribute: option.primaryIdAttribute,
    primaryNameAttribute: option.primaryNameAttribute,
    fieldLogicalNames: option.fieldLogicalNames ?? [],
    outboundRelationships: [
      ...mapManyToOneEdges(option.logicalName, relationships),
      ...mapOneToManyEdges(option.logicalName, relationships),
      ...mapManyToManyEdges(option.logicalName, relationships)
    ]
  };
}

export async function loadTraversalEntityOptions(
  ctx: CommandContext
): Promise<TraversalEntityOption[]> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const defs = await loadEntityDefs(ctx, client, token);

  return defs
    .map((def) => ({
      logicalName: def.logicalName,
      entitySetName: def.entitySetName,
      primaryIdAttribute: def.primaryIdAttribute,
      primaryNameAttribute: def.primaryNameAttribute,
      fieldLogicalNames: []
    }))
    .sort((left, right) => left.logicalName.localeCompare(right.logicalName));
}

export async function pickTraversalEntityOption(
  title: string,
  placeHolder: string,
  options: TraversalEntityOption[]
): Promise<TraversalEntityOption | undefined> {
  const picked = await vscode.window.showQuickPick(
    options.map((option) => ({
      label: option.logicalName,
      description: option.entitySetName,
      option
    })),
    {
      title,
      placeHolder,
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  return picked?.option;
}

export async function buildFocusedTraversalGraph(
  ctx: CommandContext,
  source: TraversalEntityOption,
  target: TraversalEntityOption
): Promise<TraversalGraph> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const defs = await loadEntityDefs(ctx, client, token);

  const entities: Record<string, TraversalEntityNode> = {};

  async function ensureEntityNode(logicalNameOrEntitySetName: string): Promise<void> {
    const byLogical = findEntityByLogicalName(defs, logicalNameOrEntitySetName);
    const byEntitySet = findEntityByEntitySetName(defs, logicalNameOrEntitySetName);
    const def = byLogical ?? byEntitySet;

    if (!def) {
      return;
    }

    const key = def.logicalName.trim().toLowerCase();
    if (entities[key]) {
      return;
    }

    const relationships = await loadEntityRelationships(ctx, client, token, def.logicalName);
    entities[key] = buildTraversalNode(
      {
        logicalName: def.logicalName,
        entitySetName: def.entitySetName,
        primaryIdAttribute: def.primaryIdAttribute,
        primaryNameAttribute: def.primaryNameAttribute,
        fieldLogicalNames: []
      },
      relationships
    );
  }

  await ensureEntityNode(source.logicalName);
  await ensureEntityNode(target.logicalName);

  const queue = [source.logicalName, target.logicalName];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const normalized = current.trim().toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    await ensureEntityNode(current);

    const node = entities[normalized];
    if (!node) {
      continue;
    }

    for (const edge of node.outboundRelationships) {
      if (!seen.has(edge.toEntity.toLowerCase())) {
        await ensureEntityNode(edge.toEntity);
      }
    }
  }

  return { entities };
}
