import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import { loadChoiceMetadata, loadEntityDefs, loadSelectableFields, findEntityByEntitySetName } from "../shared/metadataAccess.js";
import { validateFilterRawValue } from "../shared/queryMutation/filterValueValidation.js";
import { getLogicalEditorQueryTarget } from "../shared/queryMutation/editorQueryTarget.js";
import { getEntitySetNameFromEditorQuery, parseEditorQuery } from "../shared/queryMutation/parsedEditorQuery.js";
import type { FilterableField } from "../shared/queryMutation/filterExpressionRules.js";
import { getEligibleFilterBuilderFields } from "../../../../refinement/filterBuilder/fieldEligibility.js";
import {
  getFilterBuilderOperatorItems,
  resolveFilterBuilderFieldType,
  type FilterBuilderOperatorItem
} from "../../../../refinement/filterBuilder/operatorPolicy.js";
import type { BuildFilterInsight, FilterBuilderFieldType, FilterClauseModel } from "../../../../refinement/filterBuilder/models.js";
import { previewAndApplyFilterInsight } from "../../../../refinement/filterBuilder/preview.js";

function looksLikeJsonLine(input: string): boolean {
  const text = input.trim();
  if (!text) {return false;}

  return (
    text.startsWith("{") ||
    text.startsWith("[") ||
    text.startsWith("\"") ||
    text === "}" ||
    text === "]" ||
    /^[\s"]+[A-Za-z0-9_@$.-]+"\s*:/.test(text) ||
    /^"[A-Za-z0-9_@$.-]+"\s*:/.test(text)
  );
}

async function pickField(entitySetName: string, fields: FilterableField[]): Promise<FilterableField | undefined> {
  const picked = await vscode.window.showQuickPick(
    fields.map((f) => ({
      label: f.logicalName,
      description: f.attributeType || "",
      detail: f.selectToken && f.selectToken !== f.logicalName ? `Uses ${f.selectToken}` : undefined,
      field: f
    })),
    {
      title: `DV Quick Run: Add Filter ($filter) — ${entitySetName}`,
      placeHolder: "Step 1 of 5: Pick a field to filter on",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.field;
}

async function pickFilterOperator(field: FilterableField): Promise<FilterBuilderOperatorItem | undefined> {
  const items = getFilterBuilderOperatorItems(field);
  const picked = await vscode.window.showQuickPick(
    items.map((item) => ({
      label: item.label,
      detail: item.detail,
      operator: item
    })),
    {
      title: `DV Quick Run: Add Filter ($filter) — ${field.logicalName}`,
      placeHolder: "Step 2 of 5: Choose an operator",
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  return picked?.operator;
}

async function pickChoiceValue(ctx: CommandContext, logicalName: string, field: FilterableField): Promise<string | undefined> {
  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();
  const metadata = await loadChoiceMetadata(ctx, client, token, logicalName);
  const fieldMetadata = metadata.find((item) => item.fieldLogicalName === field.logicalName);

  if (!fieldMetadata?.options?.length) {
    return promptScalarValue(field, { requiresValue: true, label: "equals", value: "eq", detail: "" });
  }

  const picked = await vscode.window.showQuickPick(
    fieldMetadata.options.map((option) => ({
      label: option.label,
      description: String(option.value),
      value: String(option.value)
    })),
    {
      title: `DV Quick Run: Add Filter ($filter) — ${field.logicalName}`,
      placeHolder: "Step 3 of 5: Pick a value",
      ignoreFocusOut: true,
      matchOnDescription: true
    }
  );

  return picked?.value;
}

async function pickBooleanValue(): Promise<string | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "true", value: "true" },
      { label: "false", value: "false" }
    ],
    {
      title: "DV Quick Run: Add Filter ($filter)",
      placeHolder: "Step 3 of 5: Pick a boolean value",
      ignoreFocusOut: true
    }
  );

  return picked?.value;
}

async function promptScalarValue(field: FilterableField, operator: FilterBuilderOperatorItem): Promise<string | undefined> {
  if (!operator.requiresValue) {
    return undefined;
  }

  const raw = await vscode.window.showInputBox({
    title: `DV Quick Run: Add Filter ($filter)`,
    prompt: `Enter value for ${field.logicalName}`,
    placeHolder: resolveValuePlaceHolder(field),
    ignoreFocusOut: true
  });

  if (raw === undefined) {
    return undefined;
  }

  const validation = validateFilterRawValue(field, raw);
  if (!validation.ok) {
    vscode.window.showErrorMessage(validation.message);
    return undefined;
  }

  return validation.value;
}

function resolveValuePlaceHolder(field: FilterableField): string {
  const fieldType = resolveFilterBuilderFieldType(field);
  switch (fieldType) {
    case "datetime":
      return "e.g. 2026-03-06T00:00:00Z";
    case "numeric":
    case "choice":
      return "e.g. 0";
    case "boolean":
      return "true or false";
    default:
      return "Enter filter value";
  }
}

async function pickMergeStrategy(existingFilter: string | null): Promise<"replace" | "appendAnd"> {
  if (!existingFilter) {
    return "replace";
  }

  const picked = await vscode.window.showQuickPick(
    [
      { label: "Replace existing filter", value: "replace" as const, description: existingFilter },
      { label: "Append with AND", value: "appendAnd" as const, description: existingFilter }
    ],
    {
      title: "DV Quick Run: Existing $filter found",
      placeHolder: "Step 4 of 5: Choose how to combine the new filter",
      ignoreFocusOut: true
    }
  );

  if (!picked) {
    throw new Error("cancelled");
  }

  return picked.value;
}

function buildInsight(field: FilterableField, fieldType: FilterBuilderFieldType, operator: FilterBuilderOperatorItem, value: string | undefined, mergeStrategy: "replace" | "appendAnd"): BuildFilterInsight {
  const clause: FilterClauseModel = {
    fieldLogicalName: field.logicalName,
    fieldType,
    operator: operator.value,
    valueKind: operator.requiresValue ? "single" : "none",
    value,
    selectToken: field.selectToken
  };

  return {
    kind: "query.mutate.filterExpression",
    expression: {
      combinator: "and",
      clauses: [clause]
    },
    mergeStrategy
  };
}

export async function runAddFilterAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Add Filter ($filter) failed. Check Output.", async () => {
    const target = getLogicalEditorQueryTarget();

    if (looksLikeJsonLine(target.text)) {
      throw new Error("This line appears to be JSON, not a Dataverse query. Use 'Generate Query From JSON' first.");
    }

    const parsed = parseEditorQuery(target.text);
    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
    if (!entitySetName) {
      throw new Error(`Current line does not look like a Dataverse Web API path: ${target.text}`);
    }

    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();
    const defs = await loadEntityDefs(ctx, client, token);
    const entityDef = findEntityByEntitySetName(defs, entitySetName);
    if (!entityDef) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const fields = await loadSelectableFields(ctx, client, token, entityDef.logicalName);
    const eligibleFields = getEligibleFilterBuilderFields(fields);
    if (!eligibleFields.length) {
      throw new Error(`No supported filter-builder fields were found for entity set: ${entitySetName}`);
    }

    const pickedField = await pickField(entityDef.entitySetName, eligibleFields);
    if (!pickedField) {
      return;
    }

    const fieldType = resolveFilterBuilderFieldType(pickedField);
    if (!fieldType) {
      throw new Error(`Field '${pickedField.logicalName}' is not supported by the v0.7.6 filter builder.`);
    }

    const operator = await pickFilterOperator(pickedField);
    if (!operator) {
      return;
    }

    let value: string | undefined;
    if (operator.requiresValue) {
      if (fieldType === "choice") {
        value = await pickChoiceValue(ctx, entityDef.logicalName, pickedField);
      } else if (fieldType === "boolean") {
        value = await pickBooleanValue();
      } else {
        value = await promptScalarValue(pickedField, operator);
      }

      if (value === undefined) {
        return;
      }
    }

    const mergeStrategy = await pickMergeStrategy(parsed.queryOptions.get("$filter"));
    const insight = buildInsight(pickedField, fieldType, operator, value, mergeStrategy);

    await previewAndApplyFilterInsight(target, insight);
  });
}
