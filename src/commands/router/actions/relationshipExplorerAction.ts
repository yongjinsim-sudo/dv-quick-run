import * as vscode from "vscode";
import type { CommandContext } from "../../context/commandContext.js";
import { fetchEntityRelationships } from "../../../services/entityRelationshipExplorerService.js";
import {
  findEntityByEntitySetName,
  findEntityByLogicalName,
  loadEntityDefs,
  loadFields
} from "./shared/metadataAccess.js";
import { getSelectableFields } from "./shared/selectableFields.js";
import {
  getCachedEntityRelationships,
  setCachedEntityRelationships
} from "../../../utils/entityRelationshipExplorerCache.js";
import {
  getEntitySetNameFromEditorQuery,
  parseEditorQuery
} from "./shared/queryMutation/parsedEditorQuery.js";

type RelationshipDisplay = {
  navigationPropertyName: string;
  relationshipType: "manyToOne" | "oneToMany" | "manyToMany";
  targetLogicalName?: string;
  targetEntitySetName?: string;
  referencingAttribute?: string;
  schemaName?: string;
  exampleExpand: string;
  suggestedFields?: string[];
};

function pickPreferredExampleField(fieldLogicalNames: string[]): string | undefined {
  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));

  return (
    lowered.get("fullname") ??
    lowered.get("name") ??
    lowered.get("subject") ??
    lowered.get("title") ??
    lowered.get("accountnumber") ??
    lowered.get("emailaddress1") ??
    fieldLogicalNames[0]
  );
}

async function buildRelationshipDisplay(
  ctx: CommandContext,
  logicalName: string,
  entitySetName: string,
  defs: Awaited<ReturnType<typeof loadEntityDefs>>,
  rel: {
    navigationPropertyName: string;
    referencedEntity?: string;
    targetEntity?: string;
    referencingAttribute?: string;
    schemaName?: string;
  },
  relationshipType: "manyToOne" | "oneToMany" | "manyToMany",
  token: string,
  client: ReturnType<CommandContext["getClient"]>
): Promise<RelationshipDisplay> {
  const targetLogicalName =
    rel.referencedEntity?.trim() ||
    rel.targetEntity?.trim() ||
    undefined;
  let suggestedFields: string[] | undefined;
  let targetEntitySetName: string | undefined;
  let exampleField: string | undefined;

  if (targetLogicalName) {
    const targetDef = findEntityByLogicalName(defs, targetLogicalName);
    targetEntitySetName = targetDef?.entitySetName;

    try {
      const targetFields = await loadFields(ctx, client, token, targetLogicalName);
      const selectable = getSelectableFields(targetFields);
      const fieldLogicalNames = selectable.map((f) => f.logicalName).filter(Boolean);
      suggestedFields = fieldLogicalNames.slice(0, 5);
      exampleField = pickPreferredExampleField(fieldLogicalNames);
    } catch {
      // ignore enrichment failures
    }
  }

  const exampleExpand =
    relationshipType === "manyToOne" && exampleField
      ? `${entitySetName}?$expand=${rel.navigationPropertyName}($select=${exampleField})`
      : `${entitySetName}?$expand=${rel.navigationPropertyName}`;

  return {
    navigationPropertyName: rel.navigationPropertyName,
    relationshipType,
    targetLogicalName,
    targetEntitySetName,
    referencingAttribute: rel.referencingAttribute,
    schemaName: rel.schemaName,
    exampleExpand,
    suggestedFields
  };
}

