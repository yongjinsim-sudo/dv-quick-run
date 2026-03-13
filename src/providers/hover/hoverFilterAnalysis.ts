import * as vscode from "vscode";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { normalizeScalarToken, normalizeWord } from "./hoverCommon.js";

export type SimpleFilterComparison = {
  fieldLogicalName: string;
  operator: string;
  rawValue: string;
};

export function parseSimpleFilterComparisons(filter: string): SimpleFilterComparison[] {
  const results: SimpleFilterComparison[] = [];

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

export function getSelectedRawValueForField(
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

export function findMatchingScalarComparison(
  parsed: ReturnType<typeof parseEditorQuery>,
  hoveredWord: string
): SimpleFilterComparison | undefined {
  const filterValue = parsed.queryOptions.get("$filter");
  if (!filterValue) {
    return undefined;
  }

  const comparisons = parseSimpleFilterComparisons(filterValue);
  return comparisons.find(
    (c) => normalizeScalarToken(c.rawValue) === normalizeScalarToken(hoveredWord)
  );
}

export function findChoiceMetadataForField(
  values: ChoiceMetadataDef[],
  fieldLogicalName: string
): ChoiceMetadataDef | undefined {
  const target = fieldLogicalName.trim().toLowerCase();
  return values.find((item) => item.fieldLogicalName.trim().toLowerCase() === target);
}

export function buildChoiceValueHover(args: {
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
