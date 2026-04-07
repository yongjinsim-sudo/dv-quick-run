import * as vscode from "vscode";
import { clauseFact, FILTER_OPERATOR_FACTS } from "../../commands/router/actions/shared/queryExplain/factLibrary.js";
import { getFieldHint } from "../../commands/router/actions/shared/queryExplain/fieldHints.js";
import type { EntityDef } from "../../utils/entitySetCache.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import type { NavPropertyDef } from "../../services/entityRelationshipMetadataService.js";
import { normalizeWord } from "./hoverCommon.js";

export function buildClauseHover(token: string): vscode.Hover | undefined {
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

export function buildOperatorHover(token: string): vscode.Hover | undefined {
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
    md.appendMarkdown("\nExample: `endswith(emailaddress1,'@email.com')`");
  }

  return new vscode.Hover(md);
}

export function buildEntityHover(entitySetName: string, entity?: EntityDef): vscode.Hover {
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

export function buildFieldHover(
  field: FieldDef,
  selectToken?: string,
  matchedToken?: string,
  choiceMetadata?: ChoiceMetadataDef,
  selectedRawValue?: string,
  refinementOptions?: { label: string; value: string; commandUri: string }[]
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
    if (refinementOptions !== undefined && refinementOptions.length > 0) {
      md.isTrusted = true;
      md.appendMarkdown("\n\n**Refine filter**\n");

      for (const option of refinementOptions) {
        md.appendMarkdown(
          `- [Preview replace: ${option.value} = ${option.label}](${option.commandUri})\n`
        );
      }
    } else {
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
        md.appendMarkdown(`\n_...and ${remaining} more_\n`);
      }
    }
  }

  return new vscode.Hover(md);
}

export function buildNavigationPropertyHover(args: {
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

export function buildNavigationFallbackHover(token: string): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Expand token: \`${token}\`**\n\n`);
  md.appendMarkdown("Looks like a navigation property inside `$expand`.\n\n");
  md.appendMarkdown("Connect to Dataverse to resolve relationship metadata such as target entity, lookup attribute, and schema name.");
  return new vscode.Hover(md);
}
