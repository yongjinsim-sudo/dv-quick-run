import * as vscode from "vscode";

export interface FetchXmlEntityScope {
    entityLogicalName: string;
    alias?: string;
    kind: "entity" | "link-entity";
}

function extractAttributeValue(tagText: string, attributeName: string): string | undefined {
    const pattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, "i");
    const match = tagText.match(pattern);

    return match?.[1];
}

function parseScopeFromTag(tagText: string): FetchXmlEntityScope | undefined {
    if (tagText.startsWith("<entity")) {
        const entityLogicalName = extractAttributeValue(tagText, "name");
        if (!entityLogicalName) {
            return undefined;
        }

        return {
            entityLogicalName,
            kind: "entity"
        };
    }

    if (tagText.startsWith("<link-entity")) {
        const entityLogicalName = extractAttributeValue(tagText, "name");
        if (!entityLogicalName) {
            return undefined;
        }

        return {
            entityLogicalName,
            alias: extractAttributeValue(tagText, "alias"),
            kind: "link-entity"
        };
    }

    return undefined;
}

function buildScopeStack(text: string): FetchXmlEntityScope[] {
    const tagRegex = /<\/?entity\b[^>]*>|<\/?link-entity\b[^>]*>/gi;
    const scopeStack: FetchXmlEntityScope[] = [];

    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(text)) !== null) {
        const tagText = match[0];

        if (tagText.startsWith("</link-entity")) {
            for (let i = scopeStack.length - 1; i >= 0; i--) {
                if (scopeStack[i].kind === "link-entity") {
                    scopeStack.splice(i, 1);
                    break;
                }
            }

            continue;
        }

        if (tagText.startsWith("</entity")) {
            for (let i = scopeStack.length - 1; i >= 0; i--) {
                if (scopeStack[i].kind === "entity") {
                    scopeStack.splice(i, 1);
                    break;
                }
            }

            continue;
        }

        const scope = parseScopeFromTag(tagText);
        if (scope) {
            scopeStack.push(scope);
        }
    }

    return scopeStack;
}

export function getFetchXmlEntityScopeStack(
    document: vscode.TextDocument,
    position: vscode.Position
): FetchXmlEntityScope[] {
    const textUpToCursor = document.getText(
        new vscode.Range(new vscode.Position(0, 0), position)
    );

    return buildScopeStack(textUpToCursor);
}

export function getFetchXmlEntityScopeStackBeforeLine(
    document: vscode.TextDocument,
    line: number
): FetchXmlEntityScope[] {
    const textBeforeLine = document.getText(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(line, 0))
    );

    return buildScopeStack(textBeforeLine);
}

export function getActiveFetchXmlEntityScope(
    document: vscode.TextDocument,
    position: vscode.Position
): FetchXmlEntityScope | undefined {
    const scopeStack = getFetchXmlEntityScopeStack(document, position);
    return scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : undefined;
}