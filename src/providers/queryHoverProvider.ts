import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import { clauseFact, FILTER_OPERATOR_FACTS } from "../commands/router/actions/shared/queryExplain/factLibrary.js";
import { getFieldHint } from "../commands/router/actions/shared/queryExplain/fieldHints.js";
import { parseEditorQuery, getEntitySetNameFromEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { isChoiceAttributeType } from "../metadata/metadataModel.js";
import { loadEntityDefs, loadFields, loadNavigationProperties, loadChoiceMetadata } from "../commands/router/actions/shared/metadataAccess.js";
import type { EntityDef } from "../utils/entitySetCache.js";
import type { FieldDef } from "../services/entityFieldMetadataService.js";
import type { NavPropertyDef } from "../services/entityRelationshipMetadataService.js";
import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";
import type { DataverseClient } from "../services/dataverseClient.js";
import {
  buildHoverFieldContext,
  getCachedHoverFieldContext,
  setCachedHoverFieldContext,
  type HoverFieldContext
} from "./hoverFieldContextCache.js";

const navHoverEnrichmentCache = new Map<
  string,
  {
    exampleExpand?: string;
    suggestedFields?: string[];
    targetEntitySetName?: string;
  }
>();

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

function isScalarValueToken(text: string): boolean {
  const t = text.trim();

  if (!t) {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return true;
  }

  const lowered = t.toLowerCase();
  return lowered === "true" || lowered === "false";
}

function normalizeScalarToken(text: string): string {
  return text.trim().toLowerCase();
}

function parseSimpleFilterComparisons(filter: string): Array<{
  fieldLogicalName: string;
  operator: string;
  rawValue: string;
}> {
  const results: Array<{
    fieldLogicalName: string;
    operator: string;
    rawValue: string;
  }> = [];

  const regex =
    /\b([A-Za-z_][A-Za-z0-9_]*)\s+(eq|ne|gt|ge|lt|le)\s+((?:true|false|-?\d+(?:\.\d+)?)|'(?:[^']|'')*')/gi;

  for (const match of filter.matchAll(regex)) {
    const [, fieldLogicalName, operator, rawValue] = match;
    if (fieldLogicalName && operator && rawValue) {
      results.push({ fieldLogicalName, operator: operator.toLowerCase(), rawValue });
    }
  }

  return results;
}

function buildChoiceValueHover(args: {
  rawValue: string;
  fieldLogicalName: string;
  attributeType?: string;
  label: string;
}): vscode.Hover {
  const md = new vscode.MarkdownString();

  md.appendMarkdown(`**Value: \`${args.rawValue}\`**\n\n`);
  md.appendMarkdown(`- Field: \`${args.fieldLogicalName}\`\n`);
  md.appendMarkdown(`- Type: \`${args.attributeType?.trim() || "unknown"}\`\n`);
  md.appendMarkdown(`- Meaning: **${args.label}**\n`);

  return new vscode.Hover(md);
}

function findEntityByEntitySetName(defs: EntityDef[], entitySetName: string): EntityDef | undefined {
  const target = entitySetName.trim().toLowerCase();
  return defs.find((d) => d.entitySetName.trim().toLowerCase() === target);
}

type HoverConnectionContext = {
  baseUrl: string;
  scope: string;
  token: string;
  client: DataverseClient;
};

function isHoverCancelled(token: vscode.CancellationToken): boolean {
  return token.isCancellationRequested;
}

class HoverRequestContext {
  private connectionPromise?: Promise<HoverConnectionContext>;
  private entityDefsPromise?: Promise<EntityDef[]>;
  private fieldContextPromises = new Map<string, Promise<HoverFieldContext>>();
  private navigationPromises = new Map<string, Promise<NavPropertyDef[]>>();
  private choicePromises = new Map<string, Promise<ChoiceMetadataDef[]>>();
  private entityBySetPromises = new Map<string, Promise<EntityDef | undefined>>();

  constructor(private readonly ctx: CommandContext) {}

  async getConnection(): Promise<HoverConnectionContext> {
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        const baseUrl = await this.ctx.getBaseUrl();
        const scope = this.ctx.getScope(baseUrl);
        const token = await this.ctx.getToken(scope);
        const client = this.ctx.getClient(baseUrl);

        return { baseUrl, scope, token, client };
      })();
    }

    return this.connectionPromise;
  }

  async getEntityDefs(): Promise<EntityDef[]> {
    if (!this.entityDefsPromise) {
      this.entityDefsPromise = (async () => {
        const connection = await this.getConnection();
        return loadEntityDefs(this.ctx, connection.client, connection.token, {
          silent: true,
          suppressOutput: true
        });
      })();
    }

    return this.entityDefsPromise;
  }

