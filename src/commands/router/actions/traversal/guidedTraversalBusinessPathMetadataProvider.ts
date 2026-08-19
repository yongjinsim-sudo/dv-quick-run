import type {
  BusinessPathMetadataProvider,
  BusinessPathMetadataRelationship
} from "../../../../core/businessPaths/index.js";
import type { CommandContext } from "../../../context/commandContext.js";
import {
  loadEntityDefs,
  loadEntityRelationships
} from "../shared/metadataAccess.js";

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Live metadata adapter used by Guided Traversal preference revalidation.
 *
 * Unlike the focused traversal graph, this adapter can resolve every hop in a
 * persisted route without requiring that hop to have been admitted to normal
 * Guided Traversal discovery first.
 */
export class GuidedTraversalBusinessPathMetadataProvider implements BusinessPathMetadataProvider {
  private tableNames?: Set<string>;
  private readonly relationshipCache = new Map<string, readonly BusinessPathMetadataRelationship[]>();

  public constructor(private readonly ctx: CommandContext) {}

  public async tableExists(logicalName: string): Promise<boolean> {
    if (!this.tableNames) {
      const client = this.ctx.getClient();
      const token = await this.ctx.getToken(this.ctx.getScope());
      const defs = await loadEntityDefs(this.ctx, client, token);
      this.tableNames = new Set(defs.map((item) => normalize(item.logicalName)));
    }
    return this.tableNames.has(normalize(logicalName));
  }

  public async relationshipsFrom(logicalName: string): Promise<readonly BusinessPathMetadataRelationship[]> {
    const key = normalize(logicalName);
    const cached = this.relationshipCache.get(key);
    if (cached) {
      return cached;
    }

    const client = this.ctx.getClient();
    const token = await this.ctx.getToken(this.ctx.getScope());
    const relationships = await loadEntityRelationships(this.ctx, client, token, logicalName);

    const mapped: BusinessPathMetadataRelationship[] = [
      ...relationships.manyToOne
        .filter((item) => Boolean(item.schemaName?.trim()) && Boolean(item.referencedEntity?.trim()))
        .map((item) => ({
          fromTable: logicalName,
          toTable: item.referencedEntity!,
          relationshipSchemaName: item.schemaName!,
          relationshipType: "ManyToOne" as const,
          navigationProperty: item.navigationPropertyName,
          ...(item.referencingAttribute ? { lookupAttribute: item.referencingAttribute } : {})
        })),
      ...relationships.oneToMany
        .filter((item) => Boolean(item.schemaName?.trim()) && Boolean(item.referencingEntity?.trim()))
        .map((item) => ({
          fromTable: logicalName,
          toTable: item.referencingEntity!,
          relationshipSchemaName: item.schemaName!,
          relationshipType: "OneToMany" as const,
          navigationProperty: item.navigationPropertyName,
          ...(item.referencingAttribute ? { lookupAttribute: item.referencingAttribute } : {})
        })),
      ...relationships.manyToMany
        .filter((item) => Boolean(item.schemaName?.trim()) && Boolean(item.targetEntity?.trim()))
        .map((item) => ({
          fromTable: logicalName,
          toTable: item.targetEntity!,
          relationshipSchemaName: item.schemaName!,
          relationshipType: "ManyToMany" as const,
          navigationProperty: item.navigationPropertyName,
          ...(item.intersectEntityName ? { intersectTable: item.intersectEntityName } : {})
        }))
    ];

    this.relationshipCache.set(key, mapped);
    return mapped;
  }
}
