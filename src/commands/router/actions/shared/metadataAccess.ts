import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";

import { getCachedEntityDefs, setCachedEntityDefs, EntityDef } from "../../../../utils/entitySetCache.js";
import { fetchEntityDefs } from "../../../../services/entityMetadataService.js";

import { getCachedFields, setCachedFields } from "../../../../utils/entityFieldCache.js";
import { fetchEntityFields, FieldDef } from "../../../../services/entityFieldMetadataService.js";

export async function loadEntityDefs(
  ctx: CommandContext,
  client: DataverseClient,
  token: string
): Promise<EntityDef[]> {
  const cached = getCachedEntityDefs(ctx.ext);
  if (cached?.length) {
    ctx.output.appendLine(`Entity defs cache hit: ${cached.length} items.`);
    return cached;
  }

  try {
    const defs = await vscode.window.withProgress<EntityDef[]>(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DV Quick Run: Loading Dataverse entity list...",
        cancellable: false
      },
      async () => await fetchEntityDefs(client, token)
    );

    await setCachedEntityDefs(ctx.ext, defs);
    ctx.output.appendLine(`Entity defs fetched: ${defs.length} items.`);
    return defs;
  } catch (e: any) {
    ctx.output.appendLine(`Entity defs fetch failed: ${e?.message ?? String(e)}`);

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

    vscode.window.showWarningMessage(
      "DV Quick Run: Could not load entity metadata. Using fallback table list."
    );

    return fallback;
  }
}

export async function loadFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<FieldDef[]> {
  const cached = getCachedFields(ctx.ext, logicalName);
  if (cached?.length) {
    ctx.output.appendLine(`Fields cache hit for ${logicalName}: ${cached.length} fields.`);
    return cached;
  }

  const fields = await vscode.window.withProgress<FieldDef[]>(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DV Quick Run: Loading fields for ${logicalName}...`,
      cancellable: false
    },
    async () => await fetchEntityFields(client, token, logicalName)
  );

  await setCachedFields(ctx.ext, logicalName, fields);
  ctx.output.appendLine(`Fields fetched for ${logicalName}: ${fields.length} fields.`);
  return fields;
}

export function findEntityByLogicalName(
  defs: EntityDef[],
  logicalName: string
): EntityDef | undefined {
  const ln = logicalName.trim().toLowerCase();
  return defs.find((d) => d.logicalName.trim().toLowerCase() === ln);
}

export function findEntityByEntitySetName(
  defs: EntityDef[],
  entitySetName: string
): EntityDef | undefined {
  const esn = entitySetName.trim().toLowerCase();
  return defs.find((d) => d.entitySetName.trim().toLowerCase() === esn);
}