async getEntityByEntitySetName(entitySetName: string): Promise<EntityDef | undefined> {
  const key = normalizeWord(entitySetName);
  const existing = this.entityBySetPromises.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const defs = await this.getEntityDefs();
    return findEntityByEntitySetName(defs, entitySetName);
  })();

  this.entityBySetPromises.set(key, promise);
  return promise;
}

  async getFieldContext(logicalName: string): Promise<HoverFieldContext> {
    const cached = getCachedHoverFieldContext(logicalName);
    if (cached) {
      return cached;
    }

    const key = normalizeWord(logicalName);
    const existing = this.fieldContextPromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const connection = await this.getConnection();
      const fields = await loadFields(this.ctx, connection.client, connection.token, logicalName, {
        silent: true,
        suppressOutput: true
      });

      const context = buildHoverFieldContext(fields);
      setCachedHoverFieldContext(logicalName, context);
      return context;
    })();

    this.fieldContextPromises.set(key, promise);
    return promise;
  }

  async getNavigationProperties(logicalName: string): Promise<NavPropertyDef[]> {
    const key = normalizeWord(logicalName);
    const existing = this.navigationPromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const connection = await this.getConnection();
      return loadNavigationProperties(this.ctx, connection.client, connection.token, logicalName, {
        silent: true,
        suppressOutput: true
      }) as Promise<NavPropertyDef[]>;
    })();

    this.navigationPromises.set(key, promise);
    return promise;
  }

  async getChoiceMetadata(logicalName: string): Promise<ChoiceMetadataDef[]> {
    const key = normalizeWord(logicalName);
    const existing = this.choicePromises.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const connection = await this.getConnection();
      return loadChoiceMetadata(this.ctx, connection.client, connection.token, logicalName, {
        silent: true,
        suppressOutput: true
      });
    })();

    this.choicePromises.set(key, promise);
    return promise;
  }
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

function findChoiceMetadataForField(
  values: ChoiceMetadataDef[],
  fieldLogicalName: string
): ChoiceMetadataDef | undefined {
  const target = fieldLogicalName.trim().toLowerCase();
  return values.find((item) => item.fieldLogicalName.trim().toLowerCase() === target);
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
  matchedToken?: string,
  choiceMetadata?: ChoiceMetadataDef,
  selectedRawValue?: string
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

  if (typeKey === "picklist" || typeKey === "state" || typeKey === "status" || typeKey === "boolean") {
    md.appendMarkdown("\nOption-style field. Filters usually compare numeric values.");
  }

  if (choiceMetadata?.options?.length) {
    md.appendMarkdown("\n\n**Values**\n");

    const maxToShow = 8;
    const shown = choiceMetadata.options.slice(0, maxToShow);
    const normalizedSelected = selectedRawValue?.trim().toLowerCase();

    for (const option of shown) {
      const optionValue = String(option.value);
      const isSelected = normalizedSelected === optionValue.trim().toLowerCase();

      if (isSelected) {
        md.appendMarkdown(`- ➜ **\`${optionValue}\` = ${option.label}**\n`);
      } else {
        md.appendMarkdown(`- \`${optionValue}\` = ${option.label}\n`);
      }
    }

    if (choiceMetadata.options.length > maxToShow) {
      const remaining = choiceMetadata.options.length - maxToShow;
      md.appendMarkdown(`- _…and ${remaining} more_\n`);
    }
  }

  return new vscode.Hover(md);
}

function getSelectedRawValueForField(
  parsed: ReturnType<typeof parseEditorQuery>,
  fieldLogicalName: string
): string | undefined {
  const filterValue = parsed.queryOptions.get("$filter");
  if (!filterValue) {
    return undefined;
  }

  const comparisons = parseSimpleFilterComparisons(filterValue);
  const match = comparisons.find(
    (c) => normalizeWord(c.fieldLogicalName) === normalizeWord(fieldLogicalName)
  );

  return match?.rawValue;
}

export class QueryHoverProvider implements vscode.HoverProvider {
  constructor(private readonly ctx: CommandContext) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
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

    const request = new HoverRequestContext(this.ctx);

