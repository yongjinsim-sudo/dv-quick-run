import type { CommandContext } from "../../../context/commandContext.js";
import type { EntityDef } from "../../../../utils/entitySetCache.js";
import type { QuerySemanticModel } from "../../../../core/query/querySemanticModel.js";
import {
  buildQueryMetadataContext,
  validateLookupTargetDisplayFields,
  type LookupUnderstanding,
  type LookupRelationshipMetadata,
  type QueryMetadataContext
} from "../../../../core/metadata/lookupUnderstanding.js";
import {
  loadEntityDefs,
  loadEntityRelationships,
  loadFields
} from "./metadataAccess.js";

function allRelationships(result: Awaited<ReturnType<typeof loadEntityRelationships>>): LookupRelationshipMetadata[] {
  return [
    ...result.manyToOne.map((item) => ({ ...item, relationshipType: "ManyToOne" })),
    ...result.oneToMany.map((item) => ({ ...item, relationshipType: "OneToMany" }))
  ];
}

function allNavigationProperties(result: Awaited<ReturnType<typeof loadEntityRelationships>>): string[] {
  return [
    ...result.manyToOne.map((item) => item.navigationPropertyName),
    ...result.oneToMany.map((item) => item.navigationPropertyName),
    ...result.manyToMany.map((item) => item.navigationPropertyName)
  ];
}

async function validateTargetDisplayFields(
  ctx: CommandContext,
  lookup: LookupUnderstanding,
  options?: { forceRefresh?: boolean }
): Promise<LookupUnderstanding> {
  if (lookup.kind === "Owner") {
    return validateLookupTargetDisplayFields(lookup, new Map());
  }

  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const fieldEntries = await Promise.all(
    lookup.targetEntities.map(async (target) => {
      const fields = await loadFields(ctx, client, token, target.entityLogicalName, {
        silent: true,
        forceRefresh: options?.forceRefresh
      }).catch(() => []);
      return [target.entityLogicalName.trim().toLowerCase(), fields] as const;
    })
  );

  return validateLookupTargetDisplayFields(lookup, new Map(fieldEntries));
}

function replaceValidatedLookups(
  context: QueryMetadataContext,
  replacements: readonly LookupUnderstanding[]
): QueryMetadataContext {
  const byAttribute = new Map(
    replacements.map((lookup) => [lookup.attributeLogicalName.trim().toLowerCase(), lookup])
  );
  const replace = (lookup: LookupUnderstanding) =>
    byAttribute.get(lookup.attributeLogicalName.trim().toLowerCase()) ?? lookup;

  return {
    ...context,
    lookupUnderstandings: context.lookupUnderstandings.map(replace),
    referencedLookups: context.referencedLookups.map(replace)
  };
}

export async function resolveLookupTargetDisplayMetadata(
  ctx: CommandContext,
  lookup: LookupUnderstanding,
  options?: { forceRefresh?: boolean }
): Promise<LookupUnderstanding> {
  return validateTargetDisplayFields(ctx, lookup, options);
}

export async function resolveQueryMetadataContext(
  ctx: CommandContext,
  model: QuerySemanticModel,
  entity: EntityDef,
  options?: { forceRefresh?: boolean }
): Promise<QueryMetadataContext> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());
  const limitations: string[] = [];

  const [fieldsResult, relationshipsResult, defsResult] = await Promise.allSettled([
    loadFields(ctx, client, token, entity.logicalName, { silent: true, forceRefresh: options?.forceRefresh }),
    loadEntityRelationships(ctx, client, token, entity.logicalName, { silent: true, forceRefresh: options?.forceRefresh }),
    loadEntityDefs(ctx, client, token, { silent: true, forceRefresh: options?.forceRefresh })
  ]);

  if (fieldsResult.status === "rejected") {
    limitations.push(`Attribute metadata unavailable: ${fieldsResult.reason instanceof Error ? fieldsResult.reason.message : String(fieldsResult.reason)}`);
  }
  if (relationshipsResult.status === "rejected") {
    limitations.push(`Relationship metadata unavailable: ${relationshipsResult.reason instanceof Error ? relationshipsResult.reason.message : String(relationshipsResult.reason)}`);
  }
  if (defsResult.status === "rejected") {
    limitations.push("Target table display, entity-set, and primary-name metadata is incomplete.");
  }

  const relationships = relationshipsResult.status === "fulfilled" ? relationshipsResult.value : undefined;
  const context = buildQueryMetadataContext({
    model,
    environmentLabel: ctx.envContext.getEnvironmentName(),
    entityLogicalName: entity.logicalName,
    entitySetName: entity.entitySetName,
    fields: fieldsResult.status === "fulfilled" ? fieldsResult.value : undefined,
    relationships: relationships ? allRelationships(relationships) : undefined,
    allNavigationProperties: relationships ? allNavigationProperties(relationships) : undefined,
    entityDefinitions: defsResult.status === "fulfilled" ? defsResult.value : undefined,
    primaryIdAttribute: entity.primaryIdAttribute,
    limitations
  });

  if (!context.referencedLookups.length) {
    return context;
  }

  const validatedLookups = await Promise.all(
    context.referencedLookups.map((lookup) => validateTargetDisplayFields(ctx, lookup, options))
  );
  return replaceValidatedLookups(context, validatedLookups);
}
