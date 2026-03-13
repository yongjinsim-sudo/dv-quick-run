import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { loadFields } from "../shared/metadataAccess.js";
import { getSelectableFields } from "../shared/selectableFields.js";
import { buildLookupSelectToken } from "../../../../metadata/metadataModel.js";
import { SmartField } from "./smartGetTypes.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";

function selectTokenForField(f: SmartField): string | undefined {
  return buildLookupSelectToken(f.logicalName, f.attributeType);
}

function deriveAttributesVirtualUri(logicalName: string): vscode.Uri {
  const entity = logicalName.toLowerCase();
  return vscode.Uri.parse(`dvqr:/.dvqr/${entity}/${entity}.attributes.json`);
}

function tryParseFieldsFromOpenAttributesDoc(logicalName: string): SmartField[] | undefined {
  const uri = deriveAttributesVirtualUri(logicalName);
  const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (!doc) {return undefined;}

  try {
    const json = JSON.parse(doc.getText());
    const value = Array.isArray(json?.value) ? json.value : undefined;
    if (!value) {return undefined;}

    const fields: SmartField[] = value
      .map((x: any): SmartField => ({
        logicalName: String(x?.LogicalName ?? ""),
        attributeType: String(x?.AttributeType ?? ""),
        isValidForRead: typeof x?.IsValidForRead === "boolean" ? x.IsValidForRead : undefined,
        selectToken: undefined
      }))
      .filter((f: SmartField) => !!f.logicalName);

    for (const f of fields) {
      f.selectToken = selectTokenForField(f);
    }

    return fields.filter((f) => !!f.selectToken);
  } catch {
    return undefined;
  }
}

export async function pickSmartGetEntity(defs: EntityDef[], preselectLogicalName?: string): Promise<EntityDef | undefined> {
  const items = defs.map((d) => ({
    label: d.entitySetName,
    description: d.logicalName,
    picked: preselectLogicalName ? d.logicalName === preselectLogicalName : false,
    def: d
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: "DV Quick Run: Pick table",
    placeHolder: "Type to filter (e.g. contact → contacts)",
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });

  return picked?.def;
}

export async function getFieldsForEntity(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  session?: SmartMetadataSession
): Promise<SmartField[]> {
  const fromOpenDoc = tryParseFieldsFromOpenAttributesDoc(logicalName);
  if (fromOpenDoc?.length) {
    return fromOpenDoc;
  }

  if (session) {
    return session.getSmartFields(logicalName);
  }

  const fields = await loadFields(ctx, client, token, logicalName);

  return getSelectableFields(fields).map((f) => ({
    logicalName: f.logicalName,
    attributeType: f.attributeType,
    isValidForRead: f.isValidForRead,
    selectToken: f.selectToken
  }));
}

export async function pickSmartGetFields(
  def: EntityDef,
  fields: SmartField[],
  preselectedLogicalNames?: string[]
): Promise<SmartField[] | undefined> {
  const pre = new Set((preselectedLogicalNames ?? []).map((x) => x.toLowerCase()));

  const selectableFields = fields
    .filter((f) => !!f.selectToken)
    .map((f) => ({
      field: f,
      logicalNameLower: f.logicalName.toLowerCase()
    }))
    .sort((a, b) => a.logicalNameLower.localeCompare(b.logicalNameLower));

  const picked = await vscode.window.showQuickPick(
    selectableFields.map(({ field, logicalNameLower }) => ({
      label: field.logicalName,
      description: field.attributeType || "",
      detail: `$select token: ${field.selectToken}`,
      picked: pre.has(logicalNameLower),
      field
    })),
    {
      title: `DV Quick Run: Fields (${def.entitySetName})`,
      placeHolder: "Pick fields (multi-select). Type to filter.",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {return undefined;}
  return picked.map((p) => p.field);
}
