import type { FieldDef } from "../services/entityFieldMetadataService.js";
import { toSelectableFields } from "../commands/router/actions/shared/selectableFields.js";

export type HoverSelectableField = ReturnType<typeof toSelectableFields>[number];

export type HoverFieldContext = {
  fields: FieldDef[];
  selectable: HoverSelectableField[];
  fieldByLogicalName: Map<string, FieldDef>;
  selectableByLogicalName: Map<string, HoverSelectableField>;
  selectableByToken: Map<string, HoverSelectableField>;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

const hoverFieldContextCache = new Map<string, HoverFieldContext>();

export function buildHoverFieldContext(fields: FieldDef[]): HoverFieldContext {
  const selectable = toSelectableFields(fields);

  return {
    fields,
    selectable,
    fieldByLogicalName: new Map(
      fields.map((field) => [normalizeWord(field.logicalName), field])
    ),
    selectableByLogicalName: new Map(
      selectable.map((field) => [normalizeWord(field.logicalName), field])
    ),
    selectableByToken: new Map(
      selectable.map((field) => [normalizeWord(field.selectToken ?? ""), field])
    )
  };
}

export function getCachedHoverFieldContext(logicalName: string): HoverFieldContext | undefined {
  return hoverFieldContextCache.get(normalizeKey(logicalName));
}

export function setCachedHoverFieldContext(
  logicalName: string,
  context: HoverFieldContext
): void {
  hoverFieldContextCache.set(normalizeKey(logicalName), context);
}

export function clearHoverFieldContextCache(): void {
  hoverFieldContextCache.clear();
}