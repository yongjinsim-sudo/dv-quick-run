import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { getEntitySetCacheDiagnostics } from "../../../utils/entitySetCache.js";
import { getEntityFieldCacheDiagnostics } from "../../../utils/entityFieldCache.js";
import { getEntityChoiceCacheDiagnostics } from "../../../utils/entityChoiceCache.js";
import { getEntityRelationshipCacheDiagnostics } from "../../../utils/entityRelationshipCache.js";
import { getMetadataSessionCacheDiagnostics } from "./shared/metadataLoadCache.js";
import { getHoverFieldContextCacheDiagnostics } from "../../../providers/hoverFieldContextCache.js";

function toMarkdownList(items: string[], emptyText = "_none_"): string {
  if (!items.length) {
    return emptyText;
  }

  return items.map((x) => `- \`${x}\``).join("\n");
}

function toMarkdownCountMap(
  map: Record<string, number>,
  emptyText = "_none_"
): string {
  const keys = Object.keys(map).sort();
  if (!keys.length) {
    return emptyText;
  }

  return keys.map((k) => `- \`${k}\`: ${map[k]}`).join("\n");
}

export async function runShowMetadataDiagnosticsAction(
  ctx: CommandContext
): Promise<void> {
  const now = new Date().toISOString();

  const entitySetDiag = getEntitySetCacheDiagnostics(ctx.ext);
  const fieldDiag = getEntityFieldCacheDiagnostics(ctx.ext);
  const choiceDiag = getEntityChoiceCacheDiagnostics(ctx.ext);
  const relationshipDiag = getEntityRelationshipCacheDiagnostics(ctx.ext);
  const sessionDiag = getMetadataSessionCacheDiagnostics();
  const hoverDiag = getHoverFieldContextCacheDiagnostics();

  const markdown = `# DV Quick Run — Metadata Diagnostics

Generated: \`${now}\`

## Session metadata cache

- Entity defs loaded: \`${sessionDiag.entityDefsLoaded}\`
- Fields session entries: \`${sessionDiag.fieldsLogicalNames.length}\`
- Navigation session entries: \`${sessionDiag.navigationLogicalNames.length}\`
- Choice session entries: \`${sessionDiag.choiceLogicalNames.length}\`

### Session field cache entities
${toMarkdownList(sessionDiag.fieldsLogicalNames)}

### Session navigation cache entities
${toMarkdownList(sessionDiag.navigationLogicalNames)}

### Session choice cache entities
${toMarkdownList(sessionDiag.choiceLogicalNames)}

## Persisted entity defs cache

- Entity defs count: \`${entitySetDiag.count}\`

### Logical names
${toMarkdownList(entitySetDiag.logicalNames.slice(0, 100))}

## Persisted field metadata cache

- Entity count: \`${fieldDiag.logicalNames.length}\`

### Field counts by entity
${toMarkdownCountMap(fieldDiag.countsByLogicalName)}

## Persisted choice metadata cache

- Entity count: \`${choiceDiag.logicalNames.length}\`

### Choice counts by entity
${toMarkdownCountMap(choiceDiag.countsByLogicalName)}

## Persisted relationship metadata cache

- Entity count: \`${relationshipDiag.logicalNames.length}\`

### Relationship counts by entity
${toMarkdownCountMap(relationshipDiag.countsByLogicalName)}

## Hover field-context cache

- Entity count: \`${hoverDiag.count}\`

### Hover cached entities
${toMarkdownList(hoverDiag.logicalNames)}

## Notes

- Session cache = in-memory for current extension host session
- Persisted cache = extension global state
- Hover field-context cache = derived field maps used by inline hover
`;

  const uri = vscode.Uri.parse("dvqr:/.dvqr/metadata/metadata-diagnostics.md");
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown"
  });

  await vscode.window.showTextDocument(doc, {
    preview: false
  });
}