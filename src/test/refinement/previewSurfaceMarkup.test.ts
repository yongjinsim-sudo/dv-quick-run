import * as assert from "assert";
import { getPreviewSurfaceMarkup } from "../../webview/previewSurface/markup.js";
import { getPreviewSurfaceStyles } from "../../webview/previewSurface/styles.js";

suite("previewSurface markup", () => {
  test("keeps copy and cancel actions outside the scrollable preview content", () => {
    const markup = getPreviewSurfaceMarkup({
      previewId: "preview-copy-test",
      kind: "query",
      title: "Metadata-aware query rewrite",
      source: "editor",
      sourceAction: "Show Metadata-Aware Query Suggestions",
      createdAt: "2026-07-20T00:00:00.000Z",
      sections: Array.from({ length: 8 }, (_, index) => ({
        title: `Section ${index + 1}`,
        content: `Content ${index + 1}`
      })),
      secondaryActions: [
        { id: "copy", label: "Copy Suggested Query", kind: "copy", enabled: true },
        { id: "cancel", label: "Cancel", kind: "cancel", enabled: true }
      ]
    });

    const footerStart = markup.indexOf('class="preview-actions"');

    assert.ok(markup.includes('class="preview-content"'));
    assert.match(markup, /<div class="preview-content">[\s\S]*<\/div>\s*<footer class="preview-actions">/);
    assert.ok(markup.includes('data-action-kind="copy"'));
    assert.ok(markup.indexOf('data-action-kind="copy"') > footerStart);
    assert.ok(markup.includes("Copy Suggested Query"));
    assert.ok(markup.includes('data-action-kind="cancel"'));

    const styles = getPreviewSurfaceStyles();
    assert.match(styles, /\.preview-shell\s*\{[\s\S]*height:\s*100vh/);
    assert.match(styles, /\.preview-content\s*\{[\s\S]*overflow-y:\s*auto/);
    assert.match(styles, /\.preview-actions\s*\{[\s\S]*flex:\s*0 0 auto/);
  });
});
