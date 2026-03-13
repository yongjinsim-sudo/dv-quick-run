import * as vscode from "vscode";
import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import { EntityDef, getCachedEntityDefs, setCachedEntityDefs } from "../../../../../utils/entitySetCache.js";
import { fetchEntityDefs } from "../../../../../services/entityMetadataService.js";
import { getEntityDefsMemory, getOrCreateEntityDefsInFlight, setEntityDefsMemory } from "../metadataAccess/metadataSessionCache.js";
import { appendOutput, MetadataLoadOptions, normalizeMetadataName, runMetadataLoad } from "./metadataAccessCommon.js";

export async function loadEntityDefs(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  options?: MetadataLoadOptions
): Promise<EntityDef[]> {
  const memory = getEntityDefsMemory<EntityDef>();
  if (memory?.length) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedEntityDefs(ctx.ext, envName);
  if (cached?.length) {
    setEntityDefsMemory(cached);
    appendOutput(ctx, `Entity defs cache hit: ${cached.length} items.`, options);
    return cached;
  }

  try {
    return await getOrCreateEntityDefsInFlight<EntityDef>(async () => {
      const fetched = await runMetadataLoad<EntityDef[]>(
        "DV Quick Run: Loading Dataverse entity list...",
        async () => await fetchEntityDefs(client, token),
        options
      );

      await setCachedEntityDefs(ctx.ext, envName, fetched);
      setEntityDefsMemory(fetched);
      appendOutput(ctx, `Entity defs fetched: ${fetched.length} items.`, options);
      return fetched;
    });
  } catch (e: any) {
    appendOutput(ctx, `Entity defs fetch failed: ${e?.message ?? String(e)}`, options);

    const fallback: EntityDef[] = [
      { entitySetName: "accounts", logicalName: "account" },
      { entitySetName: "contacts", logicalName: "contact" },
      { entitySetName: "systemusers", logicalName: "systemuser" },
      { entitySetName: "businessunits", logicalName: "businessunit" },
      { entitySetName: "teams", logicalName: "team" },
      { entitySetName: "tasks", logicalName: "task" },
      { entitySetName: "incidents", logicalName: "incident" },
      { entitySetName: "opportunities", logicalName: "opportunity" },
      { entitySetName: "leads", logicalName: "lead" },
      { entitySetName: "queues", logicalName: "queue" },
      { entitySetName: "annotations", logicalName: "annotation" }
    ];

    if (!options?.silent) {
      vscode.window.showWarningMessage(
        "DV Quick Run: Could not load entity metadata. Using fallback table list."
      );
    }

    return fallback;
  }
}

export async function loadEntityDefByLogicalName(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<EntityDef | undefined> {
  const defs = await loadEntityDefs(ctx, client, token);
  return findEntityByLogicalName(defs, logicalName);
}

export async function loadEntityDefByEntitySetName(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  entitySetName: string
): Promise<EntityDef | undefined> {
  const defs = await loadEntityDefs(ctx, client, token);
  return findEntityByEntitySetName(defs, entitySetName);
}

export function findEntityByLogicalName(
  defs: EntityDef[],
  logicalName: string
): EntityDef | undefined {
  const ln = normalizeMetadataName(logicalName);
  return defs.find((d) => normalizeMetadataName(d.logicalName) === ln);
}

export function findEntityByEntitySetName(
  defs: EntityDef[],
  entitySetName: string
): EntityDef | undefined {
  const esn = normalizeMetadataName(entitySetName);
  return defs.find((d) => normalizeMetadataName(d.entitySetName) === esn);
}
