import * as vscode from "vscode";
import {
    findFetchXmlOperator,
    getFetchXmlOperatorLabel
} from "../../shared/fetchXml/fetchXmlOperatorCatalog.js";

function formatValueContract(valueContract: string): string {
    switch (valueContract) {
        case "none":
            return "none";
        case "single":
            return "single";
        case "multi":
            return "multiple";
        case "range":
            return "range";
        default:
            return valueContract;
    }
}

function formatSupportedContexts(supportedContexts?: string[]): string | undefined {
    if (!supportedContexts?.length) {
        return undefined;
    }

    return supportedContexts.map((context) => `\`${context}\``).join(", ");
}

export function buildFetchXmlOperatorHover(operatorKey: string): vscode.Hover | undefined {
    const operator = findFetchXmlOperator(operatorKey.trim().toLowerCase());
    if (!operator) {
        return undefined;
    }

    const md = new vscode.MarkdownString();
    const polishedLabel = getFetchXmlOperatorLabel(operator, "polished");
    const groupedLabel = getFetchXmlOperatorLabel(operator, "grouped");
    const valueContract = formatValueContract(operator.valueContract);
    const supportedContexts = formatSupportedContexts(operator.supportedContexts);

    md.isTrusted = false;
    md.supportHtml = false;

    md.appendMarkdown(`**${polishedLabel}**\n\n`);
    md.appendMarkdown(`\`${operator.key}\``);

    if (groupedLabel && groupedLabel !== polishedLabel) {
        md.appendMarkdown(` · ${groupedLabel}`);
    }

    md.appendMarkdown(`\n\n${operator.description}\n\n`);

    if (operator.diagnostics.summary.trim().length > 0) {
        md.appendMarkdown(`${operator.diagnostics.summary}\n\n`);
    }

    md.appendMarkdown(`**Value**  \n\`${valueContract}\`\n\n`);

    if (supportedContexts) {
        md.appendMarkdown(`**Applies to**  \n${supportedContexts}\n\n`);
    }

    if ((operator.diagnostics.examples?.length ?? 0) > 0) {
        md.appendMarkdown("**Examples**\n");

        operator.diagnostics.examples!.forEach((example) => {
            md.appendMarkdown(`- \`${example}\`\n`);
        });

        md.appendMarkdown("\n");
    }

    if ((operator.diagnostics.commonMistakes?.length ?? 0) > 0) {
        md.appendMarkdown("**Common mistakes**\n");

        operator.diagnostics.commonMistakes!.forEach((mistake) => {
            md.appendMarkdown(`- ${mistake}\n`);
        });
    }

    return new vscode.Hover(md);
}

function getOperatorValueAtPosition(
    lineText: string,
    character: number
): string | undefined {
    const regex = /operator\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lineText)) !== null) {
        const fullMatch = match[0];
        const operatorValue = match[1];

        const fullMatchStart = match.index;
        const valueStartInFullMatch = fullMatch.indexOf(operatorValue);
        const valueStart = fullMatchStart + valueStartInFullMatch;
        const valueEnd = valueStart + operatorValue.length;

        if (character >= valueStart && character <= valueEnd) {
            return operatorValue;
        }
    }

    return undefined;
}

export function resolveFetchXmlOperatorHover(args: {
    lineText: string;
    character: number;
}): vscode.Hover | undefined {
    const { lineText, character } = args;

    if (!lineText.includes("<condition") || !lineText.includes("operator=")) {
        return undefined;
    }

    const operatorValue = getOperatorValueAtPosition(lineText, character);
    if (!operatorValue) {
        return undefined;
    }

    return buildFetchXmlOperatorHover(operatorValue);
}