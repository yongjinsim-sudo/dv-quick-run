import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import { fetchEntityNavigationProperties } from "../../../../../services/entityRelationshipMetadataService.js";
import { getCachedNavigationProperties, setCachedNavigationProperties } from "../../../../../utils/entityRelationshipCache.js";
import { EntityDef } from "../../../../../utils/entitySetCache.js";
import { getNavigationMemory, getOrCreateNavigationInFlight, setNavigationMemory } from "../metadataAccess/metadataSessionCache.js";
import { appendOutput, MetadataLoadOptions, normalizeMetadataName, runMetadataLoad } from "./metadataAccessCommon.js";
import { findEntityByLogicalName } from "./metadataEntityAccess.js";
import { findFieldByLogicalName, findFieldBySelectToken, loadFields } from "./metadataFieldAccess.js";

export type RelationshipHit = {
  navigationPropertyName: string;
  targetLogicalName: string;
};

export async function loadNavigationProperties(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<any[]> {
  const memory = getNavigationMemory<any>(logicalName);
  if (memory?.length) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedNavigationProperties(ctx.ext, envName, logicalName);
  if (cached?.length) {
    setNavigationMemory(logicalName, cached);
    appendOutput(
      ctx,
      `Navigation properties cache hit for ${logicalName}: ${cached.length} relationships.`,
      options
    );
    return cached;
  }

  return await getOrCreateNavigationInFlight<any>(logicalName, async () => {
    const fetched = await runMetadataLoad<any[]>(
      `DV Quick Run: Loading navigation properties for ${logicalName}...`,
      async () => await fetchEntityNavigationProperties(client, token, logicalName),
      options
    );

    await setCachedNavigationProperties(ctx.ext, envName, logicalName, fetched);
    setNavigationMemory(logicalName, fetched);
    appendOutput(
      ctx,
      `Navigation properties fetched for ${logicalName}: ${fetched.length} relationships.`,
      options
    );

    return fetched;
  });
}

export async function findFieldOnDirectlyRelatedEntity(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  defs: EntityDef[],
  baseLogicalName: string,
  fieldToken: string
): Promise<RelationshipHit | undefined> {
  const relationships = await loadNavigationProperties(ctx, client, token, baseLogicalName);

  for (const rel of relationships) {
    const navigationPropertyName = String(rel?.navigationPropertyName ?? "").trim();
    if (!navigationPropertyName) {
      continue;
    }

    const candidateTargets = [rel?.referencedEntity, rel?.referencingEntity]
      .map((value) => String(value ?? "").trim())
      .filter((value) => !!value);

    const targetLogicalName = candidateTargets.find(
      (value) => normalizeMetadataName(value) !== normalizeMetadataName(baseLogicalName)
    );

    if (!targetLogicalName) {
      continue;
    }

    const targetEntity =
      findEntityByLogicalName(defs, targetLogicalName) ??
      ({ logicalName: targetLogicalName } as EntityDef);

    const targetFields = await loadFields(ctx, client, token, targetEntity.logicalName);

    const found =
      findFieldByLogicalName(targetFields, fieldToken) ??
      findFieldBySelectToken(targetFields, fieldToken);

    if (found) {
      return {
        navigationPropertyName,
        targetLogicalName: targetEntity.logicalName
      };
    }
  }

  return undefined;
}
