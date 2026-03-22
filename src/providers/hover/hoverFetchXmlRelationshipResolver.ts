import * as vscode from "vscode";
import { buildFieldHover } from "./hoverBuilders.js";
import { normalizeWord } from "./hoverCommon.js";
import type { HoverRequestContext } from "./hoverRequestContext.js";
import type { FetchXmlEntityScope } from "./hoverFetchXmlScope.js";

function extractAttributeValue(lineText: string, attributeName: string): string | undefined {
    const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
    const match = lineText.match(pattern);

    return match?.[1];
}

async function buildRelationshipFieldHover(args: {
    entityLogicalName: string;
    fieldLogicalName: string;
    requestContext: HoverRequestContext;
    heading: string;
    relationSummary: string;
}): Promise<vscode.Hover | undefined> {
    const { entityLogicalName, fieldLogicalName, requestContext, heading, relationSummary } = args;

    const fieldContext = await requestContext.getFieldContext(entityLogicalName);
    const normalizedFieldLogicalName = normalizeWord(fieldLogicalName);
    const field = fieldContext.fieldByLogicalName.get(normalizedFieldLogicalName);

    if (!field) {
        return undefined;
    }

    const selectable = fieldContext.selectableByLogicalName.get(normalizedFieldLogicalName);
    const baseHover = buildFieldHover(field, selectable?.selectToken, fieldLogicalName);

    const first = Array.isArray(baseHover.contents) ? baseHover.contents[0] : baseHover.contents;
    const existingMarkdown =
        typeof first === "string"
            ? first
            : "value" in first
                ? first.value
                : String(first);

    const md = new vscode.MarkdownString();
    md.isTrusted = false;
    md.supportHtml = false;

    md.appendMarkdown(`**${heading}**\n\n`);
    md.appendMarkdown(`${relationSummary}\n\n`);
    md.appendMarkdown(existingMarkdown);

    return new vscode.Hover(md);
}

export async function resolveFetchXmlRelationshipHover(args: {
    lineText: string;
    hoveredWord: string;
    linkedEntityLogicalName: string | undefined;
    parentScope: FetchXmlEntityScope | undefined;
    requestContext: HoverRequestContext;
}): Promise<vscode.Hover | undefined> {
    const { lineText, hoveredWord, linkedEntityLogicalName, parentScope, requestContext } = args;

    if (!lineText.includes("<link-entity")) {
        return undefined;
    }

    if (!linkedEntityLogicalName) {
        return undefined;
    }

    const fromValue = extractAttributeValue(lineText, "from");
    const toValue = extractAttributeValue(lineText, "to");
    const aliasValue = extractAttributeValue(lineText, "alias");

    if (fromValue && normalizeWord(hoveredWord) === normalizeWord(fromValue)) {
        return buildRelationshipFieldHover({
            entityLogicalName: linkedEntityLogicalName,
            fieldLogicalName: fromValue,
            requestContext,
            heading: "Join field (linked entity)",
            relationSummary: `Joins from \`${linkedEntityLogicalName}.${fromValue}\`${aliasValue ? ` via alias \`${aliasValue}\`` : ""}.`
        });
    }

    if (toValue && parentScope && normalizeWord(hoveredWord) === normalizeWord(toValue)) {
        return buildRelationshipFieldHover({
            entityLogicalName: parentScope.entityLogicalName,
            fieldLogicalName: toValue,
            requestContext,
            heading: "Join field (parent scope)",
            relationSummary: `Joins to \`${parentScope.entityLogicalName}.${toValue}\`.`
        });
    }

    if (aliasValue && normalizeWord(hoveredWord) === normalizeWord(aliasValue)) {
        const md = new vscode.MarkdownString();
        md.isTrusted = false;
        md.supportHtml = false;

        md.appendMarkdown(`**Link alias**\n\n`);
        md.appendMarkdown(`\`${aliasValue}\` refers to linked entity \`${linkedEntityLogicalName}\`.`);

        return new vscode.Hover(md);
    }

    return undefined;
}