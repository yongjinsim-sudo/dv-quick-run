import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { addQueryToHistory } from "../../../../utils/queryHistory.js";
import { SmartMetadataSession } from "../smart/shared/smartMetadataSession.js";
import { SmartField, SmartGetFilterState, SmartGetState } from "./smartGetTypes.js";
import { buildGetCurl, buildQueryFromState } from "./smartGetQueryBuilder.js";
import {
  buildFilterClause,
  pickOptionalFilterField,
  pickFilterOperator,
  promptSmartGetFilterValue,
  promptSmartGetTop,
  stringifyExpr,
  validateSmartGetFilterValue
} from "./smartGetFilters.js";
import { getFieldsForEntity, pickSmartGetEntity, pickSmartGetFields } from "./smartGetFieldSelection.js";
import { promptOrderBy } from "./smartGetOrderBy.js";

export async function buildOrEditState(
  session: SmartMetadataSession,
  initial?: SmartGetState
): Promise<{ state: SmartGetState; fields: SmartField[] } | undefined> {
  const defs = await session.getEntityDefs();
  const def = await pickSmartGetEntity(defs, initial?.entityLogicalName);
  if (!def) {return undefined;}

  const fields = await session.getSmartFields(def.logicalName);

  const pickedFields = await pickSmartGetFields(def, fields, initial?.selectedFieldLogicalNames);
  if (!pickedFields) {return undefined;}

  const selectedFieldLogicalNames = pickedFields.map((f) => f.logicalName);

  const preFilterField = initial?.filter?.fieldLogicalName;
  const filterField = await pickOptionalFilterField(fields, preFilterField);

  let filter: SmartGetFilterState | undefined;

  if (filterField) {
    const preExpr = initial?.filter?.expr;
    const expr = await pickFilterOperator(filterField, preExpr);
    if (!expr) {return undefined;}

    const value = await promptSmartGetFilterValue(
      filterField,
      initial?.filter?.fieldLogicalName?.toLowerCase() === filterField.logicalName.toLowerCase()
        ? initial?.filter?.rawValue
        : undefined
    );

    if (value && value.length > 0) {
      const validationMessage = validateSmartGetFilterValue(filterField, value);
      if (validationMessage) {
        vscode.window.showErrorMessage(validationMessage);
        return undefined;
      }

      filter = { fieldLogicalName: filterField.logicalName, expr, rawValue: value };
    }
  }

  const top = await promptSmartGetTop(initial?.top);
  if (top === undefined) {return undefined;}

  const orderBy = await promptOrderBy(pickedFields, initial?.orderBy);

  const state: SmartGetState = {
    entityLogicalName: def.logicalName,
    entitySetName: def.entitySetName,
    selectedFieldLogicalNames,
    top,
    filter,
    orderBy
  };

  return { state, fields };
}

type ReviewChoice =
  | { kind: "run" }
  | { kind: "editEntity" }
  | { kind: "editFields" }
  | { kind: "editFilter" }
  | { kind: "editOrderBy" }
  | { kind: "editTop" }
  | { kind: "copyPath" }
  | { kind: "copyFullUrl" }
  | { kind: "openInRunGet" }
  | { kind: "copyCurl" }
  | { kind: "cancel" };

