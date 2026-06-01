import assert from "assert";
import { renderToolbar } from "../../webview/comparisonSurface/comparisonSurfaceActions.js";

suite("comparison surface toolbar", () => {
  test("groups report exports under a reports menu", () => {
    const html = renderToolbar();

    assert.match(html, /Reports ▾/);
    assert.match(html, /dvqr-report-menu-panel/);
    assert.match(html, /Diff Findings Summary <span>HTML/);
    assert.match(html, /Diff Findings Summary <span>PDF/);
    assert.match(html, /Investigation Handoff <span>HTML/);
    assert.match(html, /Investigation Handoff <span>PDF/);
    assert.doesNotMatch(html, /data-export-kind="summary-html">Diff Findings Summary/);
    assert.doesNotMatch(html, /data-export-kind="handoff-pdf">Handoff PDF/);
  });
});
