import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { getEntitySetCacheDiagnostics } from "../../../../utils/entitySetCache.js";
import { getEntityFieldCacheDiagnostics } from "../../../../utils/entityFieldCache.js";
import { getEntityChoiceCacheDiagnostics } from "../../../../utils/entityChoiceCache.js";
import { getEntityRelationshipCacheDiagnostics } from "../../../../utils/entityRelationshipCache.js";
import { getMetadataSessionCacheDiagnostics } from "../shared/metadataAccess/metadataSessionCache.js";
import { getHoverFieldContextCacheDiagnostics } from "../../../../providers/hoverFieldContextCache.js";
import { getEntityRelationshipExplorerCacheDiagnostics } from "../../../../utils/entityRelationshipExplorerCache.js";
import { getMetadataStorageDiagnostics } from "../../../../utils/metadataStorage.js";

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

function normalizeEnvironmentKey(environmentName: string): string {
  return environmentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

export async function runShowMetadataDiagnosticsAction(
  ctx: CommandContext
): Promise<void> {
  const now = new Date().toISOString();
  const envName = ctx.envContext.getEnvironmentName();
  const envCacheKeyPrefix = normalizeEnvironmentKey(envName);

  const entitySetDiag = getEntitySetCacheDiagnostics(ctx.ext, envName);
  const fieldDiag = getEntityFieldCacheDiagnostics(ctx.ext, envName);
  const choiceDiag = getEntityChoiceCacheDiagnostics(ctx.ext, envName);
  const relationshipDiag = getEntityRelationshipCacheDiagnostics(ctx.ext, envName);
  const relationshipExplorerDiag = getEntityRelationshipExplorerCacheDiagnostics(ctx.ext, envName);
  const storageDiag = getMetadataStorageDiagnostics(ctx.ext, envName);
  const sessionDiag = getMetadataSessionCacheDiagnostics();
  const hoverDiag = getHoverFieldContextCacheDiagnostics();

  const markdown = `# DV Quick Run — Metadata Diagnostics

Generated: \`${now}\`

## Environment

- Active environment: \`${envName}\`
- Environment cache key prefix: \`${envCacheKeyPrefix}\`

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

## Persisted metadata storage

- Storage mode: \`disk-backed JSON under globalStorageUri\`
- Metadata root: \`${storageDiag.rootPath}\`
- Environment metadata root: \`${storageDiag.environmentRootPath}\`
- Total persisted metadata bytes: \`${storageDiag.totalBytes}\`

### Persisted bucket sizes
- entityDefs: \`${storageDiag.bucketBytes.entityDefs}\` bytes
- fields: \`${storageDiag.bucketBytes.fields}\` bytes
- choices: \`${storageDiag.bucketBytes.choices}\` bytes
- relationships: \`${storageDiag.bucketBytes.relationships}\` bytes
- relationshipExplorer: \`${storageDiag.bucketBytes.relationshipExplorer}\` bytes

## Persisted entity defs cache

- Entity defs count: \`${entitySetDiag.count}\`
- Entity defs bytes: \`${entitySetDiag.storageBytes}\`

### Logical names
${toMarkdownList(entitySetDiag.logicalNames.slice(0, 100))}

## Persisted field metadata cache

- Entity count: \`${fieldDiag.logicalNames.length}\`
- Field cache bytes: \`${fieldDiag.storageBytes}\`

### Field counts by entity
${toMarkdownCountMap(fieldDiag.countsByLogicalName)}

## Persisted choice metadata cache

- Entity count: \`${choiceDiag.logicalNames.length}\`
- Choice cache bytes: \`${choiceDiag.storageBytes}\`

### Choice counts by entity
${toMarkdownCountMap(choiceDiag.countsByLogicalName)}

## Persisted relationship metadata cache

- Entity count: \`${relationshipDiag.logicalNames.length}\`
- Relationship cache bytes: \`${relationshipDiag.storageBytes}\`

### Relationship counts by entity
${toMarkdownCountMap(relationshipDiag.countsByLogicalName)}

## Persisted relationship explorer cache

- Entity count: \`${relationshipExplorerDiag.logicalNames.length}\`
- Relationship explorer bytes: \`${relationshipExplorerDiag.storageBytes}\`

### Relationship explorer cached entities
${toMarkdownList(relationshipExplorerDiag.logicalNames)}

## Hover field-context cache

- Entity count: \`${hoverDiag.count}\`

### Hover cached entities
${toMarkdownList(hoverDiag.logicalNames)}

## Notes

- Session cache = in-memory for current extension host session
- Persisted metadata cache = disk-backed JSON storage under the extension global storage path
- Legacy globalState/workspaceState entries are lazily migrated when read and cleared by the cache reset command
- Hover field-context cache = derived field maps used by inline hover
- Persisted metadata diagnostics shown here are scoped to the active environment
`;

  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown"
  });

  await vscode.window.showTextDocument(doc, {
    preview: false
  });
}