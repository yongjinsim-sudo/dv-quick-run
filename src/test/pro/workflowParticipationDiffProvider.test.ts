import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import { WorkflowParticipationDiffProvider } from "../../pro/comparison/index.js";

suite("WorkflowParticipationDiffProvider", () => {
  test("surfaces workflow presence and state drift from workflow participation snapshots", async () => {
    const provider = new WorkflowParticipationDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "WorkflowParticipation",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        entityLogicalName: "account",
        workflows: [
          {
            uniqueName: "Contoso_AccountSync",
            name: "Contoso Account Sync",
            mode: "Real-time",
            state: "Active",
            isManaged: true
          },
          {
            uniqueName: "Contoso_LegacyWorkflow",
            name: "Contoso Legacy Workflow",
            mode: "Background",
            state: "Inactive",
            isManaged: true
          }
        ]
      }
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "WorkflowParticipation",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        entityLogicalName: "account",
        workflows: [
          {
            uniqueName: "Contoso_AccountSync",
            name: "Contoso Account Sync",
            mode: "Real-time",
            state: "Inactive",
            isManaged: true
          },
          {
            uniqueName: "Contoso_NewFlow",
            name: "Contoso New Flow",
            category: "Power Automate",
            state: "Active",
            isManaged: true
          }
        ]
      }
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    assert.strictEqual(result.providerId, "workflow-participation-diff");
    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Workflow / Automation Participation Drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("Automation state changed")));
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("only in source")));
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("only in target")));
    assert.ok(result.groups[0].differences.every((difference) => !difference.summary.includes("caused runtime behaviour")));
  });

  test("keeps missing workflow participation evidence quiet", async () => {
    const provider = new WorkflowParticipationDiffProvider();

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: []
    });

    assert.deepStrictEqual(result.groups, []);
  });
});
