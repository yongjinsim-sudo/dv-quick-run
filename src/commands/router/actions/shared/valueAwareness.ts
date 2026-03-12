import type { ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
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

export function findChoiceMetadataForField(
  values: ChoiceMetadataDef[],
  fieldLogicalName: string
): ChoiceMetadataDef | undefined {
  const target = normalizeName(fieldLogicalName);
  return values.find((item) => normalizeName(item.fieldLogicalName) === target);
}

export function resolveChoiceValueFromMetadata(
  values: ChoiceMetadataDef[],
  fieldLogicalName: string,
  rawValue: string | number | boolean
): ResolvedChoiceValue | undefined {
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

export function matchChoiceLabelFromMetadata(
  values: ChoiceMetadataDef[],
  fieldLogicalName: string,
  rawLabel: string
): ResolvedChoiceValue | undefined {
  const metadata = findChoiceMetadataForField(values, fieldLogicalName);
  if (!metadata) {
    return undefined;
  }

  const normalized = normalizeChoiceLabel(rawLabel.replace(/^'+|'+$/g, ""));
  const option = metadata.options.find((item) => item.normalizedLabel === normalized);
  return option ? { metadata, option } : undefined;
}