import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import {
  fetchEntityRelationships,
  type EntityRelationshipExplorerResult
} from "../../../../../services/entityRelationshipExplorerService.js";
import {
  getCachedEntityRelationships,
  setCachedEntityRelationships
} from "../../../../../utils/entityRelationshipExplorerCache.js";
import { appendOutput, MetadataLoadOptions, runMetadataLoad } from "./metadataAccessCommon.js";

const relationshipMemory = new Map<string, EntityRelationshipExplorerResult>();
const relationshipInFlight = new Map<string, Promise<EntityRelationshipExplorerResult>>();

function normalizeKey(logicalName: string): string {
  return logicalName.trim().toLowerCase();
}

async function getOrCreateRelationshipInFlight(
  logicalName: string,
  factory: () => Promise<EntityRelationshipExplorerResult>
): Promise<EntityRelationshipExplorerResult> {
  const key = normalizeKey(logicalName);
  const existing = relationshipInFlight.get(key);
  if (existing) {
    return existing;
  }

  const promise = factory().finally(() => {
    relationshipInFlight.delete(key);
  });

  relationshipInFlight.set(key, promise);
  return promise;
}

export async function loadEntityRelationships(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<EntityRelationshipExplorerResult> {
  const key = normalizeKey(logicalName);
  const memory = relationshipMemory.get(key);
  if (memory) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedEntityRelationships(ctx.ext, envName, logicalName);
  if (cached) {
    relationshipMemory.set(key, cached);
    appendOutput(ctx, `Relationship metadata cache hit for ${logicalName}.`, options);
    return cached;
  }

  return await getOrCreateRelationshipInFlight(logicalName, async () => {
    const fetched = await runMetadataLoad(
      `DV Quick Run: Loading relationship metadata for ${logicalName}...`,
      async () => await fetchEntityRelationships(client, token, logicalName),
      options
    );

    await setCachedEntityRelationships(ctx.ext, envName, logicalName, fetched);
    relationshipMemory.set(key, fetched);
    appendOutput(ctx, `Relationship metadata fetched for ${logicalName}.`, options);
    return fetched;
  });
}

export function clearRelationshipMetadataMemory(): void {
  relationshipMemory.clear();
  relationshipInFlight.clear();
}
