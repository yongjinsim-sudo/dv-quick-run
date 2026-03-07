import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import { clauseFact, FILTER_OPERATOR_FACTS } from "../commands/router/actions/shared/queryExplain/factLibrary.js";
import { getFieldHint } from "../commands/router/actions/shared/queryExplain/fieldHints.js";
import { parseEditorQuery, getEntitySetNameFromEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { toSelectableFields } from "../commands/router/actions/shared/selectableFields.js";
import { getCachedEntityDefs, setCachedEntityDefs, type EntityDef } from "../utils/entitySetCache.js";
import { getCachedFields, setCachedFields } from "../utils/entityFieldCache.js";
import { fetchEntityDefs } from "../services/entityMetadataService.js";
import { fetchEntityFields, type FieldDef } from "../services/entityFieldMetadataService.js";
import { fetchEntityNavigationProperties, type NavPropertyDef } from "../services/entityRelationshipMetadataService.js";
import { getCachedNavigationProperties, setCachedNavigationProperties } from "../utils/entityRelationshipCache.js";

function looksLikeDataverseQuery(text: string): boolean {
  const line = text.trim();

  if (!line) {
    return false;
  }

  if (line.startsWith("//") || line.startsWith("#")) {
    return false;
  }

  const entityPattern = /^\/?[A-Za-z_][A-Za-z0-9_]*(\([^)]+\))?(\?.+)?$/;

  if (!entityPattern.test(line)) {
    return false;
  }

  if (line.includes("?$")) {
    return true;
  }

  if (/\([0-9a-fA-F-]{8,}\)/.test(line)) {
    return true;
  }

  if (/^\/?[A-Za-z_][A-Za-z0-9_]*$/.test(line) && line.length >= 4) {
    return true;
  }

  if (line.includes("?")) {
    return true;
  }

  return false;
}

function isInlineHoverEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<boolean>("enableInlineMetadataHover", true);
}

