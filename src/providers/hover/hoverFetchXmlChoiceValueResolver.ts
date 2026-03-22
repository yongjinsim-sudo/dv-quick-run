import * as vscode from "vscode";
import { isChoiceAttributeType } from "../../metadata/metadataModel.js";
import { findChoiceMetadataForField } from "./hoverFilterAnalysis.js";
import { normalizeWord } from "./hoverCommon.js";
import type { HoverRequestContext } from "./hoverRequestContext.js";
import type { FetchXmlEntityScope } from "./hoverFetchXmlScope.js";

function extractAttributeValue(text: string, attributeName: string): string | undefined {
    const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
    const match = text.match(pattern);

    return match?.[1];
}

function getValueAttributeAtPosition(
    lineText: string,
    character: number
): string | undefined {
    const regex = /value\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineText)) !== null) {
        const fullMatch = match[0];
        const value = match[1];
        const fullMatchStart = match.index;
        const valueStartInFullMatch = fullMatch.indexOf(value);
        const start = fullMatchStart + valueStartInFullMatch;
        const end = start + value.length;

        if (character >= start && character <= end) {
            return value.trim();
        }
    }

    return undefined;
}

function getElementValueAtPosition(
    lineText: string,
    character: number
): string | undefined {
    const regex = /<value>([^<]+)<\/value>/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineText)) !== null) {
        const fullMatch = match[0];
        const value = match[1];
        const fullMatchStart = match.index;
        const valueStartInFullMatch = fullMatch.indexOf(value);
        const start = fullMatchStart + valueStartInFullMatch;
        const end = start + value.length;

        if (character >= start && character <= end) {
            return value.trim();
        }
    }

    return undefined;
}

function findEnclosingConditionAttribute(
    document: vscode.TextDocument,
    position: vscode.Position
): string | undefined {
    for (let line = position.line; line >= 0; line--) {
        const lineText = document.lineAt(line).text;

        if (lineText.includes("</condition>")) {
            break;
        }

        if (lineText.includes("<condition")) {
            return extractAttributeValue(lineText, "attribute");
        }
    }

    return undefined;
}

function buildChoiceValueHover(args: {
    rawValue: string;
    label: string;
    fieldLogicalName: string;
    entityLogicalName: string;
}): vscode.Hover {
    const { rawValue, label, fieldLogicalName, entityLogicalName } = args;

    const md = new vscode.MarkdownString();
    md.isTrusted = false;
    md.supportHtml = false;

    md.appendMarkdown(`**Choice value**\n\n`);
    md.appendMarkdown(`\`${rawValue}\` = ${label}\n\n`);
    md.appendMarkdown(`Field: \`${fieldLogicalName}\`\n\n`);
    md.appendMarkdown(`Entity: \`${entityLogicalName}\``);

    return new vscode.Hover(md);
}

async function resolveChoiceValueHover(args: {
    entityLogicalName: string;
    fieldLogicalName: string;
    rawValue: string;
    requestContext: HoverRequestContext;
}): Promise<vscode.Hover | undefined> {
    const { entityLogicalName, fieldLogicalName, rawValue, requestContext } = args;

    if (typeof requestContext.getChoiceMetadata !== "function") {
        return undefined;
    }

    const fieldContext = await requestContext.getFieldContext(entityLogicalName);
    const field = fieldContext.fieldByLogicalName.get(normalizeWord(fieldLogicalName));

    if (!field || !isChoiceAttributeType(field.attributeType)) {
        return undefined;
    }

    const allChoiceMetadata = await requestContext.getChoiceMetadata(entityLogicalName);
    const choiceMetadata = findChoiceMetadataForField(allChoiceMetadata, field.logicalName);

    if (!choiceMetadata) {
        return undefined;
    }

    const matchedOption = choiceMetadata.options.find(
        (option) => String(option.value) === rawValue
    );

    if (!matchedOption?.label) {
        return undefined;
    }

    return buildChoiceValueHover({
        rawValue,
        label: matchedOption.label,
        fieldLogicalName,
        entityLogicalName
    });
}

export async function resolveFetchXmlChoiceValueHover(args: {
    document: vscode.TextDocument;
    position: vscode.Position;
    lineText: string;
    activeScope: FetchXmlEntityScope | undefined;
    requestContext: HoverRequestContext;
}): Promise<vscode.Hover | undefined> {
    const { document, position, lineText, activeScope, requestContext } = args;

    if (!activeScope) {
        return undefined;
    }

    const inlineValue = getValueAttributeAtPosition(lineText, position.character);
    if (inlineValue) {
        const fieldLogicalName = extractAttributeValue(lineText, "attribute");
        if (!fieldLogicalName) {
            return undefined;
        }

        return resolveChoiceValueHover({
            entityLogicalName: activeScope.entityLogicalName,
            fieldLogicalName,
            rawValue: inlineValue,
            requestContext
        });
    }

    const elementValue = getElementValueAtPosition(lineText, position.character);
    if (!elementValue) {
        return undefined;
    }

    const fieldLogicalName = findEnclosingConditionAttribute(document, position);
    if (!fieldLogicalName) {
        return undefined;
    }

    return resolveChoiceValueHover({
        entityLogicalName: activeScope.entityLogicalName,
        fieldLogicalName,
        rawValue: elementValue,
        requestContext
    });
}