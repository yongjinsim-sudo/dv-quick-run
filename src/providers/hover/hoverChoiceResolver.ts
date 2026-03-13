import * as vscode from "vscode";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { isChoiceAttributeType } from "../../metadata/metadataModel.js";
import { findChoiceMetadataForField, findMatchingScalarComparison, buildChoiceValueHover } from "./hoverFilterAnalysis.js";
import { isHoverCancelled, isScalarValueToken, normalizeScalarToken, normalizeWord } from "./hoverCommon.js";
import type { HoverRequestContext } from "./hoverRequestContext.js";

export async function resolveChoiceValueHover(args: {
  parsed: ReturnType<typeof parseEditorQuery>;
  entitySetName: string;
  hoveredWord: string;
  requestContext: HoverRequestContext;
  token: vscode.CancellationToken;
}): Promise<vscode.Hover | undefined> {
  const { parsed, entitySetName, hoveredWord, requestContext, token } = args;

  if (!isScalarValueToken(hoveredWord)) {
    return undefined;
  }

  const matchingComparison = findMatchingScalarComparison(parsed, hoveredWord);
  if (!matchingComparison) {
    return undefined;
  }

  const entity = await requestContext.getEntityByEntitySetName(entitySetName);
  if (!entity || isHoverCancelled(token)) {
    return undefined;
  }

  const fieldContext = await requestContext.getFieldContext(entity.logicalName);
  const field = fieldContext.fieldByLogicalName.get(normalizeWord(matchingComparison.fieldLogicalName));

  if (!field || !isChoiceAttributeType(field.attributeType) || isHoverCancelled(token)) {
    return undefined;
  }

  const allChoiceMetadata = await requestContext.getChoiceMetadata(entity.logicalName);
  const choiceMetadata = findChoiceMetadataForField(allChoiceMetadata, field.logicalName);
  if (!choiceMetadata) {
    return undefined;
  }

  const option = choiceMetadata.options.find(
    (o) => normalizeScalarToken(String(o.value)) === normalizeScalarToken(matchingComparison.rawValue)
  );

  if (!option) {
    return undefined;
  }

  return buildChoiceValueHover({
    rawValue: matchingComparison.rawValue,
    fieldLogicalName: field.logicalName,
    attributeType: field.attributeType,
    label: option.label
  });
}