function getHoverWordRange(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | undefined {
  const line = document.lineAt(position.line).text;

  const isTokenChar = (ch: string): boolean => /[$A-Za-z0-9_]/.test(ch);

  let start = position.character;
  let end = position.character;

  while (start > 0 && isTokenChar(line[start - 1])) {
    start--;
  }

  while (end < line.length && isTokenChar(line[end])) {
    end++;
  }

  if (start === end) {
    return undefined;
  }

  return new vscode.Range(
    new vscode.Position(position.line, start),
    new vscode.Position(position.line, end)
  );
}

function normalizeWord(text: string): string {
  return text.trim().toLowerCase();
}

function findEntityByEntitySetName(defs: EntityDef[], entitySetName: string): EntityDef | undefined {
  const target = entitySetName.trim().toLowerCase();
  return defs.find((d) => d.entitySetName.trim().toLowerCase() === target);
}

async function loadEntityDefsSilently(ctx: CommandContext): Promise<EntityDef[]> {
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

async function loadFieldsSilently(ctx: CommandContext, logicalName: string): Promise<FieldDef[]> {
  const cached = getCachedFields(ctx.ext, logicalName);
  if (cached?.length) {
    return cached;
  }

  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope(baseUrl);
  const token = await ctx.getToken(scope);
  const client = ctx.getClient(baseUrl);

  const fields = await fetchEntityFields(client, token, logicalName);
  await setCachedFields(ctx.ext, logicalName, fields);
  return fields;
}

function buildClauseHover(token: string): vscode.Hover | undefined {
  const fact = clauseFact(token);
  if (!fact) {
    return undefined;
  }

  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${token}**\n\n`);
  md.appendMarkdown(`${fact}\n`);

  if (token === "$select") {
    md.appendMarkdown("\nExample: `contacts?$select=fullname,emailaddress1`");
  }

  if (token === "$filter") {
    md.appendMarkdown("\nExample: `contacts?$filter=contains(fullname,'john')`");
  }

  if (token === "$expand") {
    md.appendMarkdown("\nExample: `contacts?$expand=parentcustomerid_account($select=name)`");
  }

  if (token === "$orderby") {
    md.appendMarkdown("\nExample: `contacts?$orderby=createdon desc`");
  }

  if (token === "$top") {
    md.appendMarkdown("\nExample: `contacts?$top=50`");
  }

  return new vscode.Hover(md);
}

function buildOperatorHover(token: string): vscode.Hover | undefined {
  const normalized = normalizeWord(token);

  const match = FILTER_OPERATOR_FACTS.find((x) => {
    const factToken = x.token.trim().toLowerCase();
    return factToken === normalized || factToken.replace(/\($/, "") === normalized;
  });

  if (!match) {
    return undefined;
  }

  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Operator: \`${normalized}\`**\n\n`);
  md.appendMarkdown(`${match.meaning}\n`);

  if (normalized === "contains") {
    md.appendMarkdown("\nExample: `contains(fullname,'john')`");
  }

  if (normalized === "startswith") {
    md.appendMarkdown("\nExample: `startswith(fullname,'jo')`");
  }

  if (normalized === "endswith") {
    md.appendMarkdown("\nExample: `endswith(emailaddress1,'@bupa.com')`");
  }

  return new vscode.Hover(md);
}

function buildEntityHover(entitySetName: string, entity?: EntityDef): vscode.Hover {
  const md = new vscode.MarkdownString();

  md.appendMarkdown(`**Entity Set: \`${entitySetName}\`**\n\n`);

  if (entity) {
    md.appendMarkdown(`- Logical name: \`${entity.logicalName}\`\n`);
    md.appendMarkdown(`- Entity set: \`${entity.entitySetName}\`\n`);
  } else {
    md.appendMarkdown("- Entity metadata not currently resolved.\n");
  }

  md.appendMarkdown("\nThis is the Dataverse Web API collection path used by the query.");

  return new vscode.Hover(md);
}

function buildFieldHover(
  field: FieldDef,
  selectToken?: string,
  matchedToken?: string
): vscode.Hover {
  const md = new vscode.MarkdownString();
  const attributeType = field.attributeType?.trim() || "unknown";
  const logicalName = field.logicalName;

  md.appendMarkdown(`**Field: \`${logicalName}\`**\n\n`);
  md.appendMarkdown(`- Type: \`${attributeType}\`\n`);
  md.appendMarkdown(`- Readable: \`${field.isValidForRead ?? true}\`\n`);

  if (selectToken && selectToken !== logicalName) {
    md.appendMarkdown(`- Select token: \`${selectToken}\`\n`);
  }

  const hint = getFieldHint(matchedToken ?? logicalName) ?? getFieldHint(logicalName);
  if (hint) {
    md.appendMarkdown(`- Hint: ${hint}\n`);
  }

  const typeKey = attributeType.toLowerCase();

  if (typeKey === "lookup" || typeKey === "customer" || typeKey === "owner") {
    md.appendMarkdown("\nLookup-style column. In `$select`, Dataverse often returns the backing ID column.");
  }

  if (typeKey === "datetime") {
    md.appendMarkdown("\nUseful in `$orderby` and date-based `$filter` expressions.");
  }

  if (typeKey === "picklist" || typeKey === "state" || typeKey === "status") {
    md.appendMarkdown("\nOption-style field. Filters usually compare numeric values.");
  }

  return new vscode.Hover(md);
}

export class QueryHoverProvider implements vscode.HoverProvider {
  constructor(private readonly ctx: CommandContext) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    if (!isInlineHoverEnabled()) {
      return undefined;
    }

    const line = document.lineAt(position.line);
    const lineText = line.text.trim();

    if (!looksLikeDataverseQuery(lineText)) {
      return undefined;
    }

    const wordRange = getHoverWordRange(document, position);
    if (!wordRange) {
      return undefined;
    }

    const hoveredWord = document.getText(wordRange).trim();
    if (!hoveredWord) {
      return undefined;
    }

    const clauseHover = buildClauseHover(hoveredWord);
    if (clauseHover) {
      return clauseHover;
    }

    const operatorHover = buildOperatorHover(hoveredWord);
    if (operatorHover) {
      return operatorHover;
    }

    const parsed = parseEditorQuery(lineText);
    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);

    if (!entitySetName) {
      return undefined;
    }

    // Entity set hover
    if (normalizeWord(hoveredWord) === normalizeWord(entitySetName)) {
      try {
        const defs = await loadEntityDefsSilently(this.ctx);
        const entity = findEntityByEntitySetName(defs, entitySetName);
        return buildEntityHover(entitySetName, entity);
      } catch (e: any) {
        return buildNavigationFallbackHover(hoveredWord);
      }
    }

    // Expand navigation-property hover
    try {
      if (tokenAppearsInExpand(lineText, hoveredWord)) {
        const defs = await loadEntityDefsSilently(this.ctx);
        const entity = findEntityByEntitySetName(defs, entitySetName);

        if (entity) {
          const navs = await loadNavigationPropertiesSilently(this.ctx, entity.logicalName);

          const navMatch = navs.find(
            (n) => normalizeWord(n.navigationPropertyName) === normalizeWord(hoveredWord)
          );

          if (navMatch) {
            return buildNavigationPropertyHover(navMatch, entitySetName);
          }
        }
      }
    } catch (e: any) {
        return buildNavigationFallbackHover(hoveredWord);
    }

    // Field hover
    try {
      const defs = await loadEntityDefsSilently(this.ctx);
      const entity = findEntityByEntitySetName(defs, entitySetName);

      if (!entity) {
        return undefined;
      }

      const fields = await loadFieldsSilently(this.ctx, entity.logicalName);
      const selectable = toSelectableFields(fields);

      const fieldMatch = fields.find(
        (f) => normalizeWord(f.logicalName) === normalizeWord(hoveredWord)
      );

      if (fieldMatch) {
        const selectableMatch = selectable.find(
          (f) => normalizeWord(f.logicalName) === normalizeWord(fieldMatch.logicalName)
        );

        return buildFieldHover(fieldMatch, selectableMatch?.selectToken, hoveredWord);
      }

      const selectTokenMatch = selectable.find(
        (f) => normalizeWord(f.selectToken ?? "") === normalizeWord(hoveredWord)
      );

      if (selectTokenMatch) {
        const backingField = fields.find(
          (f) => normalizeWord(f.logicalName) === normalizeWord(selectTokenMatch.logicalName)
        );

        if (backingField) {
          return buildFieldHover(backingField, selectTokenMatch.selectToken, hoveredWord);
        }
      }
    } catch (e: any) {
        return buildNavigationFallbackHover(hoveredWord);
    }

    return undefined;
  }
}

