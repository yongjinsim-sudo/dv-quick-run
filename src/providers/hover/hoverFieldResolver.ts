import * as vscode from "vscode";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { isChoiceAttributeType } from "../../metadata/metadataModel.js";
import { findChoiceMetadataForField, getSelectedRawValueForField } from "./hoverFilterAnalysis.js";
import { buildFieldHover } from "./hoverBuilders.js";
import { buildChoiceRefinementOptions } from "../../refinement/filterValueReplacement.js";
import { isHoverCancelled, normalizeWord } from "./hoverCommon.js";
import type { HoverRequestContext } from "./hoverRequestContext.js";

export async function resolveFieldHover(args: {
  parsed: ReturnType<typeof parseEditorQuery>;
  entitySetName: string;
  hoveredWord: string;
  requestContext: HoverRequestContext;
  token: vscode.CancellationToken;
  documentUri?: vscode.Uri;
  lineNumber?: number;
}): Promise<vscode.Hover | undefined> {
  const { parsed, entitySetName, hoveredWord, requestContext, token } = args;

  const entity = await requestContext.getEntityByEntitySetName(entitySetName);
  if (!entity || isHoverCancelled(token)) {
    return undefined;
  }

  const fieldContext = await requestContext.getFieldContext(entity.logicalName);
  const normalizedHoveredWord = normalizeWord(hoveredWord);

  const fieldMatch = fieldContext.fieldByLogicalName.get(normalizedHoveredWord);
  if (fieldMatch) {
    const selectableMatch = fieldContext.selectableByLogicalName.get(normalizedHoveredWord);
    const choiceMetadata = await getChoiceMetadataForField({
      entityLogicalName: entity.logicalName,
      fieldLogicalName: fieldMatch.logicalName,
      attributeType: fieldMatch.attributeType,
      requestContext,
      token
    });
    const selectedRawValue = getSelectedRawValueForField(parsed, fieldMatch.logicalName);
    const refinementOptions =
      choiceMetadata &&
      selectedRawValue !== undefined &&
      args.documentUri !== undefined &&
      args.lineNumber !== undefined
        ? buildChoiceRefinementOptions({
            parsed,
            hoveredWord: selectedRawValue,
            fieldLogicalName: fieldMatch.logicalName,
            options: choiceMetadata.options,
            documentUri: args.documentUri,
            lineNumber: args.lineNumber
          })
        : undefined;

    return buildFieldHover(
      fieldMatch,
      selectableMatch?.selectToken,
      hoveredWord,
      choiceMetadata,
      selectedRawValue,
      refinementOptions
    );
  }

  const selectTokenMatch = fieldContext.selectableByToken.get(normalizedHoveredWord);
  if (!selectTokenMatch) {
    return undefined;
  }

  const backingField = fieldContext.fieldByLogicalName.get(normalizeWord(selectTokenMatch.logicalName));
  if (!backingField) {
    return undefined;
  }

  const choiceMetadata = await getChoiceMetadataForField({
    entityLogicalName: entity.logicalName,
    fieldLogicalName: backingField.logicalName,
    attributeType: backingField.attributeType,
    requestContext,
    token
  });
  const selectedRawValue = getSelectedRawValueForField(parsed, backingField.logicalName);
  const refinementOptions =
    choiceMetadata &&
    selectedRawValue !== undefined &&
    args.documentUri !== undefined &&
    args.lineNumber !== undefined
      ? buildChoiceRefinementOptions({
          parsed,
          hoveredWord: selectedRawValue,
          fieldLogicalName: backingField.logicalName,
          options: choiceMetadata.options,
          documentUri: args.documentUri,
          lineNumber: args.lineNumber
        })
      : undefined;

  return buildFieldHover(
    backingField,
    selectTokenMatch.selectToken,
    hoveredWord,
    choiceMetadata,
    selectedRawValue,
    refinementOptions
  );
}

async function getChoiceMetadataForField(args: {
  entityLogicalName: string;
  fieldLogicalName: string;
  attributeType: string | undefined;
  requestContext: HoverRequestContext;
  token: vscode.CancellationToken;
}) {
  const { entityLogicalName, fieldLogicalName, attributeType, requestContext, token } = args;

  if (!isChoiceAttributeType(attributeType) || isHoverCancelled(token)) {
    return undefined;
  }

  const allChoiceMetadata = await requestContext.getChoiceMetadata(entityLogicalName);
  return findChoiceMetadataForField(allChoiceMetadata, fieldLogicalName);
}
