import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { logDebug, logError, logInfo, logWarn } from "../../../utils/logger.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";
import { getQueryHistory, addQueryToHistory } from "../../../utils/queryHistory.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { EntityDef } from "../../../utils/entitySetCache.js";

import { ACTIONS, Action } from "./get/getTypes.js";
import { getEntityDefs, getFieldsForEntity } from "./get/getMetadata.js";
import {
  normalizePath,
  buildResultTitle,
  selectTokenForField,
  buildTopQuery,
  buildCustomQuery
} from "./get/getQueryBuilder.js";
import {
  analyzeQueryGuardrails,
  confirmGuardrailsIfNeeded,
  showGuardrailErrors
} from "./shared/guardrails/queryGuardrails.js";


async function pickEntity(defs: EntityDef[]): Promise<EntityDef | undefined> {
  const picked = await vscode.window.showQuickPick(
    defs.map((d) => ({
      label: d.entitySetName,
      description: d.logicalName,
      def: d
    })),
    {
      title: "DV Quick Run: Pick table",
      placeHolder: "Type to filter (e.g. acc → accounts)",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.def;
}

async function pickAction(entitySetName: string): Promise<Action | undefined> {
  const picked = await vscode.window.showQuickPick(ACTIONS as readonly string[], {
    title: `DV Quick Run: ${entitySetName}`,
    placeHolder: "Choose an action",
    ignoreFocusOut: true
  });

  if (!picked) {return undefined;}
  if ((ACTIONS as readonly string[]).includes(picked)) {return picked as Action;}
  return undefined;
}

async function buildSelectFieldsQuery(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  def: EntityDef
): Promise<string | undefined> {
  const fields = await getFieldsForEntity(ctx, client, token, def.logicalName);

  const selectableCount = fields.filter((f) => !!selectTokenForField(f)).length;
  logDebug(ctx.output,`Selectable fields for ${def.logicalName}: ${selectableCount} / ${fields.length}`);

  const picked = await vscode.window.showQuickPick(
    fields.map((f) => {
      const tok = selectTokenForField(f);
      return {
        label: f.logicalName,
        description: f.attributeType || "",
        detail: tok ? `$select token: ${tok}` : "Not selectable via $select",
        field: f
      };
    }),
    {
      title: `DV Quick Run: $select (${def.entitySetName})`,
      placeHolder: "Pick fields (multi-select). Type to filter.",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {return undefined;}

  const tokens = picked.map((x) => selectTokenForField(x.field)).filter((x): x is string => !!x);

  if (tokens.length === 0) {
    vscode.window.showWarningMessage("DV Quick Run: None of the selected fields are selectable via $select.");
    return undefined;
  }

  const topRaw = (await vscode.window.showInputBox({
    title: `DV Quick Run: $top (${def.entitySetName})`,
    prompt: "Enter $top (default 10). Leave blank for 10.",
    placeHolder: "10",
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {return undefined;}
      return /^\d+$/.test(t) ? undefined : "Enter a whole number (e.g. 10)";
    }
  }))?.trim();

  const top = topRaw && topRaw.length ? parseInt(topRaw, 10) : 10;
  const select = tokens.join(",");

  return `${def.entitySetName}?$select=${select}&$top=${top}`;
}

async function promptForQuery(
  ctx: CommandContext,
  client: DataverseClient,
  token: string
): Promise<string | undefined> {
  const history = getQueryHistory(ctx.ext);

  if (history.length > 0) {
    const divider = "──────────";
    const typeNew = "Type a new query...";

    const picked = await vscode.window.showQuickPick([...history, divider, typeNew], {
      placeHolder: "Select a previous query, or type a new one",
      ignoreFocusOut: true
    });

    if (!picked) {return undefined;}

    if (picked !== divider && picked !== typeNew) {
      return picked.trim();
    }
  }

  const defs = await getEntityDefs(ctx, client, token);
  const def = await pickEntity(defs);
  if (!def) {return undefined;}

  const action = await pickAction(def.entitySetName);
  if (!action) {return undefined;}

  if (action === "Top 10") {return buildTopQuery(def.entitySetName, 10);}

  if (action === "Select fields") {
    return await buildSelectFieldsQuery(ctx, client, token, def);
  }

  const query = (await vscode.window.showInputBox({
    title: "DV Quick Run: OData query (optional)",
    prompt: "Enter OData query (e.g. $top=10 or $select=name&$top=5). Leave blank for none.",
    placeHolder: "$top=10",
    ignoreFocusOut: true
  }))?.trim();

  return buildCustomQuery(def.entitySetName, query);
}

export async function runGetAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);

    const token = await ctx.getToken(scope);
    const client = ctx.getClient(baseUrl);

    const input = await promptForQuery(ctx, client, token);
    if (!input) {return;}

    const guardrails = await analyzeQueryGuardrails(ctx, client, token, input);

    if (guardrails.hasErrors) {
      await showGuardrailErrors(guardrails);
      return;
    }

    const shouldContinue = await confirmGuardrailsIfNeeded(guardrails);
    if (!shouldContinue) {
      logWarn(ctx.output,"Run GET cancelled by guardrails.");
      return;
    }

    await addQueryToHistory(ctx.ext, input);

    const path = normalizePath(input);

    logInfo(ctx.output,`Query: ${path}`);
    logInfo(ctx.output,`GET ${path}`);

    const result = await client.get(path, token);
    await showJsonNamed(buildResultTitle(path), result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Run GET failed. Check Output.");
  }
}