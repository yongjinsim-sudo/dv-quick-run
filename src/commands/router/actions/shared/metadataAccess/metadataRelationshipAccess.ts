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
  const forceRefresh = options?.forceRefresh === true;
  const memory = relationshipMemory.get(key);
  if (!forceRefresh && memory) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = !forceRefresh ? getCachedEntityRelationships(ctx.ext, envName, logicalName) : undefined;
  if (cached) {
    relationshipMemory.set(key, cached);
    appendOutput(ctx, `Relationship metadata cache hit for ${logicalName}.`, options);
    return cached;
  }

  const fetchAndCache = async () => {
    const fetched = await runMetadataLoad(
      forceRefresh
        ? `DV Quick Run: Refreshing relationship metadata for ${logicalName}...`
        : `DV Quick Run: Loading relationship metadata for ${logicalName}...`,
      async () => await fetchEntityRelationships(client, token, logicalName),
      options
    );

    await setCachedEntityRelationships(ctx.ext, envName, logicalName, fetched);
    relationshipMemory.set(key, fetched);
    appendOutput(ctx, `Relationship metadata ${forceRefresh ? "refreshed" : "fetched"} for ${logicalName}.`, options);
    return fetched;
  };

  if (forceRefresh) {
    return await fetchAndCache();
  }

  return await getOrCreateRelationshipInFlight(logicalName, fetchAndCache);
}

export function clearRelationshipMetadataMemory(): void {
  relationshipMemory.clear();
  relationshipInFlight.clear();
}
