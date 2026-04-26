import * as vscode from "vscode";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { PatchFieldValue, SmartField, SmartPatchState } from "./smartPatchTypes.js";
import { isGuidLike, isPatchSupportedField } from "./smartPatchValueParser.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

export async function pickPatchEntity(defs: EntityDef[], preselectLogicalName?: string): Promise<EntityDef | undefined> {
  const items = defs.map((d) => ({
    label: d.entitySetName,
    description: d.logicalName,
    picked: preselectLogicalName ? d.logicalName === preselectLogicalName : false,
    def: d
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: "DV Quick Run: Smart PATCH — Pick table",
    placeHolder: "Type to filter (e.g. contact → contacts)",
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.def;
}

export async function getFieldsForPatchEntity(
  session: SmartMetadataSession,
  logicalName: string
): Promise<SmartField[]> {
  return session.getSmartFields(logicalName);
}

export async function promptPatchRecordId(pre?: string): Promise<string | undefined> {
  const id = (await vscode.window.showInputBox({
    title: "DV Quick Run: Smart PATCH — Record ID",
    prompt: "Enter record GUID (e.g. 7d29eec7-4414-f111-8341-6045bdc42f8b)",
    value: pre,
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {
        return "GUID is required";
      }
      return isGuidLike(t) ? undefined : "Enter a valid GUID";
    }
  }))?.trim();

  return id || undefined;
}

export async function pickPatchableFields(
  entitySetName: string,
  fields: SmartField[],
  preselected?: string[]
): Promise<SmartField[] | undefined> {
  const patchable = fields.filter(isPatchSupportedField);
  const pre = new Set((preselected ?? []).map((x) => x.toLowerCase()));

  const picked = await vscode.window.showQuickPick(
    patchable.map((f) => ({
      label: f.logicalName,
      description: f.attributeType,
      picked: pre.has(f.logicalName.toLowerCase()),
      field: f
    })),
    {
      title: `DV Quick Run: Smart PATCH — Fields (${entitySetName})`,
      placeHolder: "Pick fields to update (lookup fields excluded for now)",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  if (!picked || picked.length === 0) {
    return undefined;
  }

  return picked.map((p) => p.field);
}

function isBooleanField(field: SmartField): boolean {
  return String(field.attributeType ?? "").trim().toLowerCase() === "boolean";
}

function isChoiceLikeField(field: SmartField): boolean {
  const type = String(field.attributeType ?? "").trim().toLowerCase();
  return type === "picklist" || type === "state" || type === "status";
}

type PromptedPatchValue = {
  rawValue: string;
  displayValue?: string;
};

function formatChoiceDisplay(label: string, value: string | number | boolean): string {
  return `${label} (${String(value)})`;
}

function existingRawValue(existing?: PatchFieldValue): string | undefined {
  return existing?.setNull === true ? undefined : existing?.rawValue;
}

async function promptBooleanPatchValue(field: SmartField, existing?: PatchFieldValue): Promise<PromptedPatchValue | undefined> {
  const options = field.choiceOptions?.length
    ? field.choiceOptions.map((option) => ({
        label: option.label,
        description: String(option.value),
        rawValue: String(option.value),
        displayValue: formatChoiceDisplay(option.label, option.value)
      }))
    : [
        { label: "true", description: "Boolean true", rawValue: "true", displayValue: "true (true)" },
        { label: "false", description: "Boolean false", rawValue: "false", displayValue: "false (false)" }
      ];

  const picked = await vscode.window.showQuickPick(options.map((option) => ({
    ...option,
    picked: existingRawValue(existing)?.trim().toLowerCase() === option.rawValue.toLowerCase()
  })), {
    title: "DV Quick Run: Smart PATCH — Boolean value",
    placeHolder: `${field.logicalName} (${field.attributeType}) — choose true or false`,
    ignoreFocusOut: true
  });

  return picked ? { rawValue: picked.rawValue, displayValue: picked.displayValue } : undefined;
}

async function promptChoicePatchValue(field: SmartField, existing?: PatchFieldValue): Promise<PromptedPatchValue | undefined> {
  if (field.choiceOptions?.length) {
    const picked = await vscode.window.showQuickPick(field.choiceOptions.map((option) => ({
      label: option.label,
      description: String(option.value),
      rawValue: String(option.value),
      displayValue: formatChoiceDisplay(option.label, option.value),
      picked: existingRawValue(existing)?.trim() === String(option.value)
    })), {
      title: "DV Quick Run: Smart PATCH — Choice value",
      placeHolder: `${field.logicalName} (${field.attributeType}) — choose an option`,
      ignoreFocusOut: true,
      matchOnDescription: true
    });

    return picked ? { rawValue: picked.rawValue, displayValue: picked.displayValue } : undefined;
  }

  const raw = await vscode.window.showInputBox({
    title: "DV Quick Run: Smart PATCH — Choice value",
    prompt: `${field.logicalName} (${field.attributeType}) — metadata options are unavailable. Enter the numeric Dataverse option value only. Labels/text are not accepted.`,
    value: existingRawValue(existing),
    ignoreFocusOut: true,
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      return /^-?\d+$/.test(trimmed) ? undefined : "Choice fields require a numeric option value. Labels/text are not accepted.";
    }
  });

  const trimmed = raw?.trim();
  return trimmed ? { rawValue: trimmed, displayValue: `${trimmed} (numeric option)` } : undefined;
}

async function promptScalarPatchValue(field: SmartField, existing?: PatchFieldValue): Promise<PromptedPatchValue | undefined> {
  const raw = await vscode.window.showInputBox({
    title: "DV Quick Run: Smart PATCH — Value",
    prompt: `${field.logicalName} (${field.attributeType}) — use the separate "Set this field to null" action to clear a field.`,
    value: existingRawValue(existing),
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (value.trim() === "∅") {
        return "∅ is only a display symbol for Null. Use 'Set this field to null' to clear a field.";
      }
      return undefined;
    }
  });

  const trimmed = raw?.trim();
  return trimmed ? { rawValue: trimmed } : undefined;
}

export async function promptPatchValues(
  pickedFields: SmartField[],
  pre?: PatchFieldValue[]
): Promise<PatchFieldValue[] | undefined> {
  const preMap = new Map((pre ?? []).map((x) => [x.logicalName.toLowerCase(), x]));
  const values: PatchFieldValue[] = [];

  for (const f of pickedFields) {
    const existing = preMap.get(f.logicalName.toLowerCase());
    const raw = isBooleanField(f)
      ? await promptBooleanPatchValue(f, existing)
      : isChoiceLikeField(f)
        ? await promptChoicePatchValue(f, existing)
        : await promptScalarPatchValue(f, existing);

    if (raw === undefined) {
      return undefined;
    }

    const rawValue = raw.rawValue.trim();
    if (!rawValue) {
      continue;
    }

    values.push({
      logicalName: f.logicalName,
      attributeType: f.attributeType,
      rawValue,
      displayValue: raw.displayValue
    });
  }

  return values.length > 0 ? values : undefined;
}

function findPreselectedPatchEntity(defs: EntityDef[], pre?: SmartPatchState): EntityDef | undefined {
  const logicalName = pre?.entityLogicalName?.trim().toLowerCase();
  const entitySetName = pre?.entitySetName?.trim().toLowerCase();

  if (!logicalName && !entitySetName) {
    return undefined;
  }

  return defs.find((def) =>
    (!!logicalName && def.logicalName.toLowerCase() === logicalName) ||
    (!!entitySetName && def.entitySetName.toLowerCase() === entitySetName)
  );
}

export async function buildInitialSmartPatchState(
  session: SmartMetadataSession,
  pre?: SmartPatchState
): Promise<{ state: SmartPatchState; fields: SmartField[] } | undefined> {
  const defs = await session.getEntityDefs();
  const def = findPreselectedPatchEntity(defs, pre) ?? await pickPatchEntity(defs, pre?.entityLogicalName);
  if (!def) {
    return undefined;
  }

  const id = pre?.id?.trim() || await promptPatchRecordId(pre?.id);
  if (!id) {
    return undefined;
  }

  const fields = await getFieldsForPatchEntity(session, def.logicalName);
  const preselectedFieldNames = pre?.fields?.map((x) => x.logicalName) ?? [];
  const preselectedFieldSet = new Set(preselectedFieldNames.map((name) => name.toLowerCase()));

  const pickedFields = preselectedFieldSet.size > 0
    ? fields
        .filter((field) => preselectedFieldSet.has(field.logicalName.toLowerCase()))
        .filter(isPatchSupportedField)
    : await pickPatchableFields(
        def.entitySetName,
        fields,
        preselectedFieldNames
      );
  if (!pickedFields || pickedFields.length === 0) {
    return undefined;
  }

  const values = pre?.fields?.length && pre.fields.every((field) => field.setNull === true)
    ? pre.fields
    : await promptPatchValues(pickedFields, pre?.fields);
  if (!values) {
    return undefined;
  }

  const state: SmartPatchState = {
    entityLogicalName: def.logicalName,
    entitySetName: def.entitySetName,
    id,
    fields: values,
    ifMatch: pre?.ifMatch ?? "*",
    refreshSourceTarget: pre?.refreshSourceTarget
  };

  return { state, fields };
}
