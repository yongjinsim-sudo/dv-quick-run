import * as vscode from "vscode";
import { buildEntityHover, buildFieldHover } from "./hoverBuilders.js";
import { getHoverWordRange, normalizeWord } from "./hoverCommon.js";
import type { HoverRequestContext } from "./hoverRequestContext.js";

function extractRootEntityLogicalName(text: string): string | undefined {
  const match = text.match(/<entity\s+[^>]*name\s*=\s*["']([^"']+)["']/i);
  return match?.[1];
}

function getCurrentLineText(document: vscode.TextDocument, position: vscode.Position): string {
  return document.lineAt(position.line).text;
}

function getHoveredXmlNameValue(
  document: vscode.TextDocument,
  position: vscode.Position
): string | undefined {
  const wordRange = getHoverWordRange(document, position);
  if (!wordRange) {
    return undefined;
  }

  const hoveredWord = document.getText(wordRange).trim();
  return hoveredWord || undefined;
}

export async function resolveFetchXmlHover(args: {
  document: vscode.TextDocument;
  position: vscode.Position;
  requestContext: HoverRequestContext;
}): Promise<vscode.Hover | undefined> {
  const { document, position, requestContext } = args;

  const fullText = document.getText();
  const lineText = getCurrentLineText(document, position);
  const hoveredWord = getHoveredXmlNameValue(document, position);

  if (!hoveredWord) {
    return undefined;
  }

  // Entity hover: <entity name="contact">
  if (lineText.includes("<entity") && lineText.includes("name=")) {
    const entityMatch = lineText.match(/name\s*=\s*["']([^"']+)["']/i);
    if (!entityMatch) {
      return undefined;
    }

    const entityLogicalName = entityMatch[1];
    if (normalizeWord(hoveredWord) !== normalizeWord(entityLogicalName)) {
      return undefined;
    }

    const entity = await requestContext.getEntityByLogicalName(entityLogicalName);
    return buildEntityHover(entityLogicalName, entity);
  }

  // Attribute hover: <attribute name="fullname" />
  if (lineText.includes("<attribute") && lineText.includes("name=")) {
    const attributeMatch = lineText.match(/name\s*=\s*["']([^"']+)["']/i);
    if (!attributeMatch) {
      return undefined;
    }

    const attributeLogicalName = attributeMatch[1];
    if (normalizeWord(hoveredWord) !== normalizeWord(attributeLogicalName)) {
      return undefined;
    }

    const entityLogicalName = extractRootEntityLogicalName(fullText);
    if (!entityLogicalName) {
      return undefined;
    }

    const fieldContext = await requestContext.getFieldContext(entityLogicalName);
    const field = fieldContext.fieldByLogicalName.get(normalizeWord(attributeLogicalName));

    if (!field) {
      return undefined;
    }

    const selectable = fieldContext.selectableByLogicalName.get(normalizeWord(attributeLogicalName));

    return buildFieldHover(
      field,
      selectable?.selectToken,
      attributeLogicalName
    );
  }

  return undefined;
}