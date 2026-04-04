import * as vscode from "vscode";
import { getLogicalEditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import {
  buildEditorQuery,
  getEntitySetNameFromEditorQuery,
  parseEditorQuery
} from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import type { CommandContext } from "../commands/context/commandContext.js";
import { loadEntityDefByEntitySetName, loadFields } from "../commands/router/actions/shared/metadataAccess.js";
import { getSelectableFields } from "../commands/router/actions/shared/selectableFields.js";

import { previewAndApplyMutationResult, type MutationResult } from "./queryPreview.js";

export async function previewAndApplyAddSelectInActiveEditor(ctx: CommandContext): Promise<void> {
  const target = getLogicalEditorQueryTarget();
  const parsed = parseEditorQuery(target.text);

  if (parsed.queryOptions.has("$select")) {
    void vscode.window.showWarningMessage("DV Quick Run: The detected query already contains $select.");
    return;
  }

  const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
  if (!entitySetName) {
    throw new Error("Could not determine the Dataverse entity set for the current query.");
  }

  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();
  const entityDef = await loadEntityDefByEntitySetName(ctx, client, token, entitySetName);
  if (!entityDef) {
    throw new Error(`Could not resolve metadata for entity set '${entitySetName}'.`);
  }

  const fields = await loadFields(ctx, client, token, entityDef.logicalName);
  const selectable = getSelectableFields(fields);

  const picked = await vscode.window.showQuickPick(
    selectable.map((field) => ({
      label: field.logicalName,
      description: field.attributeType,
      detail: `$select token: ${field.selectToken}`,
      token: field.selectToken as string
    })),
    {
      title: `DV Quick Run: Preview Add Fields ($select) — ${entityDef.entitySetName}`,
      placeHolder: "Pick fields to preview in $select",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {
    return;
  }

  const selectedTokens = picked.map((item) => item.token);
  const previewQuery = buildAddSelectPreviewFromTarget(target, selectedTokens);
  const result: MutationResult = {
    originalQuery: target.text,
    updatedQuery: previewQuery,
    summary: `Add $select=${selectedTokens.join(",")}`
  };

  await previewAndApplyMutationResult(target, result, {
    heading: `Add $select=${selectedTokens.join(",")}`
  });
}

export function buildAddSelectPreviewFromTarget(
  target: { text?: string; queryText?: string },
  selectTokens: string[]
): string {
  const queryText = target.text ?? target.queryText;
  if (!queryText || !queryText.trim()) {
    throw new Error("Target query text is required.");
  }

  if (!selectTokens.length) {
    throw new Error("At least one $select field is required.");
  }

  const parsed = parseEditorQuery(queryText);
  if (parsed.queryOptions.has("$select")) {
    throw new Error("Query already contains $select.");
  }

  const updated = new URLSearchParams(parsed.queryOptions.toString());
  updated.set("$select", selectTokens.join(","));
  parsed.queryOptions = updated;

  return buildEditorQuery(parsed);
}

