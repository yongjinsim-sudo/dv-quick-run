import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { addQueryToHistory } from "../../../../utils/queryHistory.js";
import { shouldExecuteQueryWithGuardrails } from "../shared/guardrails/guardedExecution.js";
import { buildResultTitle, buildQueryFromState, normalizePath } from "./smartGetQueryBuilder.js";
import { saveLastSmartGetState } from "./smartGetPersistence.js";
import { buildFilterClause, isGuidLike } from "./smartGetFilters.js";
import { SmartField, SmartGetState } from "./smartGetTypes.js";

export function getSelectedGuidOrThrow(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {throw new Error("No active editor.");}

  const raw = editor.document.getText(editor.selection).trim();
  if (!raw) {throw new Error("Select a GUID first.");}

  const cleaned = raw.replace(/^[\s{"'(\[]+|[\s}"')\]]+$/g, "").trim();

  if (!isGuidLike(cleaned)) {
    throw new Error(`Selection is not a GUID: ${raw}`);
  }

  return cleaned;
}

export function ensureTransportPath(path: string): string {
  const t = path.trim();
  if (!t) {return "";}
  return t.startsWith("/") ? t : `/${t}`;
}

export async function executeSmartGetState(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  state: SmartGetState,
  fields: SmartField[]
): Promise<void> {
  const { path } = buildQueryFromState(state, fields, buildFilterClause);
  const transportPath = ensureTransportPath(path);

  const shouldExecute = await shouldExecuteQueryWithGuardrails(
    ctx,
    client,
    token,
    path,
    "Smart GET execution cancelled by guardrails."
  );

  if (!shouldExecute) {
    return;
  }

  await saveLastSmartGetState(ctx, state);
  await addQueryToHistory(ctx.ext, path.replace(/^\//, ""));

  logInfo(ctx.output, `Smart GET: entity=${state.entitySetName} fields=${state.selectedFieldLogicalNames.length}`);
  logDebug(ctx.output, `GET ${transportPath}`);

  const result = await client.get(transportPath, token);
  await showJsonNamed(buildResultTitle(path), result);
}

export async function executeSmartGetGuidRaw(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  entitySetName: string,
  guid: string
): Promise<void> {
  const path = normalizePath(`${entitySetName}(${guid})`);
  const transportPath = ensureTransportPath(path);

  logInfo(ctx.output, `Smart GET (GUID raw): entity=${entitySetName}`);
  logDebug(ctx.output, `GET ${transportPath}`);

  const shouldExecute = await shouldExecuteQueryWithGuardrails(
    ctx,
    client,
    token,
    path,
    "Smart GET GUID execution cancelled by guardrails."
  );

  if (!shouldExecute) {
    return;
  }

  const result = await client.get(transportPath, token);
  await showJsonNamed(buildResultTitle(path), result);
}

export async function executeSmartGetGuidPickFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  entitySetName: string,
  guid: string,
  selectTokens: string[]
): Promise<void> {
  const select = selectTokens.join(",");
  const path = normalizePath(`${entitySetName}(${guid})?$select=${select}`);
  const transportPath = ensureTransportPath(path);

  logInfo(ctx.output, `Smart GET (GUID pick fields): entity=${entitySetName} fields=${selectTokens.length}`);
  logDebug(ctx.output, `GET ${transportPath}`);

  const shouldExecute = await shouldExecuteQueryWithGuardrails(
    ctx,
    client,
    token,
    path,
    "Smart GET GUID execution cancelled by guardrails."
  );

  if (!shouldExecute) {
    return;
  }

  const result = await client.get(transportPath, token);
  await showJsonNamed(buildResultTitle(path), result);
}
