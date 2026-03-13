import * as vscode from "vscode";
import type { CommandContext } from "../commands/context/commandContext.js";
import { parseEditorQuery, getEntitySetNameFromEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { looksLikeDataverseQuery } from "../shared/editorIntelligence/queryDetection.js";
import {
  buildClauseHover,
  buildEntityHover,
  buildNavigationFallbackHover,
  buildOperatorHover
} from "./hover/hoverBuilders.js";
import { getHoverWordRange, isHoverCancelled, isInlineHoverEnabled, normalizeWord } from "./hover/hoverCommon.js";
import { clearNavigationHoverEnrichmentCache } from "./hover/hoverNavigation.js";
import { HoverRequestContext } from "./hover/hoverRequestContext.js";
import { resolveChoiceValueHover } from "./hover/hoverChoiceResolver.js";
import { resolveNavigationHover } from "./hover/hoverNavigationResolver.js";
import { resolveFieldHover } from "./hover/hoverFieldResolver.js";

export class QueryHoverProvider implements vscode.HoverProvider {
  private readonly requestContext: HoverRequestContext;

  constructor(private readonly ctx: CommandContext) {
    this.requestContext = new HoverRequestContext(ctx);
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    if (!isInlineHoverEnabled()) {
      return undefined;
    }

    const line = document.lineAt(position.line);
    const lineText = line.text.trim();

    if (!looksLikeDataverseQuery(lineText)) {
      return undefined;
    }

    const wordRange = getHoverWordRange(document, position);
    if (!wordRange) {
      return undefined;
    }

    const hoveredWord = document.getText(wordRange).trim();
    if (!hoveredWord) {
      return undefined;
    }

    const clauseHover = buildClauseHover(hoveredWord);
    if (clauseHover) {
      return clauseHover;
    }

    const operatorHover = buildOperatorHover(hoveredWord);
    if (operatorHover) {
      return operatorHover;
    }

    const parsed = parseEditorQuery(lineText);
    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);

    if (!entitySetName) {
      return undefined;
    }

    try {
      if (isHoverCancelled(token)) {
        return undefined;
      }

      const choiceValueHover = await resolveChoiceValueHover({
        parsed,
        entitySetName,
        hoveredWord,
        requestContext: this.requestContext,
        token
      });
      if (choiceValueHover) {
        return choiceValueHover;
      }

      if (normalizeWord(hoveredWord) === normalizeWord(entitySetName)) {
        const entity = await this.requestContext.getEntityByEntitySetName(entitySetName);
        return buildEntityHover(entitySetName, entity);
      }

      if (isHoverCancelled(token)) {
        return undefined;
      }

      const navigationHover = await resolveNavigationHover({
        lineText,
        entitySetName,
        hoveredWord,
        requestContext: this.requestContext,
        token
      });
      if (navigationHover) {
        return navigationHover;
      }

      if (isHoverCancelled(token)) {
        return undefined;
      }

      return resolveFieldHover({
        parsed,
        entitySetName,
        hoveredWord,
        requestContext: this.requestContext,
        token
      });
    } catch {
      if (isHoverCancelled(token)) {
        return undefined;
      }

      return buildNavigationFallbackHover(hoveredWord);
    }
  }

}

export { clearNavigationHoverEnrichmentCache } from "./hover/hoverNavigation.js";