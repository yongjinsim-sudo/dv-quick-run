import * as assert from "assert";
import * as vscode from "vscode";
import {
    buildFetchXmlOperatorHover,
    resolveFetchXmlOperatorHover
} from "../../providers/hover/hoverFetchXmlOperatorResolver.js";

function getHoverMarkdown(hover: vscode.Hover): string {
    const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
    return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

suite("hoverFetchXmlOperatorResolver", () => {
    test("builds hover for known operator", () => {
        const hover = buildFetchXmlOperatorHover("like");

        assert.ok(hover);
        const markdown = getHoverMarkdown(hover!);
        assert.ok(markdown.includes("**Like**"));
        assert.ok(markdown.includes("`like`"));
        assert.ok(markdown.includes("**Value**"));
        assert.ok(markdown.includes("`single`"));
    });

    test("returns undefined for unknown operator", () => {
        const hover = buildFetchXmlOperatorHover("definitely-not-real");

        assert.strictEqual(hover, undefined);
    });

    test("resolves operator hover from condition line", () => {
        const lineText = `<condition attribute="fullname" operator="like" value="%john%" />`;
        const character = lineText.indexOf(`like`);

        const hover = resolveFetchXmlOperatorHover({
            lineText,
            character
        });

        assert.ok(hover);
        const markdown = getHoverMarkdown(hover!);
        assert.ok(markdown.includes("Matches text using wildcard patterns."));
    });

    test("does not resolve when hovering non-operator token", () => {
        const lineText = `<condition attribute="fullname" operator="like" value="%john%" />`;
        const character = lineText.indexOf(`fullname`);

        const hover = resolveFetchXmlOperatorHover({
            lineText,
            character
        });

        assert.strictEqual(hover, undefined);
    });
});