    try {
      if (isHoverCancelled(token)) {
        return undefined;
      }

      // Choice-value hover
      if (isScalarValueToken(hoveredWord)) {
        const filterValue = parsed.queryOptions.get("$filter");
        if (filterValue) {
          const comparisons = parseSimpleFilterComparisons(filterValue);

          const matchingComparison = comparisons.find(
            (c) => normalizeScalarToken(c.rawValue) === normalizeScalarToken(hoveredWord)
          );

          if (matchingComparison) {
            const entity = await request.getEntityByEntitySetName(entitySetName);
            if (entity && !isHoverCancelled(token)) {
              const fieldContext = await request.getFieldContext(entity.logicalName);
              const field = fieldContext.fieldByLogicalName.get(
                normalizeWord(matchingComparison.fieldLogicalName)
              );

              if (field && isChoiceAttributeType(field.attributeType) && !isHoverCancelled(token)) {
                const allChoiceMetadata = await request.getChoiceMetadata(entity.logicalName);
                const choiceMetadata = findChoiceMetadataForField(
                  allChoiceMetadata,
                  field.logicalName
                );

                if (choiceMetadata) {
                  const option = choiceMetadata.options.find(
                    (o) =>
                      normalizeScalarToken(String(o.value)) ===
                      normalizeScalarToken(matchingComparison.rawValue)
                  );

                  if (option) {
                    return buildChoiceValueHover({
                      rawValue: matchingComparison.rawValue,
                      fieldLogicalName: field.logicalName,
                      attributeType: field.attributeType,
                      label: option.label
                    });
                  }
                }
              }
            }
          }
        }
      }

      if (isHoverCancelled(token)) {
        return undefined;
      }

      // Entity set hover
      if (normalizeWord(hoveredWord) === normalizeWord(entitySetName)) {
        const entity = await request.getEntityByEntitySetName(entitySetName);
        return buildEntityHover(entitySetName, entity);
      }

      if (isHoverCancelled(token)) {
        return undefined;
      }

      // Expand navigation-property hover
      if (tokenAppearsInExpand(lineText, hoveredWord)) {
        const defs = await request.getEntityDefs();
        const entity = findEntityByEntitySetName(defs, entitySetName);

        if (entity && !isHoverCancelled(token)) {
          const navs = await request.getNavigationProperties(entity.logicalName);

          const navMatch = navs.find(
            (n) => normalizeWord(n.navigationPropertyName) === normalizeWord(hoveredWord)
          );

          if (navMatch) {
            const targetLogicalName =
              navMatch.referencedEntity?.trim() ||
              navMatch.referencingEntity?.trim() ||
              undefined;

            const cacheKey = `${entitySetName}:${navMatch.navigationPropertyName}`;
            const cached = navHoverEnrichmentCache.get(cacheKey);

            if (cached) {
              return buildNavigationPropertyHover({
                nav: navMatch,
                sourceEntitySetName: entitySetName,
                targetEntitySetName: cached.targetEntitySetName,
                exampleExpand: cached.exampleExpand,
                suggestedFields: cached.suggestedFields
              });
            }

            let targetEntitySetName: string | undefined;
            let exampleExpand: string | undefined;
            let suggestedFields: string[] | undefined;

            if (targetLogicalName && !isHoverCancelled(token)) {
              const targetDef = defs.find(
                (d) => normalizeWord(d.logicalName) === normalizeWord(targetLogicalName)
              );

              targetEntitySetName = targetDef?.entitySetName;

              try {
                const targetFieldContext = await request.getFieldContext(targetLogicalName);
                const fieldLogicalNames = targetFieldContext.selectable
                  .map((f) => f.logicalName)
                  .filter(Boolean)
                  .slice(0, 30);

                suggestedFields = pickSuggestedFields(fieldLogicalNames);

                const exampleField = pickPreferredExampleField(fieldLogicalNames);
                exampleExpand = exampleField
                  ? `${entitySetName}?$expand=${navMatch.navigationPropertyName}($select=${exampleField})`
                  : `${entitySetName}?$expand=${navMatch.navigationPropertyName}`;
              } catch {
                exampleExpand = `${entitySetName}?$expand=${navMatch.navigationPropertyName}`;
              }
            }

            navHoverEnrichmentCache.set(cacheKey, {
              targetEntitySetName,
              exampleExpand,
              suggestedFields
            });

            return buildNavigationPropertyHover({
              nav: navMatch,
              sourceEntitySetName: entitySetName,
              targetEntitySetName,
              exampleExpand,
              suggestedFields
            });
          }
        }
      }

      if (isHoverCancelled(token)) {
        return undefined;
      }

      // Field hover
      const entity = await request.getEntityByEntitySetName(entitySetName);
      if (!entity) {
        return undefined;
      }

      const fieldContext = await request.getFieldContext(entity.logicalName);

      const fieldMatch = fieldContext.fieldByLogicalName.get(normalizeWord(hoveredWord));

      if (fieldMatch) {
        const selectableMatch = fieldContext.selectableByLogicalName.get(
          normalizeWord(fieldMatch.logicalName)
        );

        let choiceMetadata: ChoiceMetadataDef | undefined;
        if (isChoiceAttributeType(fieldMatch.attributeType) && !isHoverCancelled(token)) {
          const allChoiceMetadata = await request.getChoiceMetadata(entity.logicalName);
          choiceMetadata = findChoiceMetadataForField(allChoiceMetadata, fieldMatch.logicalName);
        }

        const selectedRawValue = getSelectedRawValueForField(parsed, fieldMatch.logicalName);

        return buildFieldHover(
          fieldMatch,
          selectableMatch?.selectToken,
          hoveredWord,
          choiceMetadata,
          selectedRawValue
        );
      }

      const selectTokenMatch = fieldContext.selectableByToken.get(normalizeWord(hoveredWord));

      if (selectTokenMatch) {
        const backingField = fieldContext.fieldByLogicalName.get(
          normalizeWord(selectTokenMatch.logicalName)
        );

        if (backingField) {
          let choiceMetadata: ChoiceMetadataDef | undefined;
          if (isChoiceAttributeType(backingField.attributeType) && !isHoverCancelled(token)) {
            const allChoiceMetadata = await request.getChoiceMetadata(entity.logicalName);
            choiceMetadata = findChoiceMetadataForField(
              allChoiceMetadata,
              backingField.logicalName
            );
          }

          const selectedRawValue = getSelectedRawValueForField(parsed, backingField.logicalName);

          return buildFieldHover(
            backingField,
            selectTokenMatch.selectToken,
            hoveredWord,
            choiceMetadata,
            selectedRawValue
          );
        }
      }

      return undefined;
    } catch {
      if (isHoverCancelled(token)) {
        return undefined;
      }

      return buildNavigationFallbackHover(hoveredWord);
    }
  }
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