async function loadNavigationPropertiesSilently(
  ctx: CommandContext,
  logicalName: string
): Promise<NavPropertyDef[]> {
  const cached = getCachedNavigationProperties(ctx.ext, logicalName);
  if (cached?.length) {
    return cached;
  }

  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope(baseUrl);
  const token = await ctx.getToken(scope);
  const client = ctx.getClient(baseUrl);

  const navs = await fetchEntityNavigationProperties(client, token, logicalName);
  await setCachedNavigationProperties(ctx.ext, logicalName, navs);
  return navs;
}

function getExpandValue(queryText: string): string | undefined {
  const parsed = parseEditorQuery(queryText);
  return parsed.queryOptions.get("$expand") ?? undefined;
}

function tokenAppearsInExpand(queryText: string, token: string): boolean {
  const expand = getExpandValue(queryText);
  if (!expand) {
    return false;
  }

  return expand.toLowerCase().includes(token.trim().toLowerCase());
}

function buildNavigationPropertyHover(
  nav: NavPropertyDef,
  sourceEntitySetName: string
): vscode.Hover {
  const md = new vscode.MarkdownString();

  md.appendMarkdown(`**Expand Navigation: \`${nav.navigationPropertyName}\`**\n\n`);
  md.appendMarkdown(`- Relationship type: \`${nav.relationshipType}\`\n`);
  md.appendMarkdown(`- Source entity set: \`${sourceEntitySetName}\`\n`);

  if (nav.referencingEntity) {
    md.appendMarkdown(`- Source logical name: \`${nav.referencingEntity}\`\n`);
  }

  if (nav.referencedEntity) {
    md.appendMarkdown(`- Target logical name: \`${nav.referencedEntity}\`\n`);
  }

  if (nav.referencingAttribute) {
    md.appendMarkdown(`- Lookup attribute: \`${nav.referencingAttribute}\`\n`);
  }

  if (nav.schemaName) {
    md.appendMarkdown(`- Schema name: \`${nav.schemaName}\`\n`);
  }

  md.appendMarkdown("\nUsed in `$expand` to include related records.");

  if (nav.relationshipType === "ManyToOne") {
    md.appendMarkdown("\nExample: ");
    md.appendCodeblock(`${sourceEntitySetName}?$expand=${nav.navigationPropertyName}($select=name)`, "text");
  } else {
    md.appendMarkdown("\nExample: ");
    md.appendCodeblock(`${sourceEntitySetName}?$expand=${nav.navigationPropertyName}`, "text");
  }

  return new vscode.Hover(md);
}

function buildNavigationFallbackHover(token: string): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Expand token: \`${token}\`**\n\n`);
  md.appendMarkdown("Looks like a navigation property inside `$expand`.\n\n");
  md.appendMarkdown("Connect to Dataverse to resolve relationship metadata such as target entity, lookup attribute, and schema name.");
  return new vscode.Hover(md);
}