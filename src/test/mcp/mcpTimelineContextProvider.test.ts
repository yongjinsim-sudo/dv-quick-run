import * as assert from "assert";
import { TimelineContextInvestigationEvidenceProvider } from "../../pro/investigations/investigationEvidenceProvider.js";
import type { Investigation } from "../../pro/investigations/investigationContracts.js";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import { buildInvestigationStrategy } from "../../pro/investigations/investigationStrategy.js";
import { buildInvestigationPlan } from "../../pro/investigations/investigationPlanning.js";

function investigation(): Investigation {
  return {
    investigationId: "inv-timeline",
    schemaVersion: "dvqr-investigation-v1",
    environmentId: "https://example.crm.dynamics.com",
    question: "Investigate task creation",
    subject: { kind: "Record", logicalName: "contact", label: "contact" },
    status: "Active",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    evidenceRefs: [],
    contributorStates: [],
    limitations: [],
    miniRcaArtifactRefs: [],
    staleState: { isStale: false },
    currentIntent: { version: 1, focus: "CreationMechanism", reportedProblem: "How was task created?", directionLogicalName: "bu_task", confidence: "High", source: "UserConfirmed", updatedAt: "2026-08-11T00:00:00.000Z" }
  } as unknown as Investigation;
}

function result(rows: readonly Record<string, unknown>[], ok = true): Record<string, unknown> {
  return { ok, structuredContent: { data: { value: rows } } };
}

