import * as vscode from "vscode";
import type { CommandContext } from "../../context/commandContext.js";

import { fetchEntityDefs } from "../../../services/entityMetadataService.js";
import { fetchEntityRelationships } from "../../../services/entityRelationshipExplorerService.js";
import {
  getCachedEntityDefs,
  setCachedEntityDefs,
  type EntityDef
} from "../../../utils/entitySetCache.js";
import {
  getCachedEntityRelationships,
  setCachedEntityRelationships
} from "../../../utils/entityRelationshipExplorerCache.js";
import {
  getEntitySetNameFromEditorQuery,
  parseEditorQuery
} from "./shared/queryMutation/parsedEditorQuery.js";

async function loadEntityDefs(ctx: CommandContext): Promise<EntityDef[]> {
  const cached = getCachedEntityDefs(ctx.ext);
  if (cached?.length) {
    return cached;
  }

  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope(baseUrl);
  const token = await ctx.getToken(scope);
  const client = ctx.getClient(baseUrl);

  const defs = await fetchEntityDefs(client, token);
  await setCachedEntityDefs(ctx.ext, defs);
  return defs;
}

function buildExplorerText(
  entitySetName: string,
  logicalName: string,
  data: Awaited<ReturnType<typeof fetchEntityRelationships>>
): string {
  const lines: string[] = [];

  lines.push(`Relationship Explorer: ${logicalName}`);
  lines.push(`Entity Set: ${entitySetName}`);
  lines.push("");

  lines.push(`Many-to-One (${data.manyToOne.length})`);
  lines.push("----------------------------------------");
  if (!data.manyToOne.length) {
    lines.push("(none)");
  } else {
    for (const item of data.manyToOne) {
      lines.push(`- ${item.navigationPropertyName}`);
      if (item.referencedEntity) {lines.push(`  target: ${item.referencedEntity}`);}
      if (item.referencingAttribute) {lines.push(`  lookup: ${item.referencingAttribute}`);}
      if (item.schemaName) {lines.push(`  schema: ${item.schemaName}`);}
      lines.push(`  example: ${entitySetName}?$expand=${item.navigationPropertyName}($select=name)`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push(`One-to-Many (${data.oneToMany.length})`);
  lines.push("----------------------------------------");
  if (!data.oneToMany.length) {
    lines.push("(none)");
  } else {
    for (const item of data.oneToMany) {
      lines.push(`- ${item.navigationPropertyName}`);
      if (item.referencedEntity) {lines.push(`  target: ${item.referencedEntity}`);}
      if (item.referencingAttribute) {lines.push(`  lookup: ${item.referencingAttribute}`);}
      if (item.schemaName) {lines.push(`  schema: ${item.schemaName}`);}
      lines.push(`  example: ${entitySetName}?$expand=${item.navigationPropertyName}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push(`Many-to-Many (${data.manyToMany.length})`);
  lines.push("----------------------------------------");
  if (!data.manyToMany.length) {
    lines.push("(none)");
  } else {
    for (const item of data.manyToMany) {
      lines.push(`- ${item.navigationPropertyName}`);
      if (item.targetEntity) {lines.push(`  target: ${item.targetEntity}`);}
      if (item.schemaName) {lines.push(`  schema: ${item.schemaName}`);}
      lines.push(`  example: ${entitySetName}?$expand=${item.navigationPropertyName}`);
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function findEntityByEntitySetName(
  defs: EntityDef[],
  entitySetName: string
): EntityDef | undefined {
  const target = normalize(entitySetName);
  return defs.find((d) => normalize(d.entitySetName) === target);
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
  const defs = await loadEntityDefs(ctx);

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

  let relationships = getCachedEntityRelationships(ctx.ext, logicalName);

  if (!relationships) {
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);
    const token = await ctx.getToken(scope);
    const client = ctx.getClient(baseUrl);

    relationships = await fetchEntityRelationships(client, token, logicalName);
    await setCachedEntityRelationships(ctx.ext, logicalName, relationships);
  }

  const content = buildExplorerText(entitySetName, logicalName, relationships);
  await showRelationshipExplorerDocument(content, logicalName);
  await promptExpandCopyAction(entitySetName, relationships);
}

async function promptExpandCopyAction(
  entitySetName: string,
  data: Awaited<ReturnType<typeof fetchEntityRelationships>>
): Promise<void> {

  const items: vscode.QuickPickItem[] = [];

  for (const rel of data.manyToOne) {
    items.push({
      label: rel.navigationPropertyName,
      description: `target: ${rel.referencedEntity ?? "unknown"}`,
      detail: `$expand=${rel.navigationPropertyName}($select=name)`
    });
  }

  for (const rel of data.oneToMany) {
    items.push({
      label: rel.navigationPropertyName,
      description: `target: ${rel.referencedEntity ?? "unknown"}`,
      detail: `$expand=${rel.navigationPropertyName}`
    });
  }

  for (const rel of data.manyToMany) {
    items.push({
      label: rel.navigationPropertyName,
      description: `target: ${rel.targetEntity ?? "unknown"}`,
      detail: `$expand=${rel.navigationPropertyName}`
    });
  }

  if (!items.length) {
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Copy $expand snippet",
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!picked) {
    return;
  }

  const snippet = picked.detail ?? `$expand=${picked.label}`;

  await vscode.env.clipboard.writeText(snippet);

  void vscode.window.showInformationMessage(
    `Copied to clipboard: ${snippet}`
  );
}