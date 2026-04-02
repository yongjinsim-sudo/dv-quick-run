import * as assert from "assert";
import { buildODataFilter, buildODataFilterPreviewFromTarget } from "../../providers/resultViewerActions/previewODataFilter.js";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

function buildTarget(text: string): EditorQueryTarget {
    return {
        text,
        source: "line",
        range: {} as never,
        editor: {} as never
    };
}

suite("previewODataFilter", () => {
    test("builds OData filter with quoted string", () => {
        assert.strictEqual(buildODataFilter("fullname", "John O'Reilly"), "fullname eq 'John O''Reilly'");
    });

    test("builds preview with appended filter", () => {
        const preview = buildODataFilterPreviewFromTarget(
            buildTarget("contacts?$select=fullname&$top=5"),
            "contactid",
            "7d29eec7-4414-f111-8341-6045bdc42f8b"
        );

        assert.strictEqual(preview.originalQuery, "contacts?$select=fullname&$top=5");
        assert.strictEqual(preview.previewQuery, "contacts?$select=fullname&$top=5&$filter=contactid eq '7d29eec7-4414-f111-8341-6045bdc42f8b'");
    });

    test("builds preview with merged filter", () => {
        const preview = buildODataFilterPreviewFromTarget(
            buildTarget("contacts?$select=fullname&$filter=statecode eq 0"),
            "fullname",
            "John"
        );

        assert.strictEqual(preview.previewQuery, "contacts?$select=fullname&$filter=(statecode eq 0) and (fullname eq 'John')");
    });

    test("extracts only the OData query line from noisy editor text", () => {
        const preview = buildODataFilterPreviewFromTarget(
            buildTarget("Run Query|Explain\ncontacts?$top=5"),
            "contactid",
            "7d29eec7-4414-f111-8341-6045bdc42f8b"
        );

        assert.strictEqual(preview.originalQuery, "contacts?$top=5");
        assert.strictEqual(preview.previewQuery, "contacts?$top=5&$filter=contactid eq '7d29eec7-4414-f111-8341-6045bdc42f8b'");
    });
});
