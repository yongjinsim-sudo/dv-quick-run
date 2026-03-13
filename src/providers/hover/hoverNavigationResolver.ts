import * as vscode from "vscode";
import { buildNavigationPropertyHover } from "./hoverBuilders.js";
import { isHoverCancelled, normalizeWord } from "./hoverCommon.js";
import {
  getCachedNavigationHoverEnrichment,
  pickPreferredExampleField,
  pickSuggestedFields,
  setCachedNavigationHoverEnrichment,
  tokenAppearsInExpand
} from "./hoverNavigation.js";
import { findEntityByEntitySetName, type HoverRequestContext } from "./hoverRequestContext.js";

export async function resolveNavigationHover(args: {
  lineText: string;
  entitySetName: string;
  hoveredWord: string;
  requestContext: HoverRequestContext;
  token: vscode.CancellationToken;
}): Promise<vscode.Hover | undefined> {
  const { lineText, entitySetName, hoveredWord, requestContext, token } = args;

  if (!tokenAppearsInExpand(lineText, hoveredWord)) {
    return undefined;
  }

  const defs = await requestContext.getEntityDefs();
  const entity = findEntityByEntitySetName(defs, entitySetName);

  if (!entity || isHoverCancelled(token)) {
    return undefined;
  }

  const navs = await requestContext.getNavigationProperties(entity.logicalName);
  const navMatch = navs.find(
    (n) => normalizeWord(n.navigationPropertyName) === normalizeWord(hoveredWord)
  );

  if (!navMatch) {
    return undefined;
  }

  const cacheKey = `${entitySetName}:${navMatch.navigationPropertyName}`;
  const cached = getCachedNavigationHoverEnrichment(cacheKey);

  if (cached) {
    return buildNavigationPropertyHover({
      nav: navMatch,
      sourceEntitySetName: entitySetName,
      targetEntitySetName: cached.targetEntitySetName,
      exampleExpand: cached.exampleExpand,
      suggestedFields: cached.suggestedFields
    });
  }

  const targetLogicalName =
    navMatch.referencedEntity?.trim() || navMatch.referencingEntity?.trim() || undefined;

  let targetEntitySetName: string | undefined;
  let exampleExpand: string | undefined;
  let suggestedFields: string[] | undefined;

  if (targetLogicalName && !isHoverCancelled(token)) {
    const targetDef = defs.find(
      (d) => normalizeWord(d.logicalName) === normalizeWord(targetLogicalName)
    );

    targetEntitySetName = targetDef?.entitySetName;

    try {
      const targetFieldContext = await requestContext.getFieldContext(targetLogicalName);
      const fieldLogicalNames = targetFieldContext.selectable
        .map((f) => f.logicalName)
        .filter(Boolean)
        .slice(0, 30);

      suggestedFields = pickSuggestedFields(fieldLogicalNames);

      const exampleField = pickPreferredExampleField(fieldLogicalNames);
      exampleExpand = exampleField
        ? `${entitySetName}?$expand=${navMatch.navigationPropertyName}($select=${exampleField})`
        : `${entitySetName}?$expand=${navMatch.navigationPropertyName}`;
    } catch {
      exampleExpand = `${entitySetName}?$expand=${navMatch.navigationPropertyName}`;
    }
  }

  setCachedNavigationHoverEnrichment(cacheKey, {
    targetEntitySetName,
    exampleExpand,
    suggestedFields
  });

  return buildNavigationPropertyHover({
    nav: navMatch,
    sourceEntitySetName: entitySetName,
    targetEntitySetName,
    exampleExpand,
    suggestedFields
  });
}