export async function reviewAndEditLoop(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  session: SmartMetadataSession,
  initial: SmartGetState,
  initialFields: SmartField[]
): Promise<{ state: SmartGetState; fields: SmartField[] } | undefined> {
  let current = initial;
  let fields = initialFields;

  while (true) {
    const filterText = current.filter
      ? `${current.filter.fieldLogicalName} ${stringifyExpr(current.filter.expr)} ${current.filter.rawValue}`
      : "(none)";

    const orderByText = current.orderBy ? `${current.orderBy.fieldLogicalName} ${current.orderBy.direction}` : "(none)";

    const { path } = buildQueryFromState(current, fields, buildFilterClause);
    const fullUrl = `${(await ctx.getBaseUrl()).replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

    const items: Array<{ label: string; description?: string; choice: ReviewChoice }> = [
      { label: "✅ Run", description: "Execute the query now", choice: { kind: "run" } },
      { label: "✏️ Edit entity", description: `${current.entitySetName} (${current.entityLogicalName})`, choice: { kind: "editEntity" } },
      { label: "✏️ Edit fields", description: `${current.selectedFieldLogicalNames.length} selected`, choice: { kind: "editFields" } },
      { label: "✏️ Edit filter", description: filterText, choice: { kind: "editFilter" } },
      { label: "✏️ Edit $orderby", description: orderByText, choice: { kind: "editOrderBy" } },
      { label: "✏️ Edit $top", description: String(current.top), choice: { kind: "editTop" } },
      { label: "📋 Copy query path", description: "Copies <entitySet>?$select=... to clipboard", choice: { kind: "copyPath" } },
      { label: "📋 Copy GET as curl", description: "Copies curl command to clipboard", choice: { kind: "copyCurl" }},
      { label: "🧾 Copy full URL", description: "Copies https://.../api/data/v9.2/<entitySet>?... to clipboard", choice: { kind: "copyFullUrl" } },
      { label: "➡️ Open in Run GET", description: "Prefills Run GET with this query", choice: { kind: "openInRunGet" } },
      { label: "❌ Cancel", choice: { kind: "cancel" } }
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: "DV Quick Run: Review Smart GET",
      placeHolder: "Run or adjust parameters",
      ignoreFocusOut: true
    });

    const choice = picked?.choice;
    if (!choice) {return undefined;}
    if (choice.kind === "cancel") {return undefined;}

    if (choice.kind === "copyPath") {
      await vscode.env.clipboard.writeText(path);
      vscode.window.showInformationMessage("DV Quick Run: Query path copied to clipboard.");
      continue;
    }

    if (choice.kind === "copyFullUrl") {
      await vscode.env.clipboard.writeText(fullUrl);
      vscode.window.showInformationMessage("DV Quick Run: Full URL copied to clipboard.");
      continue;
    }

    if (choice.kind === "openInRunGet") {
      await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));
      await vscode.commands.executeCommand("dvQuickRun.runGet");
      return undefined;
    }

    if (choice.kind === "run") {
      return { state: current, fields };
    }

    if (choice.kind === "editTop") {
      const top = await promptSmartGetTop(current.top);
      if (top === undefined) {return undefined;}
      current = { ...current, top };
      continue;
    }

    if (choice.kind === "editOrderBy") {
      const fieldMap = new Map(fields.map((f) => [f.logicalName.toLowerCase(), f]));
      const selected = current.selectedFieldLogicalNames
        .map((ln) => fieldMap.get(ln.toLowerCase()))
        .filter((x): x is SmartField => !!x);

      const orderBy = await promptOrderBy(selected, current.orderBy);
      current = { ...current, orderBy };
      continue;
    }

    if (choice.kind === "editEntity") {
      const edited = await buildOrEditState(session, current);
      if (!edited) {return undefined;}
      current = edited.state;
      fields = edited.fields;
      continue;
    }

    if (choice.kind === "copyCurl") {
      const curl = buildGetCurl(fullUrl);
      await vscode.env.clipboard.writeText(curl);
      vscode.window.showInformationMessage("DV Quick Run: curl command copied.");
      continue;
    }

    if (choice.kind === "editFields") {
      const currentDef = await session.getEntityByLogicalName(current.entityLogicalName);
      if (!currentDef) {return undefined;}

      const pickedFields = await pickSmartGetFields(currentDef, fields, current.selectedFieldLogicalNames);
      if (!pickedFields) {return undefined;}

      current = { ...current, selectedFieldLogicalNames: pickedFields.map((f) => f.logicalName) };
      continue;
    }

    if (choice.kind === "editFilter") {
      const filterField = await pickOptionalFilterField(fields, current.filter?.fieldLogicalName);
      if (!filterField) {
        current = { ...current, filter: undefined };
        continue;
      }

      const expr = await pickFilterOperator(filterField, current.filter?.expr);
      if (!expr) {return undefined;}

      const value = await promptSmartGetFilterValue(
        filterField,
        current.filter?.fieldLogicalName?.toLowerCase() === filterField.logicalName.toLowerCase()
          ? current.filter?.rawValue
          : undefined
      );

      if (!value || value.length === 0) {
        current = { ...current, filter: undefined };
        continue;
      }

      const validationMessage = validateSmartGetFilterValue(filterField, value);
      if (validationMessage) {
        vscode.window.showErrorMessage(validationMessage);
        continue;
      }

      current = {
        ...current,
        filter: { fieldLogicalName: filterField.logicalName, expr, rawValue: value }
      };
      continue;
    }
  }
}

export async function getGuidTargetFields(
  session: SmartMetadataSession,
  entityLogicalName: string,
  ctx: CommandContext,
  client: DataverseClient,
  token: string
): Promise<SmartField[]> {
  return getFieldsForEntity(ctx, client, token, entityLogicalName, session);
}
