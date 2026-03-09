import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { fetchEntityChoiceMetadata, type ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
import { getCachedChoiceMetadata, setCachedChoiceMetadata } from "../../../../utils/entityChoiceCache.js";
import { normalizeChoiceLabel } from "../../../../metadata/metadataModel.js";

export type ResolvedChoiceValue = {
  metadata: ChoiceMetadataDef;
  option: ChoiceMetadataDef["options"][number];
};

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeRawScalarValue(rawValue: string | number | boolean): number | boolean | undefined {
  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    return rawValue;
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^'.*'$/.test(trimmed)) {
    return normalizeRawScalarValue(trimmed.slice(1, -1).replace(/''/g, "'"));
  }

  const lowered = trimmed.toLowerCase();
  if (lowered === "true") {
    return true;
  }

  if (lowered === "false") {
    return false;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export async function loadChoiceMetadata(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<ChoiceMetadataDef[]> {
  const cached = getCachedChoiceMetadata(ctx.ext, logicalName);
  if (cached?.length) {
    ctx.output.appendLine(`Choice metadata cache hit for ${logicalName}: ${cached.length} fields.`);
    return cached;
  }

  const values = await vscode.window.withProgress<ChoiceMetadataDef[]>(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DV Quick Run: Loading choice metadata for ${logicalName}...`,
      cancellable: false
    },
    async () => await fetchEntityChoiceMetadata(client, token, logicalName)
  );

  await setCachedChoiceMetadata(ctx.ext, logicalName, values);
  ctx.output.appendLine(`Choice metadata fetched for ${logicalName}: ${values.length} fields.`);
  return values;
}

export function findChoiceMetadataForField(
  values: ChoiceMetadataDef[],
  fieldLogicalName: string
): ChoiceMetadataDef | undefined {
  const target = normalizeName(fieldLogicalName);
  return values.find((item) => normalizeName(item.fieldLogicalName) === target);
}

export async function resolveChoiceValue(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  fieldLogicalName: string,
  rawValue: string | number | boolean
): Promise<ResolvedChoiceValue | undefined> {
  const values = await loadChoiceMetadata(ctx, client, token, logicalName);
  const metadata = findChoiceMetadataForField(values, fieldLogicalName);
  if (!metadata) {
    return undefined;
  }

  const normalizedValue = normalizeRawScalarValue(rawValue);
  if (normalizedValue === undefined) {
    return undefined;
  }

  const option = metadata.options.find((item) => item.value === normalizedValue);
  return option ? { metadata, option } : undefined;
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
  const metadata = findChoiceMetadataForField(values, fieldLogicalName);
  if (!metadata) {
    return undefined;
  }

  const normalized = normalizeChoiceLabel(rawLabel.replace(/^'+|'+$/g, ""));
  const option = metadata.options.find((item) => item.normalizedLabel === normalized);
  return option ? { metadata, option } : undefined;
}
