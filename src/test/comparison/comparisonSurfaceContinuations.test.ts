import * as assert from "assert";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { getComparisonSurfaceMarkup } from "../../webview/comparisonSurface/markup.js";
import { renderComparisonSurfaceHtml, sanitizeComparisonInvestigationStateForRenderedVerificationItems } from "../../webview/comparisonSurface/renderComparisonSurfaceHtml.js";

suite("comparisonSurface continuations", () => {
  test("renders replay-safe inline investigation continuations without remediation wording", () => {
    const model: ComparisonViewModel = {
      title: "Cross-Environment Diff: DEV → SIT",
      summary: {
        sourceLabel: "DEV",
        targetLabel: "SIT",
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        providerCount: 1,
        differenceCount: 1,
        subjectLabel: "Account"
      },
      groups: [
        {
          id: "plugin-step-runtime-behaviour-drift",
          title: "Plugin Step Runtime Behaviour Drift",
          summary: "Plugin step registrations differ between snapshots.",
          significance: "High",
          continuations: [
            {
              id: "continue-identity",
              title: "Inspect related identity participation",
              summary: "Observed runtime drift has adjacent identity participation evidence available for bounded follow-up.",
              kind: "IdentityParticipation",
              state: "Available",
              evidence: [{ label: "Related participation", value: "Integration Team", source: "both" }],
              children: [
                {
                  id: "continue-workflow",
                  title: "Inspect nearby workflow drift",
                  summary: "Workflow participation is available as nearby operational context only.",
                  kind: "WorkflowAutomation",
                  state: "InspectOnly",
                  evidence: [{ label: "Workflow", value: "Account Sync", source: "target" }]
                }
              ]
            }
          ],
          differences: [
            {
              id: "plugin-state",
              title: "Account Sync plugin state changed (Enabled → Disabled)",
              summary: "Plugin state differs.",
              kind: "State Drift",
              significance: "High",
              evidence: [{ label: "Plugin step", value: "Account Sync", source: "both" }],
              continuations: [
                {
                  id: "continue-raw-evidence",
                  title: "Inspect raw plugin evidence",
                  summary: "Raw evidence remains secondary and inspect-only.",
                  kind: "RawEvidence",
                  state: "InspectOnly",
                  evidence: [{ label: "Step id", value: "plugin-step-1", source: "both" }]
                }
              ]
            }
          ]
        }
      ],
      providerResults: []
    };

    const markup = getComparisonSurfaceMarkup(model);

    assert.match(markup, /Provider investigation continuations/);
    assert.match(markup, /Inline investigation continuations/);
    assert.match(markup, /Replay-safe, provider-owned continuations/);
    assert.match(markup, /Inspect related identity participation/);
    assert.match(markup, /Inspect raw plugin evidence/);
    assert.match(markup, /without implying causality, remediation, or authority certainty/);
    assert.doesNotMatch(markup, /root cause confirmed|fix recommendation|immediate remediation required|authoritative fix/i);
  });

  test("renders no-verification posture wording for comparisons without verification items", () => {
    const model: ComparisonViewModel = {
      title: "Timeline Diff: DEV · Task",
      summary: {
        sourceLabel: "DEV · Task source",
        targetLabel: "DEV · Task target",
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        providerCount: 5,
        differenceCount: 0,
        subjectLabel: "Task"
      },
      groups: [],
      providerResults: []
    };

    const markup = getComparisonSurfaceMarkup(model);

    assert.match(markup, /No rendered operational verification items/);
    assert.match(markup, /Verification posture: No verification items/);
    assert.match(markup, /data-reviewed-surface-progress>0 \/ 0/);
    assert.doesNotMatch(markup, /totalReviewSurfaceCount = totalProviderSet\.size \|\| 5/);
    assert.doesNotMatch(markup, /reviewedProviderSet\.size \|\| investigationState\.reviewedSurfaces\.length/);
  });


  test("clears stale verification state before rendering comparisons without verification items", () => {
    const sanitized = sanitizeComparisonInvestigationStateForRenderedVerificationItems({
      activeMode: "verification",
      baselineExportedAt: "2026-05-31T00:00:00.000Z",
      reviewedSurfaces: ["runtime-continuation", "handoff-continuation"],
      verifiedItems: ["stale-verification-item-1", "stale-verification-item-2"],
      verificationStatusByItem: {
        "stale-verification-item-1": "VerifiedExternally",
        "stale-verification-item-2": "ResolvedOutsideDvqr"
      },
      verificationNotesByItem: {
        "stale-verification-item-1": "Old note that must not leak into a no-drift report"
      }
    }, []);

    assert.deepStrictEqual(sanitized.verifiedItems, []);
    assert.deepStrictEqual(sanitized.verificationStatusByItem, {});
    assert.deepStrictEqual(sanitized.verificationNotesByItem, {});
    assert.deepStrictEqual(sanitized.reviewedSurfaces, ["runtime-continuation", "handoff-continuation"]);
  });

  test("preserves current rendered verification state and drops stale items", () => {
    const sanitized = sanitizeComparisonInvestigationStateForRenderedVerificationItems({
      verifiedItems: ["rendered-item", "stale-item"],
      verificationStatusByItem: {
        "rendered-item": "NeedsFollowUp",
        "auto-complete-item": "VerifiedExternally",
        "stale-item": "VerifiedExternally"
      },
      verificationNotesByItem: {
        "rendered-item": "Current note",
        "stale-item": "Stale note"
      }
    }, ["rendered-item", "auto-complete-item"]);

    assert.deepStrictEqual([...(sanitized.verifiedItems ?? [])].sort(), ["auto-complete-item", "rendered-item"]);
    assert.deepStrictEqual(sanitized.verificationStatusByItem, {
      "rendered-item": "NeedsFollowUp",
      "auto-complete-item": "VerifiedExternally"
    });
    assert.deepStrictEqual(sanitized.verificationNotesByItem, {
      "rendered-item": "Current note"
    });
  });

  test("does not serialize stale verification progress into no-drift timeline reports", () => {
    const model: ComparisonViewModel = {
      title: "Timeline Diff: DEV · Task",
      summary: {
        sourceLabel: "DEV · Task source",
        targetLabel: "DEV · Task target",
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        providerCount: 5,
        differenceCount: 0,
        subjectLabel: "Task"
      },
      groups: [],
      providerResults: []
    };
    const webview = { cspSource: "vscode-webview://test" };

    const html = renderComparisonSurfaceHtml(webview as never, model, {
      investigationState: {
        verifiedItems: Array.from({ length: 31 }, (_, index) => `stale-verification-item-${index + 1}`),
        verificationStatusByItem: Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`stale-verification-item-${index + 1}`, "VerifiedExternally"])),
        verificationNotesByItem: {
          "stale-verification-item-1": "Stale note"
        }
      }
    });

    assert.match(html, /No rendered operational verification items/);
    assert.match(html, /0 of 0 operational verification items reviewed in this session/);
    assert.match(html, /Verification posture: No verification items/);
    assert.doesNotMatch(html, /31 of 31/);
    assert.doesNotMatch(html, /stale-verification-item-1/);
    assert.doesNotMatch(html, /Stale note/);
  });

});