function pickPreferredExampleField(fieldLogicalNames: string[]): string | undefined {
  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));

  return (
    lowered.get("fullname") ??
    lowered.get("name") ??
    lowered.get("subject") ??
    lowered.get("title") ??
    lowered.get("domainname") ??
    lowered.get("internalemailaddress") ??
    lowered.get("emailaddress1") ??
    lowered.get("telephone1") ??
    lowered.get("accountnumber") ??
    lowered.get("currencyname") ??
    lowered.get("isocurrencycode") ??
    fieldLogicalNames[0]
  );
}

function pickSuggestedFields(fieldLogicalNames: string[]): string[] {
  const preferredOrder = [
    "fullname",
    "name",
    "subject",
    "title",
    "domainname",
    "internalemailaddress",
    "emailaddress1",
    "telephone1",
    "accountnumber",
    "currencyname",
    "isocurrencycode",
    "firstname",
    "lastname"
  ];

  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));
  const preferred = preferredOrder
    .map((name) => lowered.get(name))
    .filter((name): name is string => !!name);

  const remaining = fieldLogicalNames.filter(
    (name) => !preferred.some((p) => p.toLowerCase() === name.toLowerCase())
  );

  return [...preferred, ...remaining].slice(0, 5);
}

function buildNavigationPropertyHover(args: {
  nav: NavPropertyDef;
  sourceEntitySetName: string;
  targetEntitySetName?: string;
  exampleExpand?: string;
  suggestedFields?: string[];
}): vscode.Hover {
  const { nav, sourceEntitySetName, targetEntitySetName, exampleExpand, suggestedFields } = args;

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

  if (targetEntitySetName) {
    md.appendMarkdown(`- Target entity set: \`${targetEntitySetName}\`\n`);
  }

  if (nav.referencingAttribute) {
    md.appendMarkdown(`- Lookup attribute: \`${nav.referencingAttribute}\`\n`);
  }

  if (nav.schemaName) {
    md.appendMarkdown(`- Schema name: \`${nav.schemaName}\`\n`);
  }

  md.appendMarkdown("\nUsed in `$expand` to include related records.\n");

  md.appendMarkdown("\n**Example**\n");
  md.appendCodeblock(
    exampleExpand ??
      (nav.relationshipType === "ManyToOne"
        ? `${sourceEntitySetName}?$expand=${nav.navigationPropertyName}($select=name)`
        : `${sourceEntitySetName}?$expand=${nav.navigationPropertyName}`),
    "text"
  );

  if (suggestedFields?.length) {
    md.appendMarkdown("\n**Common fields**\n");
    md.appendMarkdown(`${suggestedFields.map((f) => `\`${f}\``).join(", ")}\n`);
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