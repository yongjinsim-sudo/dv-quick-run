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

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }

  return value + " ".repeat(width - value.length);
}

type FocusedRelationship =
  | {
      relationshipType: "Many-to-One";
      navigationPropertyName: string;
      targetEntity?: string;
      lookupAttribute?: string;
      schemaName?: string;
    }
  | {
      relationshipType: "One-to-Many";
      navigationPropertyName: string;
      targetEntity?: string;
      lookupAttribute?: string;
      schemaName?: string;
    }
  | {
      relationshipType: "Many-to-Many";
      navigationPropertyName: string;
      targetEntity?: string;
      schemaName?: string;
    };

function getHoverLikeTokenUnderCursor(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const line = editor.document.lineAt(editor.selection.active.line).text;
  const position = editor.selection.active.character;

  const isTokenChar = (ch: string): boolean => /[$A-Za-z0-9_]/.test(ch);

  let start = position;
  let end = position;

  while (start > 0 && isTokenChar(line[start - 1])) {
    start--;
  }

  while (end < line.length && isTokenChar(line[end])) {
    end++;
  }

  if (start === end) {
    return undefined;
  }

  const token = line.slice(start, end).trim();
  return token || undefined;
}

function tryGetFocusedRelationship(
  token: string | undefined,
  data: Awaited<ReturnType<typeof fetchEntityRelationships>>
): FocusedRelationship | undefined {
  if (!token) {
    return undefined;
  }

  const normalizedToken = normalize(token);

  const m2o = data.manyToOne.find(
    (rel) => normalize(rel.navigationPropertyName) === normalizedToken
  );

  if (m2o) {
    return {
      relationshipType: "Many-to-One",
      navigationPropertyName: m2o.navigationPropertyName,
      targetEntity: m2o.referencedEntity,
      lookupAttribute: m2o.referencingAttribute,
      schemaName: m2o.schemaName
    };
  }

  const o2m = data.oneToMany.find(
    (rel) => normalize(rel.navigationPropertyName) === normalizedToken
  );

  if (o2m) {
    return {
      relationshipType: "One-to-Many",
      navigationPropertyName: o2m.navigationPropertyName,
      targetEntity: o2m.referencedEntity,
      lookupAttribute: o2m.referencingAttribute,
      schemaName: o2m.schemaName
    };
  }

  const m2m = data.manyToMany.find(
    (rel) => normalize(rel.navigationPropertyName) === normalizedToken
  );

  if (m2m) {
    return {
      relationshipType: "Many-to-Many",
      navigationPropertyName: m2m.navigationPropertyName,
      targetEntity: m2m.targetEntity,
      schemaName: m2m.schemaName
    };
  }

  return undefined;
}

function appendFocusedRelationshipSection(
  lines: string[],
  entitySetName: string,
  focused: FocusedRelationship
): void {
  lines.push("Focused Relationship");
  lines.push("--------------------");

  lines.push(
    `${focused.navigationPropertyName} → ${focused.targetEntity ?? "unknown"}`
  );
  lines.push("");

  lines.push(`Type: ${focused.relationshipType}`);

  if ("lookupAttribute" in focused && focused.lookupAttribute) {
    lines.push(`Lookup Column: ${focused.lookupAttribute}`);
  }

  if (focused.schemaName) {
    lines.push(`Schema Name: ${focused.schemaName}`);
  }

  lines.push("");
  lines.push("Example:");

  if (focused.relationshipType === "Many-to-One") {
    lines.push(
      `${entitySetName}?$expand=${focused.navigationPropertyName}($select=name)`
    );
  } else {
    lines.push(
      `${entitySetName}?$expand=${focused.navigationPropertyName}`
    );
  }

  lines.push("");
}

function buildGraphText(
  entitySetName: string,
  logicalName: string,
  data: Awaited<ReturnType<typeof fetchEntityRelationships>>,
  focusedRelationship?: FocusedRelationship
): string {
  const lines: string[] = [];

  lines.push("Relationship Graph");
  lines.push(`Entity: ${logicalName}`);
  lines.push(`Entity Set: ${entitySetName}`);
  lines.push("");

  if (focusedRelationship) {
    appendFocusedRelationshipSection(lines, entitySetName, focusedRelationship);
  }

  lines.push(logicalName);

  const hasM2O = data.manyToOne.length > 0;
  const hasO2M = data.oneToMany.length > 0;
  const hasM2M = data.manyToMany.length > 0;

  const sections = [
    { title: "Many-to-One", enabled: hasM2O },
    { title: "One-to-Many", enabled: hasO2M },
    { title: "Many-to-Many", enabled: hasM2M }
  ].filter((x) => x.enabled);

  const renderBranchPrefix = (index: number, total: number): string =>
    index === total - 1 ? "└─" : "├─";

  const renderChildPrefix = (parentIsLast: boolean, childIndex: number, childTotal: number): string => {
    const stem = parentIsLast ? "   " : "│  ";
    const branch = childIndex === childTotal - 1 ? "└─" : "├─";
    return stem + branch;
  };

  sections.forEach((section, sectionIndex) => {
    const sectionIsLast = sectionIndex === sections.length - 1;
    lines.push(`${renderBranchPrefix(sectionIndex, sections.length)} ${section.title}`);

    if (section.title === "Many-to-One") {
      data.manyToOne.forEach((rel, relIndex) => {
        const target = rel.referencedEntity ?? "unknown";
        const nav = padRight(rel.navigationPropertyName, 28);
        lines.push(`${renderChildPrefix(sectionIsLast, relIndex, data.manyToOne.length)} ${nav} → ${target}`);
      });
    }

    if (section.title === "One-to-Many") {
      data.oneToMany.forEach((rel, relIndex) => {
        const target = rel.referencedEntity ?? "unknown";
        const nav = padRight(rel.navigationPropertyName, 28);
        lines.push(`${renderChildPrefix(sectionIsLast, relIndex, data.oneToMany.length)} ${nav} → ${target}`);
      });
    }

    if (section.title === "Many-to-Many") {
      data.manyToMany.forEach((rel, relIndex) => {
        const target = rel.targetEntity ?? "unknown";
        const nav = padRight(rel.navigationPropertyName, 28);
        lines.push(`${renderChildPrefix(sectionIsLast, relIndex, data.manyToMany.length)} ${nav} → ${target}`);
      });
    }
  });

  lines.push("");
  lines.push("Legend");
  lines.push("------");
  lines.push("Many-to-One  : this entity contains the lookup column pointing to the target entity");
  lines.push("One-to-Many  : other records contain a lookup referencing this entity");
  lines.push("Many-to-Many : association/intersect relationship between two entities");

  return lines.join("\n");
}

async function showRelationshipGraphDocument(content: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content
  });

  await vscode.window.showTextDocument(doc, {
    preview: false
  });
}

export async function runRelationshipGraphViewAction(ctx: CommandContext): Promise<void> {
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
        placeHolder: "Select entity for Relationship Graph View"
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

  const tokenUnderCursor = getHoverLikeTokenUnderCursor();
  const focusedRelationship = tryGetFocusedRelationship(tokenUnderCursor, relationships);

  const content = buildGraphText(
    entitySetName,
    logicalName,
    relationships,
    focusedRelationship
  );
  await showRelationshipGraphDocument(content);

}