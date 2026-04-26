import * as assert from "assert";
import {
    buildFetchXmlCondition,
    buildFetchXmlConditionPreviewFromTarget
} from "../../providers/resultViewerActions/previewFetchXmlCondition.js";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

function buildTarget(text: string): EditorQueryTarget {
    return {
        text,
        source: "line",
        range: {} as never,
        editor: {} as never
    };
}

suite("previewFetchXmlCondition", () => {
    test("builds FetchXML null condition", () => {
        assert.strictEqual(
            buildFetchXmlCondition("accountrolecode", null),
            "<condition attribute=\"accountrolecode\" operator=\"null\" />"
        );
    });

    test("builds FetchXML condition with escaped attributes", () => {
        assert.strictEqual(
            buildFetchXmlCondition("fullname", `John "O'Reilly" & Co`),
            "<condition attribute=\"fullname\" operator=\"eq\" value=\"John &quot;O&apos;Reilly&quot; &amp; Co\" />"
        );
    });

    test("appends condition into existing filter", () => {
        const preview = buildFetchXmlConditionPreviewFromTarget(
            buildTarget(`<fetch>\n  <entity name="contact">\n    <attribute name="fullname" />\n    <filter type="and">\n      <condition attribute="statecode" operator="eq" value="0" />\n    </filter>\n  </entity>\n</fetch>`),
            "fullname",
            "John"
        );

        assert.ok(preview.previewQuery.includes('<condition attribute="statecode" operator="eq" value="0" />'));
        assert.ok(preview.previewQuery.includes('<condition attribute="fullname" operator="eq" value="John" />'));
    });

    test("creates a new filter when none exists", () => {
        const preview = buildFetchXmlConditionPreviewFromTarget(
            buildTarget(`<fetch>\n  <entity name="contact">\n    <attribute name="fullname" />\n  </entity>\n</fetch>`),
            "fullname",
            "John"
        );

        assert.ok(preview.previewQuery.includes('<filter type="and">'));
        assert.ok(preview.previewQuery.includes('<condition attribute="fullname" operator="eq" value="John" />'));
    });
});
