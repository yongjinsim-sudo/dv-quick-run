import * as vscode from "vscode";
import { isChoiceAttributeType } from "../../metadata/metadataModel.js";
import { buildEntityHover, buildFieldHover } from "./hoverBuilders.js";
import { resolveFetchXmlChoiceValueHover } from "./hoverFetchXmlChoiceValueResolver.js";
import { findChoiceMetadataForField } from "./hoverFilterAnalysis.js";
import { getHoverWordRange, normalizeWord } from "./hoverCommon.js";
import {
    getActiveFetchXmlEntityScope,
    getFetchXmlEntityScopeStack,
    getFetchXmlEntityScopeStackBeforeLine
} from "./hoverFetchXmlScope.js";
import { resolveFetchXmlOperatorHover } from "./hoverFetchXmlOperatorResolver.js";
import { resolveFetchXmlRelationshipHover } from "./hoverFetchXmlRelationshipResolver.js";
import type { HoverRequestContext } from "./hoverRequestContext.js";

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

function extractAttributeValue(lineText: string, attributeName: string): string | undefined {
    const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
    const match = lineText.match(pattern);

    return match?.[1];
}

function extractConditionSelectedRawValue(lineText: string): string | undefined {
    if (!lineText.includes("<condition")) {
        return undefined;
    }

    return extractAttributeValue(lineText, "value");
}

async function buildFieldHoverForScope(args: {
    entityLogicalName: string;
    fieldLogicalName: string;
    requestContext: HoverRequestContext;
    selectedRawValue?: string;
}): Promise<vscode.Hover | undefined> {
    const { entityLogicalName, fieldLogicalName, requestContext, selectedRawValue } = args;

    const fieldContext = await requestContext.getFieldContext(entityLogicalName);
    const normalizedFieldLogicalName = normalizeWord(fieldLogicalName);
    const field = fieldContext.fieldByLogicalName.get(normalizedFieldLogicalName);

    if (!field) {
        return undefined;
    }

    const selectable = fieldContext.selectableByLogicalName.get(normalizedFieldLogicalName);

    let choiceMetadata;
    if (isChoiceAttributeType(field.attributeType) && typeof requestContext.getChoiceMetadata === "function") {
        const allChoiceMetadata = await requestContext.getChoiceMetadata(entityLogicalName);
        choiceMetadata = findChoiceMetadataForField(allChoiceMetadata, field.logicalName);
    }

    return buildFieldHover(
        field,
        selectable?.selectToken,
        fieldLogicalName,
        choiceMetadata,
        selectedRawValue
    );
}

export async function resolveFetchXmlHover(args: {
    document: vscode.TextDocument;
    position: vscode.Position;
    requestContext: HoverRequestContext;
}): Promise<vscode.Hover | undefined> {
    const { document, position, requestContext } = args;

    const lineText = getCurrentLineText(document, position);
    const hoveredWord = getHoveredXmlNameValue(document, position);

    if (!hoveredWord) {
        return undefined;
    }

    const operatorHover = resolveFetchXmlOperatorHover({
        lineText,
        character: position.character
    });

    if (operatorHover) {
        return operatorHover;
    }

    const scopeStack = getFetchXmlEntityScopeStack(document, position);
    const activeScope = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : undefined;

    const linkedEntityLogicalName = lineText.includes("<link-entity")
        ? extractAttributeValue(lineText, "name")
        : undefined;

    const parentScopeStack = getFetchXmlEntityScopeStackBeforeLine(document, position.line);
    const parentScope = parentScopeStack.length > 0
        ? parentScopeStack[parentScopeStack.length - 1]
        : undefined;

    const relationshipHover = await resolveFetchXmlRelationshipHover({
        lineText,
        hoveredWord,
        linkedEntityLogicalName,
        parentScope,
        requestContext
    });

    if (relationshipHover) {
        return relationshipHover;
    }

    const choiceValueHover = await resolveFetchXmlChoiceValueHover({
        document,
        position,
        lineText,
        activeScope,
        requestContext
    });

    if (choiceValueHover) {
        return choiceValueHover;
    }

    if (lineText.includes("<entity") && lineText.includes("name=")) {
        const entityLogicalName = extractAttributeValue(lineText, "name");
        if (!entityLogicalName) {
            return undefined;
        }

        if (normalizeWord(hoveredWord) !== normalizeWord(entityLogicalName)) {
            return undefined;
        }

        const entity = await requestContext.getEntityByLogicalName(entityLogicalName);
        return buildEntityHover(entityLogicalName, entity);
    }

    if (lineText.includes("<link-entity") && lineText.includes("name=")) {
        const entityLogicalName = extractAttributeValue(lineText, "name");
        if (!entityLogicalName) {
            return undefined;
        }

        if (normalizeWord(hoveredWord) !== normalizeWord(entityLogicalName)) {
            return undefined;
        }

        const entity = await requestContext.getEntityByLogicalName(entityLogicalName);
        return buildEntityHover(entityLogicalName, entity);
    }

    const resolvedActiveScope = activeScope ?? getActiveFetchXmlEntityScope(document, position);
    if (!resolvedActiveScope) {
        return undefined;
    }

    if (lineText.includes("<condition") && lineText.includes("attribute=")) {
        const attributeLogicalName = extractAttributeValue(lineText, "attribute");
        if (!attributeLogicalName) {
            return undefined;
        }

        if (normalizeWord(hoveredWord) !== normalizeWord(attributeLogicalName)) {
            return undefined;
        }

        return buildFieldHoverForScope({
            entityLogicalName: resolvedActiveScope.entityLogicalName,
            fieldLogicalName: attributeLogicalName,
            requestContext,
            selectedRawValue: extractConditionSelectedRawValue(lineText)
        });
    }

    if (lineText.includes("<attribute") && lineText.includes("name=")) {
        const attributeLogicalName = extractAttributeValue(lineText, "name");
        if (!attributeLogicalName) {
            return undefined;
        }

        if (normalizeWord(hoveredWord) !== normalizeWord(attributeLogicalName)) {
            return undefined;
        }

        return buildFieldHoverForScope({
            entityLogicalName: resolvedActiveScope.entityLogicalName,
            fieldLogicalName: attributeLogicalName,
            requestContext
        });
    }

    return undefined;
}