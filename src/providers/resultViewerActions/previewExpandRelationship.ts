import type { CommandContext } from "../../commands/context/commandContext.js";
import {
  findEntityByEntitySetName,
  findEntityByLogicalName,
  loadEntityDefByLogicalName,
  loadEntityDefs,
  loadNavigationProperties
} from "../../commands/router/actions/shared/metadataAccess.js";
import {
  findLogicalEditorQueryTargetBySourceTarget,
  getLogicalEditorQueryTarget,
  type StoredEditorQuerySourceTarget
} from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { applyExpand } from "../../commands/router/actions/shared/expand/expandComposer.js";
import { buildEditorQuery, getEntitySetNameFromEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { setQueryOption } from "../../commands/router/actions/shared/queryMutation/queryOptionMutator.js";
import { previewAndApplyMutationResult, type MutationResult } from "../../refinement/queryPreview.js";

type ExpandRelationshipArgs = {
  entitySetName?: string;
  entityLogicalName?: string;
  relationshipFieldLogicalName: string;
  sourceDocumentUri?: string;
  sourceRangeStartLine?: number;
  sourceRangeStartCharacter?: number;
  sourceRangeEndLine?: number;
  sourceRangeEndCharacter?: number;
};

export async function previewAndApplyExpandRelationship(
  ctx: CommandContext,
  args: ExpandRelationshipArgs
): Promise<void> {
  const target = await resolveSourceTarget(args);
  const rawText = extractODataQueryText(target.text);
  if (!rawText || rawText.startsWith("<")) {
    throw new Error("Expand this relationship requires a visible OData query in the editor.");
  }

  const parsed = parseEditorQuery(rawText);
  const entitySetName = args.entitySetName?.trim() || getEntitySetNameFromEditorQuery(parsed.entityPath);
  if (!entitySetName) {
    throw new Error("Could not determine entity set for expand preview.");
  }

  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();
  const defs = await loadEntityDefs(ctx, client, token);

  const baseEntity = args.entityLogicalName?.trim()
    ? (findEntityByLogicalName(defs, args.entityLogicalName) ?? await loadEntityDefByLogicalName(ctx, client, token, args.entityLogicalName))
    : findEntityByEntitySetName(defs, entitySetName);

  if (!baseEntity?.logicalName) {
    throw new Error(`Could not resolve metadata for entity set '${entitySetName}'.`);
  }

  const relationships = await loadNavigationProperties(ctx, client, token, baseEntity.logicalName);
  const relationshipField = args.relationshipFieldLogicalName.trim().toLowerCase();
  const relationship = relationships.find((row) => String(row?.referencingAttribute ?? "").trim().toLowerCase() === relationshipField)
    ?? relationships.find((row) => String(row?.navigationPropertyName ?? "").trim().toLowerCase() === relationshipField);

  if (!relationship) {
    throw new Error(`Could not resolve navigation property for '${args.relationshipFieldLogicalName}'.`);
  }

  const navigationPropertyName = String(relationship.navigationPropertyName ?? "").trim();
  if (!navigationPropertyName) {
    throw new Error(`Resolved relationship '${args.relationshipFieldLogicalName}' has no navigation property name.`);
  }

  const targetLogicalName = [relationship.referencedEntity, relationship.referencingEntity]
    .map((value) => String(value ?? "").trim())
    .find((value) => !!value && value.toLowerCase() !== baseEntity.logicalName.toLowerCase());

  if (!targetLogicalName) {
    throw new Error(`Could not determine the target entity for '${navigationPropertyName}'.`);
  }

  const targetEntity = findEntityByLogicalName(defs, targetLogicalName)
    ?? await loadEntityDefByLogicalName(ctx, client, token, targetLogicalName);

  const isOwnerRelationship = navigationPropertyName.toLowerCase() === "ownerid";

  const selectTokens = isOwnerRelationship
    ? Array.from(new Set([
        String(relationship.referencedAttribute ?? "").trim(),
        String(targetEntity?.primaryIdAttribute ?? "").trim()
      ].filter(Boolean)))
    : Array.from(new Set([
        targetEntity?.primaryNameAttribute,
        targetEntity?.primaryIdAttribute
      ].map((value) => String(value ?? "").trim()).filter(Boolean)));

  const expandClause = applyExpand(parsed.queryOptions.get("$expand") ?? undefined, {
    relationship: navigationPropertyName,
    select: selectTokens
  });

  setQueryOption(parsed, "$expand", expandClause);
  const updatedQuery = buildEditorQuery(parsed);

  const result: MutationResult = {
    originalQuery: rawText,
    updatedQuery,
    summary: `Expand ${navigationPropertyName}`
  };

  await previewAndApplyMutationResult(
    { ...target, text: rawText },
    result,
    {
      heading: "Preview Expand Relationship",
      sections: [
        { label: "Relationship", value: navigationPropertyName },
        { label: "Target entity", value: targetEntity?.entitySetName ?? targetLogicalName },
        { label: "Default $select", value: selectTokens.join(",") || "(none)" }
      ]
    }
  );
}

async function resolveSourceTarget(args: ExpandRelationshipArgs) {
  const hasStoredSource = !!args.sourceDocumentUri
    && args.sourceRangeStartLine !== undefined
    && args.sourceRangeStartCharacter !== undefined
    && args.sourceRangeEndLine !== undefined
    && args.sourceRangeEndCharacter !== undefined;

  if (hasStoredSource) {
    return findLogicalEditorQueryTargetBySourceTarget({
      sourceDocumentUri: args.sourceDocumentUri ?? "",
      sourceRangeStartLine: Number(args.sourceRangeStartLine),
      sourceRangeStartCharacter: Number(args.sourceRangeStartCharacter),
      sourceRangeEndLine: Number(args.sourceRangeEndLine),
      sourceRangeEndCharacter: Number(args.sourceRangeEndCharacter)
    } as StoredEditorQuerySourceTarget);
  }

  return getLogicalEditorQueryTarget();
}

function extractODataQueryText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^Run Query\s*\|\s*Explain\s*/i, "").trim();
}
