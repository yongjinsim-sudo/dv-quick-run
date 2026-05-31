import * as assert from "assert";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { getComparisonSurfaceMarkup } from "../../webview/comparisonSurface/markup.js";

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
});
