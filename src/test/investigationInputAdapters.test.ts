import * as assert from "assert";
import type { ComparisonViewModel } from "../core/comparison/index.js";
import type { TimelineReconstruction } from "../pro/timeline/index.js";
import { adaptCrossDiffToInvestigationInput, adaptTimelineToInvestigationInput } from "../pro/miniRca/index.js";

suite("investigationInputAdapters", () => {
  test("normalises Timeline Reconstruction through investigation-input-v1", () => {
    const timeline = {
      id: "timeline-1",
      generatedAtIso: "2026-07-14T00:00:00.000Z",
      subject: {
        subjectLabel: "Account",
        subjectType: "entity",
        entityLogicalName: "account",
        environmentLabel: "DEV",
      },
      topEvents: [{
        providerId: "metadata",
        providerTitle: "Metadata Diff",
        title: "Attribute changed",
        summary: "Attribute metadata changed.",
        category: "Changed",
        significance: "High",
        firstObservedBetween: { label: "Snapshot A → Snapshot B" },
        evidenceRefs: [{ label: "Attribute", value: "account.name" }],
      }],
    } as unknown as TimelineReconstruction;

    const input = adaptTimelineToInvestigationInput(timeline);

    assert.strictEqual(input.version, "investigation-input-v1");
    assert.strictEqual(input.kind, "timeline");
    assert.strictEqual(input.provenance.sourceArtifactId, "timeline-1");
    assert.strictEqual(input.evidence[0]?.id, "timeline-1");
    assert.strictEqual(input.evidence[0]?.firstObservedBetween, "Snapshot A → Snapshot B");
    assert.strictEqual(input.contributors.find((item) => item.id === "cross-environment-diff")?.state, "not-applicable");
  });

  test("normalises Cross-Environment Diff while preserving orientation and provider ownership", () => {
    const model: ComparisonViewModel = {
      title: "DEV → TEST",
      summary: {
        sourceLabel: "DEV",
        targetLabel: "TEST",
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        providerCount: 1,
        differenceCount: 1,
        subjectLabel: "Account",
        entityLogicalName: "account",
      },
      groups: [],
      providerResults: [{
        providerId: "attribute-metadata",
        title: "Attribute Metadata",
        groups: [{
          id: "attributes",
          title: "Attributes",
          summary: "Attribute drift",
          significance: "High",
          differences: [{
            id: "name-required-level",
            title: "Required level changed",
            summary: "name changed from None to ApplicationRequired.",
            kind: "Changed",
            significance: "High",
            sourceValue: "None",
            targetValue: "ApplicationRequired",
            evidence: [
              { label: "Source required level", value: "None", source: "source" },
              { label: "Target required level", value: "ApplicationRequired", source: "target" },
            ],
          }],
        }],
      }],
    };

    const input = adaptCrossDiffToInvestigationInput(model);

    assert.strictEqual(input.version, "investigation-input-v1");
    assert.strictEqual(input.kind, "cross-environment-diff");
    assert.strictEqual(input.subject.sourceEnvironmentLabel, "DEV");
    assert.strictEqual(input.subject.targetEnvironmentLabel, "TEST");
    assert.strictEqual(input.evidence.length, 1);
    assert.strictEqual(input.evidence[0]?.providerId, "attribute-metadata");
    assert.strictEqual(input.evidence[0]?.sourceValue, "None");
    assert.strictEqual(input.evidence[0]?.targetValue, "ApplicationRequired");
    assert.deepStrictEqual(input.evidence[0]?.sourceEvidenceReferences.map((item) => item.source), ["source", "target"]);
    assert.strictEqual(input.contributors.find((item) => item.id === "audit")?.state, "unavailable");
  });

  test("produces deterministic Cross-Diff evidence identifiers", () => {
    const model = {
      title: "Comparison",
      summary: {
        sourceLabel: "DEV",
        targetLabel: "TEST",
        highCount: 0,
        mediumCount: 1,
        lowCount: 0,
        providerCount: 1,
        differenceCount: 1,
      },
      groups: [],
      providerResults: [{
        providerId: "workflow",
        title: "Workflow Diff",
        groups: [{
          id: "workflow-group",
          title: "Workflow",
          summary: "Workflow drift",
          significance: "Medium",
          differences: [{
            id: "workflow-1",
            title: "Workflow differs",
            summary: "Workflow state differs.",
            kind: "State Drift",
            significance: "Medium",
            evidence: [],
          }],
        }],
      }],
    } as ComparisonViewModel;

    const first = adaptCrossDiffToInvestigationInput(model);
    const second = adaptCrossDiffToInvestigationInput(model);

    assert.deepStrictEqual(first.evidence.map((item) => item.id), second.evidence.map((item) => item.id));
    assert.strictEqual(first.evidence[0]?.id, "cross-diff:workflow:workflow-group:workflow-1");
  });
});
