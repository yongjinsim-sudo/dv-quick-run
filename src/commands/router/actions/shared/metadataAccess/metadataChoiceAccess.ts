import * as vscode from "vscode";
import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import { fetchEntityChoiceMetadata, type ChoiceMetadataDef } from "../../../../../services/entityChoiceMetadataService.js";
import { getCachedChoiceMetadata, setCachedChoiceMetadata } from "../../../../../utils/entityChoiceCache.js";
import { getChoiceMemory, getOrCreateChoiceInFlight, setChoiceMemory } from "../metadataAccess/metadataSessionCache.js";
import { appendOutput, MetadataLoadOptions } from "./metadataAccessCommon.js";
import {
  matchChoiceLabelFromMetadata,
  resolveChoiceValueFromMetadata,
  type ResolvedChoiceValue
} from "../valueAwareness.js";

export async function resolveChoiceValue(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  fieldLogicalName: string,
  rawValue: string | number | boolean
): Promise<ResolvedChoiceValue | undefined> {
  const values = await loadChoiceMetadata(ctx, client, token, logicalName);
  return resolveChoiceValueFromMetadata(values, fieldLogicalName, rawValue);
}

export async function matchChoiceLabel(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  fieldLogicalName: string,
  rawLabel: string
): Promise<ResolvedChoiceValue | undefined> {
  const values = await loadChoiceMetadata(ctx, client, token, logicalName);
  return matchChoiceLabelFromMetadata(values, fieldLogicalName, rawLabel);
}

export async function loadChoiceMetadata(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<ChoiceMetadataDef[]> {
  const memory = getChoiceMemory<ChoiceMetadataDef>(logicalName);
  if (memory?.length) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedChoiceMetadata(ctx.ext, envName, logicalName);
  if (cached?.length) {
    setChoiceMemory(logicalName, cached);
    appendOutput(
      ctx,
      `Choice metadata cache hit for ${logicalName}: ${cached.length} fields.`,
      options
    );
    return cached;
  }

  return await getOrCreateChoiceInFlight<ChoiceMetadataDef>(logicalName, async () => {
    const fetched = options?.silent
      ? await fetchEntityChoiceMetadata(client, token, logicalName)
      : await vscode.window.withProgress<ChoiceMetadataDef[]>(
          {
            location: vscode.ProgressLocation.Notification,
            title: `DV Quick Run: Loading choice metadata for ${logicalName}...`,
            cancellable: false
          },
          async () => await fetchEntityChoiceMetadata(client, token, logicalName)
        );

    await setCachedChoiceMetadata(ctx.ext, envName, logicalName, fetched);
    setChoiceMemory(logicalName, fetched);
    appendOutput(
      ctx,
      `Choice metadata fetched for ${logicalName}: ${fetched.length} fields.`,
      options
    );

    return fetched;
  });
}
