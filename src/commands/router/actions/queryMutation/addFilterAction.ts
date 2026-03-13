import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { loadSelectableFields } from "../shared/metadataAccess.js";
import { setQueryOption } from "../shared/queryMutation/queryOptionMutator.js";
import { type FilterExpr, type FilterableField, getFilterOperatorOptions, getFilterValuePrompt, buildFilterClause } from "../shared/queryMutation/filterExpressionRules.js";
import { validateFilterRawValue } from "../shared/queryMutation/filterValueValidation.js";
import { runQueryMutationAction } from "../shared/queryMutation/runQueryMutationAction.js";

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
      placeHolder: "Step 1 of 3: Pick a field to filter on",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.field;
}

async function pickFilterOperator(field: FilterableField): Promise<FilterExpr | undefined> {
  const items = getFilterOperatorOptions(field);

  const picked = await vscode.window.showQuickPick(items, {
    title: `DV Quick Run: Add Filter ($filter) — ${field.logicalName}`,
    placeHolder: "Step 2 of 3: Choose an operator",
    ignoreFocusOut: true,
    matchOnDescription: true
  });

  return picked?.value;
}

async function promptFilterValue(field: FilterableField, expr: FilterExpr): Promise<string | undefined> {
  if (!expr.requiresValue) {
    return "";
  }

  const promptInfo = getFilterValuePrompt(field, expr);

  const raw = await vscode.window.showInputBox({
    title: `DV Quick Run: Add Filter ($filter)`,
    prompt: promptInfo.prompt,
    placeHolder: promptInfo.placeHolder,
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

async function pickExistingFilterStrategy(existingFilter: string): Promise<"replace" | "and" | "or" | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Replace existing $filter", value: "replace" as const, description: existingFilter },
      { label: "Append with AND", value: "and" as const, description: existingFilter },
      { label: "Append with OR", value: "or" as const, description: existingFilter }
    ],
    {
      title: "DV Quick Run: Existing $filter found",
      placeHolder: "Choose how to combine the new filter",
      ignoreFocusOut: true
    }
  );

  return picked?.value;
}

export async function runAddFilterAction(ctx: CommandContext): Promise<void> {
  await runQueryMutationAction(
    ctx,
    "Add Filter ($filter)",
    "DV Quick Run: Added filter to $filter.",
    async ({ parsed, token, client, entityDef }) => {
      const fields = await loadSelectableFields(ctx, client, token, entityDef.logicalName);

      const pickedField = await pickField(entityDef.entitySetName, fields);
      if (!pickedField) {
        return false;
      }

      const expr = await pickFilterOperator(pickedField);
      if (!expr) {
        return false;
      }

      const rawValue = await promptFilterValue(pickedField, expr);
      if (rawValue === undefined) {
        return false;
      }

      const newClause = buildFilterClause(pickedField, expr, rawValue);

      const existingFilter = parsed.queryOptions.get("$filter");
      let strategy: "replace" | "and" | "or" = "replace";

      if (existingFilter) {
        const pickedStrategy = await pickExistingFilterStrategy(existingFilter);
        if (!pickedStrategy) {
          return false;
        }
        strategy = pickedStrategy;
      }

      const mergedFilter = mergeFilter(existingFilter, newClause, strategy);
      setQueryOption(parsed, "$filter", mergedFilter);

      return true;
    },
    (targetText) => {
      if (looksLikeJsonLine(targetText)) {
        return new Error(
          "This line appears to be JSON, not a Dataverse query. Use 'Generate Query From JSON' first."
        );
      }

      return new Error(`Current line does not look like a Dataverse Web API path: ${targetText}`);
    }
  );
}

function mergeFilter(existingFilter: string | null, newClause: string, strategy: "replace" | "and" | "or"): string {
  if (!existingFilter || strategy === "replace") {
    return newClause;
  }

  return `(${existingFilter}) ${strategy} (${newClause})`;
}
