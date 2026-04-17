import * as vscode from "vscode";
import { findLogicalEditorQueryTargetByText, getLogicalEditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import {
  buildEditorQuery,
  getEntitySetNameFromEditorQuery,
  parseEditorQuery
} from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import type { CommandContext } from "../commands/context/commandContext.js";
import { loadEntityDefByEntitySetName, loadFields } from "../commands/router/actions/shared/metadataAccess.js";
import { getSelectableFields } from "../commands/router/actions/shared/selectableFields.js";

import { previewAndApplyMutationResult, type MutationResult } from "./queryPreview.js";
import { parseExpandClause, serializeExpandNodes, type ExpandNode } from "../commands/router/actions/shared/expand/expandComposer.js";
import { loadNavigationProperties } from "../commands/router/actions/shared/metadataAccess/metadataNavigationAccess.js";

export async function previewAndApplyAddSelectInActiveEditor(ctx: CommandContext): Promise<void> {
  const target = getLogicalEditorQueryTarget();
  const scope = getNearestSelectScope(target);

  const entitySetName = getEntitySetNameFromEditorQuery(parseEditorQuery(target.text).entityPath);
  if (!entitySetName) {
    throw new Error("Could not determine the Dataverse entity set for the current query.");
  }

  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();
  const rootEntityDef = await loadEntityDefByEntitySetName(ctx, client, token, entitySetName);
  if (!rootEntityDef) {
    throw new Error(`Could not resolve metadata for entity set '${entitySetName}'.`);
  }

  const targetLogicalName = await resolveScopeLogicalName(
    ctx,
    client,
    token,
    rootEntityDef.logicalName,
    scope.relationshipPath
  );

  const fields = await loadFields(ctx, client, token, targetLogicalName);
  const selectable = getSelectableFields(fields);

  const picked = await vscode.window.showQuickPick(
    selectable.map((field) => ({
      label: field.logicalName,
      description: field.attributeType,
      detail: `$select token: ${field.selectToken}`,
      token: field.selectToken as string
    })),
    {
      title: `DV Quick Run: Preview Add Fields ($select) — ${scope.relationshipPath.length ? scope.relationshipPath.join(" -> ") : rootEntityDef.entitySetName}`,
      placeHolder: scope.relationshipPath.length
        ? `Pick fields to preview in $select for ${scope.relationshipPath[scope.relationshipPath.length - 1]}`
        : "Pick fields to preview in $select",
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
  const previewQuery = buildAddSelectPreviewForScope(target.text, selectedTokens, scope.relationshipPath);
  const result: MutationResult = {
    originalQuery: target.text,
    updatedQuery: previewQuery,
    summary: scope.relationshipPath.length
      ? `Add $select=${selectedTokens.join(",")} to ${scope.relationshipPath.join(" -> ")}`
      : `Add $select=${selectedTokens.join(",")}`
  };

  await previewAndApplyMutationResult(target, result, {
    heading: result.summary ?? "Add Select Fields Preview"
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

  return buildAddSelectPreviewForScope(queryText, selectTokens, []);
}

export function buildAddSelectPreviewForScope(
  queryText: string,
  selectTokens: string[],
  relationshipPath: string[]
): string {
  if (!queryText || !queryText.trim()) {
    throw new Error("Target query text is required.");
  }

  if (!selectTokens.length) {
    throw new Error("At least one $select field is required.");
  }

  const parsed = parseEditorQuery(queryText);

  if (!relationshipPath.length) {
    const updated = new URLSearchParams(parsed.queryOptions.toString());
    const merged = mergeTokens(updated.get("$select"), selectTokens);
    updated.set("$select", merged.join(","));
    parsed.queryOptions = updated;
    return buildEditorQuery(parsed);
  }

  const expandValue = parsed.queryOptions.get("$expand") ?? undefined;
  const expanded = parseExpandClause(expandValue);
  if (!expanded.length) {
    throw new Error("Query does not contain $expand.");
  }

  const updatedExpand = applySelectTokensToExpandPath(expanded, relationshipPath, selectTokens);
  parsed.queryOptions.set("$expand", serializeExpandNodes(updatedExpand));
  return buildEditorQuery(parsed);
}

export async function previewAndApplyAddSelectForQueryInEditor(ctx: CommandContext, queryText: string): Promise<void> {
  const target = findLogicalEditorQueryTargetByText(queryText);
  const parsed = parseEditorQuery(target.text);

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

function mergeTokens(existing: string | null | undefined, additions: string[]): string[] {
  const tokens = [
    ...(existing ? existing.split(",").map((token) => token.trim()).filter(Boolean) : []),
    ...additions.map((token) => token.trim()).filter(Boolean)
  ];

  return Array.from(new Set(tokens));
}

function applySelectTokensToExpandPath(nodes: ExpandNode[], relationshipPath: string[], selectTokens: string[]): ExpandNode[] {
  return nodes.map((node) => {
    if (node.relationship.toLowerCase() !== relationshipPath[0].toLowerCase()) {
      return node;
    }

    if (relationshipPath.length === 1) {
      return {
        ...node,
        select: mergeTokens((node.select ?? []).join(","), selectTokens)
      };
    }

    return {
      ...node,
      expand: applySelectTokensToExpandPath(node.expand ?? [], relationshipPath.slice(1), selectTokens)
    };
  });
}

type SelectScope = {
  relationshipPath: string[];
};

export function getNearestSelectScope(target: { editor: vscode.TextEditor; range: vscode.Range; text: string }): SelectScope {
  const cursor = target.editor.selection.active;
  if (!target.range.contains(cursor)) {
    return { relationshipPath: [] };
  }

  const beforeCursorText = getLogicalTextUntilCursor(target);
  const parsed = parseEditorQuery(target.text);
  const expand = parsed.queryOptions.get("$expand");
  if (!expand) {
    return { relationshipPath: [] };
  }

  const expandTokenIndex = target.text.indexOf("$expand=");
  if (expandTokenIndex === -1) {
    return { relationshipPath: [] };
  }

  const expandValueStart = expandTokenIndex + "$expand=".length;
  const relativeOffset = Math.max(0, beforeCursorText.length - expandValueStart);
  const path = findExpandRelationshipPathAtOffset(expand, relativeOffset);
  return { relationshipPath: path ?? [] };
}

function getLogicalTextUntilCursor(target: { editor: vscode.TextEditor; range: vscode.Range }): string {
  const document = target.editor.document;
  const cursor = target.editor.selection.active;
  const pieces: string[] = [];

  for (let line = target.range.start.line; line <= cursor.line; line += 1) {
    const full = document.lineAt(line).text;
    let part = full;
    if (line === target.range.start.line) {
      part = part.slice(target.range.start.character);
    }
    if (line === cursor.line) {
      part = part.slice(0, cursor.character - (line === target.range.start.line ? target.range.start.character : 0));
    }
    pieces.push(part.trim());
  }

  return pieces.join("");
}

function findExpandRelationshipPathAtOffset(expand: string, offset: number): string[] | undefined {
  return findExpandRelationshipPathInRange(expand, 0, expand.length, offset, []);
}

function findExpandRelationshipPathInRange(expand: string, start: number, end: number, offset: number, path: string[]): string[] | undefined {
  let depth = 0;
  let itemStart = start;

  const flush = (itemEnd: number): string[] | undefined => {
    const item = expand.slice(itemStart, itemEnd).trim();
    if (!item) {
      return undefined;
    }
    const rawStart = expand.indexOf(item, itemStart);
    const rawEnd = rawStart + item.length;
    if (offset < rawStart || offset > rawEnd) {
      return undefined;
    }

    const open = item.indexOf("(");
    if (open === -1) {
      return [...path, item];
    }

    const relationship = item.slice(0, open).trim();
    const closeInItem = item.lastIndexOf(")");
    if (closeInItem <= open) {
      return [...path, relationship];
    }

    const inner = item.slice(open + 1, closeInItem);
    const innerOffsetStart = rawStart + open + 1;
    const nestedExpandIndex = findTopLevelOptionIndex(inner, "$expand=");
    if (nestedExpandIndex === -1) {
      return [...path, relationship];
    }

    const nestedStart = innerOffsetStart + nestedExpandIndex + "$expand=".length;
    const nestedValue = inner.slice(nestedExpandIndex + "$expand=".length);
    const relativeNestedOffset = offset - nestedStart;
    if (relativeNestedOffset < 0 || relativeNestedOffset > nestedValue.length) {
      return [...path, relationship];
    }

    const nested = findExpandRelationshipPathAtOffset(nestedValue, relativeNestedOffset);
    return nested ? [...path, relationship, ...nested] : [...path, relationship];
  };

  for (let i = start; i < end; i += 1) {
    const ch = expand[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    } else if (ch === "," && depth === 0) {
      const result = flush(i);
      if (result) {
        return result;
      }
      itemStart = i + 1;
    }
  }

  return flush(end);
}

function findTopLevelOptionIndex(input: string, token: string): number {
  let depth = 0;
  for (let i = 0; i <= input.length - token.length; i += 1) {
    const ch = input[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && input.slice(i, i + token.length).toLowerCase() === token.toLowerCase()) {
      return i;
    }
  }
  return -1;
}

export async function resolveScopeLogicalName(
  ctx: CommandContext,
  client: any,
  token: string,
  rootLogicalName: string,
  relationshipPath: string[]
): Promise<string> {
  let currentLogicalName = rootLogicalName;

  for (const relationship of relationshipPath) {
    const relationships = await loadNavigationProperties(ctx, client, token, currentLogicalName);
    const hit = relationships.find((rel) => String(rel?.navigationPropertyName ?? "").trim().toLowerCase() === relationship.trim().toLowerCase());
    if (!hit) {
      throw new Error(`Could not resolve navigation property '${relationship}' from '${currentLogicalName}'.`);
    }

    const candidateTargets = [hit?.referencedEntity, hit?.referencingEntity]
      .map((value: unknown) => String(value ?? "").trim())
      .filter((value: string) => !!value);

    const nextLogicalName = candidateTargets.find((value: string) => value.toLowerCase() !== currentLogicalName.toLowerCase());
    if (!nextLogicalName) {
      throw new Error(`Could not resolve target logical name for '${relationship}'.`);
    }

    currentLogicalName = nextLogicalName;
  }

  return currentLogicalName;
}
