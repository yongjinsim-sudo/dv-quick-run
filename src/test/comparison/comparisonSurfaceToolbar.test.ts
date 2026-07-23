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
    assert.match(html, /Mini RCA Report <span>HTML/);
    assert.match(html, /Mini RCA Report <span>MD/);
    assert.match(html, /Mini RCA Artifact <span>JSON/);
    assert.match(html, /Regenerate Mini RCA <span>Explicit/);
    assert.doesNotMatch(html, /data-export-kind="summary-html">Diff Findings Summary/);
    assert.doesNotMatch(html, /data-export-kind="handoff-pdf">Handoff PDF/);
  });

  test("keeps report exports unlocked when comparison exports are locked", () => {
    const html = renderToolbar({ canExport: false });

    assert.match(html, /Save JSON🔒|Save JSON 🔒/);
    assert.match(html, /Save MD🔒|Save MD 🔒/);
    assert.match(html, /Save HTML🔒|Save HTML 🔒/);
    assert.match(html, /Diff Findings Summary <span>HTML<\/span>/);
    assert.match(html, /Diff Findings Summary <span>PDF<\/span>/);
    assert.match(html, /Investigation Handoff <span>HTML<\/span>/);
    assert.match(html, /Investigation Handoff <span>PDF<\/span>/);
    assert.match(html, /Mini RCA Report <span>HTML<\/span>/);
    assert.match(html, /Mini RCA Report <span>MD<\/span>/);
    assert.match(html, /Mini RCA Artifact <span>JSON<\/span>/);
    assert.match(html, /Regenerate Mini RCA <span>Explicit<\/span>/);
  });
});