suite("Pass 10.8 executable timeline context", () => {
  test("normalizes multiple sources into deterministic chronological order without causal claims", () => {
    const provider = new TimelineContextInvestigationEvidenceProvider();
    const normalized = provider.normalize({
      ok: true,
      structuredContent: {
        targetTable: "bu_task",
        interval: { fromIso: "2026-07-01T00:00:00Z", toIso: "2026-07-31T23:59:59Z" },
        audit: result([{ createdon: "2026-07-10T10:00:03Z", operation: 2, action: 2 }]),
        asyncOperations: result([{ createdon: "2026-07-10T10:00:01Z", name: "Workflow A", primaryentitytype: "bu_task" }]),
        pluginTrace: result([{ createdon: "2026-07-10T10:00:02Z", typename: "Contoso.Plugin", messagename: "Create", primaryentity: "bu_task" }])
      }
    }, { investigation: investigation(), acquiredAt: "2026-08-11T00:01:00Z" });
    assert.strictEqual(normalized.status, "Acquired");
    const payload = normalized.payload as { events: Array<{ source: string; observedAt?: string }>; interpretationBoundary: string };
    assert.deepStrictEqual(payload.events.map((item) => item.source), ["AsyncOperation", "PluginTrace", "Audit"]);
    assert.match(payload.interpretationBoundary, /do not by themselves establish triggering, causality/i);
    assert.strictEqual(normalized.contributorMappings?.[0]?.contributorId, "timeline-understanding");
  });

  test("preserves Empty and Unavailable as different timeline source states", () => {
    const provider = new TimelineContextInvestigationEvidenceProvider();
    const normalized = provider.normalize({
      ok: true,
      structuredContent: {
        targetTable: "bu_task",
        interval: { fromIso: "2026-07-01T00:00:00Z", toIso: "2026-07-31T23:59:59Z" },
        audit: { ok: false, message: "HTTP 403" },
        asyncOperations: result([]),
        pluginTrace: result([])
      }
    }, { investigation: investigation(), acquiredAt: "2026-08-11T00:01:00Z" });
    const payload = normalized.payload as { sources: Array<{ kind: string; state: string; interpretationBoundary: string }> };
    assert.deepStrictEqual(payload.sources.map((item) => [item.kind, item.state]), [
      ["Audit", "Unavailable"], ["AsyncOperation", "Empty"], ["PluginTrace", "Empty"]
    ]);
    assert.match(payload.sources[0].interpretationBoundary, /indeterminate/i);
    assert.match(payload.sources[1].interpretationBoundary, /does not establish non-participation/i);
  });

  test("publishes timeline-context through the managed acquisition schema", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_investigation_evidence");
    if (!tool) throw new Error("Managed acquisition tool not found.");
    const provider = (tool.inputSchema.properties as Record<string, any>).providerId;
    assert.ok(provider.enum.includes("timeline-context"));
    assert.match(provider.description, /chronological ledger/i);
  });

  test("keeps executable timeline optional rather than making it a mandatory record-strategy gate", () => {
    const strategy = buildInvestigationStrategy(investigation());
    assert.strictEqual(strategy.steps.some((step) => step.capability === "dvqr_reconstruct_timeline_context"), false);
  });

  test("Pass 10.8.4 makes explicit timeline requests route to timeline-context without requiring a mandatory strategy step", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_investigation_evidence");
    if (!tool) throw new Error("Managed acquisition tool not found.");
    assert.match(tool.description, /TIMELINE ROUTING RULE/i);
    assert.match(tool.description, /providerId=timeline-context/i);
    assert.match(tool.description, /does not need to appear as a mandatory persisted strategy step/i);
    assert.match(tool.description, /Never substitute plugin-execution-understanding for an explicit timeline request/i);
  });

  test("Pass 10.8.4 exposes a first-class optional timeline handoff alias", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_timeline_context");
    if (!tool) throw new Error("Managed timeline alias missing.");
    assert.match(tool.description, /FIRST-CLASS OPTIONAL TIMELINE HANDOFF/i);
    const schema = tool.inputSchema as any;
    assert.deepStrictEqual(schema.required, ["investigationId", "targetTable", "fromIso", "toIso", "boundaryRequestText"]);
    assert.match(tool.description, /Never substitute plugin-execution-understanding/i);
  });

  test("Pass 10.8.8 removes stale completed plug-in plan recommendations and exposes Timeline as optional chronology", () => {
    const base = investigation();
    const value = {
      ...base,
      status: "ReadyForMiniRca",
      evidenceRefs: [
        { evidenceId: "ev-11111111-1111-4111-8111-111111111111", providerId: "mechanism-context", evidenceType: "MechanismContext", status: "Acquired", acquiredAt: "2026-08-11T00:02:00Z", summary: "mechanism", decisionSignals: { pluginTraceState: "Observed" } },
        { evidenceId: "ev-22222222-2222-4222-8222-222222222222", providerId: "plugin-execution-understanding", evidenceType: "PluginExecutionUnderstanding", status: "Acquired", acquiredAt: "2026-08-11T00:03:00Z", summary: "plugin execution" }
      ],
      miniRcaArtifactRefs: ["mrca-11111111-1111-4111-8111-111111111111"],
      managedReadiness: {
        contractVersion: "dvqr-managed-investigation-readiness-v1",
        investigationId: base.investigationId,
        posture: "Conditional",
        summary: "current",
        evidenceCount: 2,
        providerContributions: [],
        gaps: [], recommendations: [],
        baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify",
        limitations: [], assessmentUtc: "2026-08-11T00:04:00Z", evidenceSetFingerprint: "fp", isStale: false
      },
      managedMiniRcaCheckpoint: {
        artifactId: "mrca-11111111-1111-4111-8111-111111111111",
        evidenceSetFingerprint: "fp",
        readinessAssessmentUtc: "2026-08-11T00:04:00Z",
        generatedAt: "2026-08-11T00:05:00Z"
      }
    } as unknown as Investigation;
    const plan = buildInvestigationPlan(value, "2026-08-11T00:06:00Z");
    assert.strictEqual(plan.recommendedNextAction.tool, "dvqr_acquire_timeline_context");
    assert.match(plan.recommendedNextAction.label, /Optional.*Timeline/i);
    assert.match(plan.recommendedNextAction.reason, /optional independent chronology discriminator/i);
    assert.doesNotMatch(plan.recommendedNextAction.label + plan.recommendedNextAction.reason, /Inspect observed plug-in execution surface/i);
  });

  test("Pass 10.8.9.2 persists relative Timeline boundary provenance without claiming verbatim ISO input", () => {
    const provider = new TimelineContextInvestigationEvidenceProvider();
    const normalized = provider.normalize({
      ok: true,
      structuredContent: {
        targetTable: "bu_task",
        interval: { fromIso: "2026-07-13T00:00:00Z", toIso: "2026-08-12T23:59:59Z" },
        boundaryProvenance: {
          source: "UserRelativeBoundary",
          requestText: "Use the last 30 days.",
          resolvedFromIso: "2026-07-13T00:00:00Z",
          resolvedToIso: "2026-08-12T23:59:59Z"
        },
        audit: result([]), asyncOperations: result([]), pluginTrace: result([])
      }
    }, { investigation: investigation(), acquiredAt: "2026-08-12T00:00:00Z" });
    const payload = normalized.payload as any;
    assert.strictEqual(payload.boundaryProvenance.source, "UserRelativeBoundary");
    assert.strictEqual(payload.boundaryProvenance.requestText, "Use the last 30 days.");
    assert.strictEqual(payload.boundaryProvenance.resolvedFromIso, "2026-07-13T00:00:00Z");
  });

  test("Pass 10.8.8 keeps Timeline chronology bounded and explicitly non-causal even when events are adjacent", () => {
    const provider = new TimelineContextInvestigationEvidenceProvider();
    const normalized = provider.normalize({
      ok: true,
      structuredContent: {
        targetTable: "bu_task",
        interval: { fromIso: "2026-07-01T00:00:00Z", toIso: "2026-07-31T23:59:59Z" },
        audit: result([]),
        asyncOperations: result([{ createdon: "2026-07-16T23:16:04Z", name: "Async immediately before trace", primaryentitytype: "bu_task" }]),
        pluginTrace: result([{ createdon: "2026-07-16T23:16:05Z", typename: "Contoso.Plugin", messagename: "Create", primaryentity: "bu_task" }])
      }
    }, { investigation: investigation(), acquiredAt: "2026-08-11T00:01:00Z" });
    const payload = normalized.payload as { chronology: { state: string; eventCount: number }; events: Array<{ observedAt?: string }>; interpretationBoundary: string };
    assert.strictEqual(payload.chronology.state, "ObservedSequence");
    assert.strictEqual(payload.chronology.eventCount, 2);
    assert.deepStrictEqual(payload.events.map((item) => item.observedAt), ["2026-07-16T23:16:04Z", "2026-07-16T23:16:05Z"]);
    assert.match(payload.interpretationBoundary, /temporal proximity.*do not by themselves establish triggering, causality/i);
  });

});