function buildExplorerText(
  entitySetName: string,
  logicalName: string,
  manyToOne: RelationshipDisplay[],
  oneToMany: RelationshipDisplay[],
  manyToMany: RelationshipDisplay[]
): string {
  const lines: string[] = [];

  lines.push(`Relationship Explorer: ${logicalName}`);
  lines.push(`Entity Set: ${entitySetName}`);
  lines.push("");

  lines.push(`Many-to-One (${manyToOne.length})`);
  lines.push("----------------------------------------");
  if (!manyToOne.length) {
    lines.push("(none)");
  } else {
    for (const item of manyToOne) {
      lines.push(`- ${item.navigationPropertyName}`);
      if (item.targetLogicalName) { lines.push(`  target logical: ${item.targetLogicalName}`); }
      if (item.targetEntitySetName) { lines.push(`  target entity set: ${item.targetEntitySetName}`); }
      if (item.referencingAttribute) { lines.push(`  lookup: ${item.referencingAttribute}`); }
      if (item.schemaName) { lines.push(`  schema: ${item.schemaName}`); }
      lines.push(`  example: ${item.exampleExpand}`);
      if (item.suggestedFields?.length) { lines.push(`  common fields: ${item.suggestedFields.join(", ")}`); }
      lines.push("");
    }
  }

  lines.push("");
  lines.push(`One-to-Many (${oneToMany.length})`);
  lines.push("----------------------------------------");
  if (!oneToMany.length) {
    lines.push("(none)");
  } else {
    for (const item of oneToMany) {
      lines.push(`- ${item.navigationPropertyName}`);
      if (item.targetLogicalName) { lines.push(`  target logical: ${item.targetLogicalName}`); }
      if (item.targetEntitySetName) { lines.push(`  target entity set: ${item.targetEntitySetName}`); }
      if (item.referencingAttribute) { lines.push(`  lookup: ${item.referencingAttribute}`); }
      if (item.schemaName) { lines.push(`  schema: ${item.schemaName}`); }
      lines.push(`  example: ${item.exampleExpand}`);
      if (item.suggestedFields?.length) { lines.push(`  common fields: ${item.suggestedFields.join(", ")}`); }
      lines.push("");
    }
  }

  lines.push("");
  lines.push(`Many-to-Many (${manyToMany.length})`);
  lines.push("----------------------------------------");
  if (!manyToMany.length) {
    lines.push("(none)");
  } else {
    for (const item of manyToMany) {
      lines.push(`- ${item.navigationPropertyName}`);
      if (item.targetLogicalName) { lines.push(`  target logical: ${item.targetLogicalName}`); }
      if (item.targetEntitySetName) { lines.push(`  target entity set: ${item.targetEntitySetName}`); }
      if (item.schemaName) { lines.push(`  schema: ${item.schemaName}`); }
      lines.push(`  example: ${item.exampleExpand}`);
      if (item.suggestedFields?.length) { lines.push(`  common fields: ${item.suggestedFields.join(", ")}`); }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function showRelationshipExplorerDocument(content: string, logicalName: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content
  });

  await vscode.window.showTextDocument(doc, {
    preview: false
  });
}

function tryGetEntitySetNameFromActiveEditor(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const lineText = editor.document.lineAt(editor.selection.active.line).text.trim();
  if (!lineText) {
    return undefined;
  }

  try {
    const parsed = parseEditorQuery(lineText);
    return getEntitySetNameFromEditorQuery(parsed.entityPath);
  } catch {
    return undefined;
  }
}

export async function runRelationshipExplorerAction(ctx: CommandContext): Promise<void> {
  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client = ctx.getClient();

  const defs = await loadEntityDefs(ctx, client, token);

  let logicalName: string | undefined;
  let entitySetName: string | undefined;

  const inferredEntitySetName = tryGetEntitySetNameFromActiveEditor();

  if (inferredEntitySetName) {
    const inferredEntity = findEntityByEntitySetName(defs, inferredEntitySetName);

    if (inferredEntity) {
      logicalName = inferredEntity.logicalName;
      entitySetName = inferredEntity.entitySetName;
    }
  }

  if (!logicalName || !entitySetName) {
    const picked = await vscode.window.showQuickPick(
      defs.map((d) => ({
        label: d.logicalName,
        description: d.entitySetName
      })),
      {
        placeHolder: "Select entity for Relationship Explorer"
      }
    );

    if (!picked) {
      return;
    }

    logicalName = picked.label;
    entitySetName = picked.description ?? picked.label;
  }

  const envName = ctx.envContext.getEnvironmentName();

  let relationships = getCachedEntityRelationships(ctx.ext, envName, logicalName);

  if (!relationships) {
    relationships = await fetchEntityRelationships(client, token, logicalName);
    await setCachedEntityRelationships(ctx.ext, envName, logicalName, relationships);
  }

  const manyToOne = await Promise.all(
    relationships.manyToOne.map((rel) =>
      buildRelationshipDisplay(ctx, logicalName!, entitySetName!, defs, rel, "manyToOne", token, client)
    )
  );

  const oneToMany = await Promise.all(
    relationships.oneToMany.map((rel) =>
      buildRelationshipDisplay(ctx, logicalName!, entitySetName!, defs, rel, "oneToMany", token, client)
    )
  );

  const manyToMany = await Promise.all(
    relationships.manyToMany.map((rel) =>
      buildRelationshipDisplay(ctx, logicalName!, entitySetName!, defs, rel, "manyToMany", token, client)
    )
  );

  const content = buildExplorerText(
    entitySetName,
    logicalName,
    manyToOne,
    oneToMany,
    manyToMany
  );

  await showRelationshipExplorerDocument(content, logicalName);

}

async function promptExpandCopyAction(items: RelationshipDisplay[]): Promise<void> {
  const quickPickItems: vscode.QuickPickItem[] = items.map((rel) => ({
    label: rel.navigationPropertyName,
    description: rel.targetLogicalName
      ? `target: ${rel.targetLogicalName}${rel.targetEntitySetName ? ` (${rel.targetEntitySetName})` : ""}`
      : "target: unknown",
    detail: `$expand=${rel.exampleExpand.split("?$expand=")[1] ?? rel.navigationPropertyName}`
  }));

  if (!quickPickItems.length) {
    return;
  }

  const picked = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: "Copy $expand snippet",
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!picked) {
    return;
  }

  const snippet = picked.detail ?? `$expand=${picked.label}`;
  await vscode.env.clipboard.writeText(snippet);

  void vscode.window.showInformationMessage(`Copied to clipboard: ${snippet}`);
}