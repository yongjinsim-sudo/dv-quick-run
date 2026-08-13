import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  InvestigationApplicationService,
  InvestigationEvidenceAcquisitionService,
  InvestigationEvidenceIntelligenceService,
  InvestigationEvidenceProviderRegistry,
  MetadataInvestigationEvidenceProvider,
  RelationshipContextInvestigationEvidenceProvider,
  RuntimeRelationshipInvestigationEvidenceProvider,
  WorkspaceInvestigationEvidenceRepository,
  WorkspaceInvestigationJournalRepository,
  WorkspaceInvestigationRepository
} from "../../pro/investigations/index.js";
import { InvestigationStrategyReconciler, investigationEvidenceSetFingerprint } from "../../pro/investigations/investigationStrategyReconciler.js";

suite("mcpInvestigationStrategyReconciliation", () => {
  function createHarness() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass51-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const application = new InvestigationApplicationService(investigations, environmentUrl);
    const acquisition = new InvestigationEvidenceAcquisitionService(
      investigations,
      new WorkspaceInvestigationEvidenceRepository(root, environmentUrl),
      new InvestigationEvidenceProviderRegistry([
        new MetadataInvestigationEvidenceProvider(),
        new RelationshipContextInvestigationEvidenceProvider(),
        new RuntimeRelationshipInvestigationEvidenceProvider()
      ]),
      new WorkspaceInvestigationJournalRepository(root, environmentUrl)
    );
    return { root, environmentUrl, investigations, application, acquisition };
  }

  test("reconciles metadata and relationship evidence into completed strategy steps", () => {
    const harness = createHarness();
    try {
      const created = harness.application.start({ question: "Investigate Contact", subject: { table: "contact" } });
      const metadata = harness.acquisition.record({
        investigationId: created.investigationId,
        providerId: "metadata",
        rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } }
      });
      assert.deepStrictEqual(metadata.investigation.strategy?.steps.slice(0, 3).map((step) => step.status), ["Completed", "Completed", "Current"]);

      const relationship = harness.acquisition.record({
        investigationId: created.investigationId,
        providerId: "relationship-context",
        rawResult: { ok: true, structuredContent: { sourceTable: "contact", recommendedAnchor: { logicalName: "account", score: 80 } } }
      });
      assert.deepStrictEqual(relationship.investigation.strategy?.steps.slice(0, 4).map((step) => step.status), ["Completed", "Completed", "Completed", "Current"]);
      assert.strictEqual(relationship.investigation.strategy?.steps[3].title, "Identify missing runtime evidence");
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  });

  test("continue presents the first evidence-incomplete step without skipping to readiness", () => {
    const harness = createHarness();
    try {
      const created = harness.application.start({ question: "Investigate Contact", subject: { table: "contact" } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact" } } });
      const continued = harness.application.continue(created.investigationId, harness.environmentUrl);
      assert.strictEqual(continued.presentedStep?.title, "Identify missing runtime evidence");
      assert.strictEqual(continued.investigation.strategy?.steps[3].status, "Current");
      assert.strictEqual(continued.investigation.strategy?.steps[4].status, "Pending");
      assert.match(continued.statusCard.nextRecommendation ?? "", /bounded (?:path-aware )?runtime(?:-relationship)? evidence|Runtime Relationship Evidence/i);
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  });

  test("reconciles persisted evidence after restart and separates provider contributions from readiness", () => {
    const harness = createHarness();
    try {
      const created = harness.application.start({ question: "Investigate Contact", subject: { table: "contact" } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact" } } });

      const restarted = new InvestigationApplicationService(harness.investigations, harness.environmentUrl);
      const loaded = restarted.get(created.investigationId);
      assert.strictEqual(loaded?.strategy?.steps[3].status, "Current");

      const summary = new InvestigationEvidenceIntelligenceService(harness.investigations).summarize(created.investigationId);
      assert.strictEqual(summary.readinessPosture, "NotAssessed");
      assert.deepStrictEqual(summary.providerContributions.map((item) => item.label).sort(), ["Business Surface Understanding", "Schema Understanding"]);
      assert.strictEqual(summary.currentStep, "Identify missing runtime evidence");
      assert.match(summary.nextRecommendation, /bounded (?:path-aware )?runtime(?:-relationship)? evidence|Runtime Relationship Evidence/i);
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  });

  test("runtime relationship evidence completes the runtime step and promotes readiness", () => {
    const harness = createHarness();
    try {
      const created = harness.application.start({ question: "Investigate Contact", subject: { table: "contact" } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact", recommendedAnchor: { logicalName: "msemr_encounter" } } } });
      const runtime = harness.acquisition.record({
        investigationId: created.investigationId,
        providerId: "runtime-relationship",
        rawResult: { ok: true, structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_encounter", sourceRecordId: "11111111-1111-4111-8111-111111111111", runtimeRecommendation: { finalTargetRecordCount: 1 }, runtimeEvidence: { observations: [{ reachedTarget: true, finalTargetRecordCount: 1 }] }, probeResults: [], bounds: {} } }
      });
      assert.strictEqual(runtime.investigation.strategy?.steps[3].status, "Completed");
      assert.strictEqual(runtime.investigation.strategy?.steps[4].status, "Current");
      assert.strictEqual(runtime.investigation.strategy?.steps[4].title, "Assess investigation readiness");
      assert.ok((runtime.investigation.contributorStates as Array<{ contributorId?: string }>).some((item) => item.contributorId === "runtime-relationship-understanding"));
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  });


  test("recommends business-path-runtime for a record investigation with a concrete persisted target", () => {
    const now = new Date().toISOString();
    const investigation = {
      investigationId: "inv-target-aware",
      schemaVersion: "dvqr-investigation-v1",
      title: "Target-aware record investigation",
      type: "Record",
      status: "Active",
      environmentId: "env",
      environmentUrlNormalized: "https://example.crm.dynamics.com",
      subject: { kind: "Record", logicalName: "contact", displayLabel: "Contact", recordIdMasked: "***12345678" },
      question: "Investigate Care Plan Activity",
      createdAt: now,
      updatedAt: now,
      evidenceRefs: [
        { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
        { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now }
      ],
      contributorStates: [], miniRcaArtifactRefs: [], executionRefs: [], reportRefs: [],
      lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" },
      limitations: [], staleState: { isStale: false, reasons: [] },
      currentIntent: { intentVersion: 1, leadingDirection: "Care Plan Activity", directionLabel: "Care Plan Activity", directionLogicalName: "msemr_careplanactivity", reportedProblem: "Expected Care Plan Activity was not created.", keywords: [], reason: "user confirmed", updatedBy: "User", updatedAt: now }
    } as any;
    const reconciler = new InvestigationStrategyReconciler();
    const result = reconciler.reconcile(investigation);
    assert.match(result.nextRecommendation, /business-path-runtime/i);
    assert.match(result.nextRecommendation, /msemr_careplanactivity/i);
    assert.match(result.nextRecommendation, /do not substitute legacy runtime-relationship/i);
  });

  test("legacy runtime evidence does not complete a target-aware runtime step", () => {
    const now = new Date().toISOString();
    const base = {
      investigationId: "inv-target-provider-enforcement",
      schemaVersion: "dvqr-investigation-v1",
      title: "Target-aware provider enforcement",
      type: "Record",
      status: "Active",
      environmentId: "env",
      environmentUrlNormalized: "https://example.crm.dynamics.com",
      subject: { kind: "Record", logicalName: "contact", displayLabel: "Contact", recordIdMasked: "***12345678" },
      question: "Investigate Care Plan Activity",
      createdAt: now, updatedAt: now,
      contributorStates: [], miniRcaArtifactRefs: [], executionRefs: [], reportRefs: [],
      lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" },
      limitations: [], staleState: { isStale: false, reasons: [] },
      currentIntent: { intentVersion: 1, leadingDirection: "Care Plan Activity", directionLabel: "Care Plan Activity", directionLogicalName: "msemr_careplanactivity", reportedProblem: "Expected Care Plan Activity was not created.", keywords: [], reason: "user confirmed", updatedBy: "User", updatedAt: now }
    } as any;
    const reconciler = new InvestigationStrategyReconciler();
    const legacy = reconciler.reconcile({ ...base, evidenceRefs: [
      { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-runtime", providerId: "runtime-relationship", status: "Acquired", acquiredAt: now }
    ] });
    assert.strictEqual(legacy.currentStep?.title, "Acquire target-aware runtime evidence");
    assert.strictEqual(legacy.currentStep?.status, "Current");
    assert.match(legacy.nextRecommendation, /does not complete this target-aware strategy step/i);
    assert.match(legacy.nextRecommendation, /business-path-runtime/i);

    const pathAware = reconciler.reconcile({ ...base, evidenceRefs: [
      { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-path", providerId: "business-path-runtime", status: "Acquired", acquiredAt: now }
    ] });
    assert.strictEqual(pathAware.currentStep?.title, "Assess investigation readiness");
    assert.strictEqual(pathAware.investigation.strategy?.steps[3].status, "Completed");
  });


  test("opens a post-checkpoint mechanism-context step and completes it only from managed mechanism evidence", () => {
    const now = new Date().toISOString();
    const base = {
      investigationId: "inv-mechanism-follow-on",
      schemaVersion: "dvqr-investigation-v1",
      title: "Mechanism follow-on",
      type: "Record",
      status: "ReadyForMiniRca",
      environmentId: "env",
      subject: { kind: "Record", logicalName: "contact", displayLabel: "Contact", recordIdMasked: "***12345678" },
      question: "Investigate Care Plan Activity",
      createdAt: now, updatedAt: now,
      evidenceRefs: [
        { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
        { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now },
        { evidenceId: "ev-path", providerId: "business-path-runtime", status: "Acquired", acquiredAt: now }
      ],
      contributorStates: [], miniRcaArtifactRefs: ["mrca-1"], executionRefs: [], reportRefs: [],
      lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" },
      limitations: [], staleState: { isStale: false, reasons: [] },
      managedReadiness: { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: "inv-mechanism-follow-on", posture: "Conditional", summary: "ready", evidenceCount: 3, providerContributions: [], gaps: [], recommendations: [], baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify", limitations: [], assessmentUtc: now, evidenceSetFingerprint: "stale-for-test" },
      currentIntent: { intentVersion: 1, leadingDirection: "Care Plan Activity", directionLabel: "Care Plan Activity", directionLogicalName: "msemr_careplanactivity", reportedProblem: "Expected activity was not created", keywords: [], reason: "confirmed", updatedBy: "User", updatedAt: now }
    } as any;
    // Use a canonical readiness marker for step completion in this isolated strategy test.
    base.readiness = { posture: "Limited" } as any;
    const reconciler = new InvestigationStrategyReconciler();
    const before = reconciler.reconcile(base);
    assert.strictEqual(before.currentStep?.title, "Inspect creation / transition mechanism evidence");
    assert.match(before.nextRecommendation, /mechanism-context/i);
    const withMechanism = { ...base, evidenceRefs: [...base.evidenceRefs, { evidenceId: "ev-mech", providerId: "mechanism-context", status: "Acquired", acquiredAt: now, decisionSignals: { pluginTraceState: "Observed" } }] } as any;
    const after = reconciler.reconcile(withMechanism);
    assert.strictEqual(after.investigation.strategy?.steps[6]?.status, "Completed");
    assert.strictEqual(after.currentStep?.title, "Reassess readiness with mechanism evidence");
    assert.match(after.nextRecommendation, /reassess investigation readiness/i);

    const freshReadiness = {
      ...withMechanism,
      managedReadiness: { ...base.managedReadiness, evidenceCount: 4, evidenceSetFingerprint: investigationEvidenceSetFingerprint(withMechanism), isStale: false }
    } as any;
    const reassessed = reconciler.reconcile(freshReadiness);
    assert.strictEqual(reassessed.currentStep?.title, "Regenerate Mini RCA with mechanism evidence");
    assert.match(reassessed.nextRecommendation, /do not recollect/i);

    const regenerated = reconciler.reconcile({
      ...freshReadiness,
      miniRcaArtifactRefs: ["mrca-1", "mrca-2"],
      managedMiniRcaCheckpoint: {
        artifactId: "mrca-2",
        evidenceSetFingerprint: freshReadiness.managedReadiness.evidenceSetFingerprint,
        readinessAssessmentUtc: freshReadiness.managedReadiness.assessmentUtc,
        generatedAt: "2026-08-09T00:06:00.000Z"
      }
    });
    assert.strictEqual(regenerated.investigation.strategy?.steps[8]?.status, "Completed");
    assert.strictEqual(regenerated.currentStep?.title, "Inspect observed plug-in execution surface");
    assert.strictEqual(regenerated.currentStep?.capability, "dvqr_inspect_plugin_execution");
    assert.match(regenerated.nextRecommendation, /plugin-execution-understanding|plug-in execution/i);
  });

  test("skips Plugin Execution Understanding when mechanism-context PluginTrace is Empty and recommends an independent discriminator", () => {
    const now = "2026-08-09T14:30:00.000Z";
    const evidenceRefs = [
      { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-path", providerId: "business-path-runtime", status: "Acquired", acquiredAt: now },
      { evidenceId: "ev-mech", providerId: "mechanism-context", status: "Acquired", acquiredAt: now, decisionSignals: { pluginTraceState: "Empty" } }
    ];
    const base = {
      investigationId: "inv-plugin-empty-branch", schemaVersion: "dvqr-investigation-v1", title: "Plugin empty branch", type: "Record", status: "ReadyForMiniRca", environmentId: "env",
      subject: { kind: "Record", logicalName: "contact", recordIdMasked: "***12345678" }, question: "Investigate Care Plan Activity", createdAt: now, updatedAt: now,
      evidenceRefs, contributorStates: [], miniRcaArtifactRefs: ["mrca-1", "mrca-2"], executionRefs: [], reportRefs: [], lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" }, limitations: [],
      currentIntent: { intentVersion: 1, leadingDirection: "Care Plan Activity", directionLabel: "Care Plan Activity", directionLogicalName: "msemr_careplanactivity", reportedProblem: "Expected activity missing", keywords: [], reason: "confirmed", updatedBy: "User", updatedAt: now },
      readiness: { posture: "Limited" },
      managedReadiness: { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: "inv-plugin-empty-branch", posture: "Conditional", summary: "ready", evidenceCount: 4, providerContributions: [], gaps: [], recommendations: [], baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify", limitations: [], assessmentUtc: now, evidenceSetFingerprint: "", isStale: false },
      managedMiniRcaCheckpoint: { artifactId: "mrca-2", evidenceSetFingerprint: "", readinessAssessmentUtc: now, generatedAt: now }
    } as any;
    base.managedReadiness.evidenceSetFingerprint = investigationEvidenceSetFingerprint(base);
    base.managedMiniRcaCheckpoint.evidenceSetFingerprint = base.managedReadiness.evidenceSetFingerprint;
    const result = new InvestigationStrategyReconciler().reconcile(base);
    assert.strictEqual(result.investigation.strategy?.steps[8]?.status, "Completed");
    assert.strictEqual(result.investigation.strategy?.steps[9]?.status, "Skipped");
    assert.strictEqual(result.currentStep, undefined);
    assert.match(result.nextRecommendation, /PluginTrace was Empty/i);
    assert.match(result.nextRecommendation, /do not repeat the identical mechanism-context query/i);
    assert.match(result.nextRecommendation, /Timeline/i);
  });


  test("Pass 10.8.3 exposes failed metadata as a blocked prerequisite instead of recommending an identical retry loop", () => {
    const now = "2026-08-11T10:00:00.000Z";
    const investigation = {
      investigationId: "inv-metadata-blocked",
      schemaVersion: "dvqr-investigation-v1",
      title: "Blocked metadata",
      type: "Record",
      status: "Active",
      environmentId: "env",
      subject: { kind: "Record", logicalName: "msemr_careplanactivity", recordIdMasked: "***3a6a75e8" },
      question: "Investigate Care Plan Activity",
      createdAt: now,
      updatedAt: now,
      evidenceRefs: [{ evidenceId: "ev-meta-failed", providerId: "metadata", status: "Failed", acquiredAt: now }],
      contributorStates: [],
      miniRcaArtifactRefs: [],
      executionRefs: [],
      reportRefs: [],
      lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" },
      limitations: [],
      staleState: { isStale: false, reasons: [] },
      currentIntent: { intentVersion: 1, leadingDirection: "Care Plan Activity", directionLabel: "Care Plan Activity", directionLogicalName: "msemr_careplanactivity", reportedProblem: "Investigate downstream task", keywords: [], reason: "confirmed", updatedBy: "User", updatedAt: now }
    } as any;
    const result = new InvestigationStrategyReconciler().reconcile(investigation);
    assert.strictEqual(result.currentStep?.title, "Verify current table metadata");
    assert.match(result.nextRecommendation, /BLOCKED PREREQUISITE/i);
    assert.match(result.nextRecommendation, /Do not repeat the identical metadata acquisition/i);
    assert.match(result.nextRecommendation, /Verify or edit the persisted subject binding/i);
  });

  test("Pass 10.8.5 returns an exact Mini RCA checkpoint ToolCall after managed readiness", () => {
    const harness = createHarness();
    try {
      const created = harness.application.start({ question: "Investigate Contact", subject: { table: "contact" } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact", recommendedAnchor: { logicalName: "msemr_encounter" } } } });
      harness.acquisition.record({
        investigationId: created.investigationId,
        providerId: "runtime-relationship",
        rawResult: { ok: true, structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_encounter", sourceRecordId: "11111111-1111-4111-8111-111111111111", runtimeRecommendation: { finalTargetRecordCount: 1 }, runtimeEvidence: { observations: [{ reachedTarget: true, finalTargetRecordCount: 1 }] }, probeResults: [], bounds: {} } }
      });
      new InvestigationEvidenceIntelligenceService(harness.investigations).assessManaged(created.investigationId);
      const continued = harness.application.continue(created.investigationId, harness.environmentUrl);
      assert.strictEqual(continued.presentedStep?.capability, "dvqr_generate_mini_rca");
      assert.strictEqual(continued.recommendedAction?.kind, "ToolCall");
      assert.strictEqual(continued.recommendedAction?.tool, "dvqr_generate_mini_rca_checkpoint");
      assert.deepStrictEqual(continued.recommendedAction?.arguments, { investigationId: created.investigationId });
      assert.strictEqual(
        continued.recommendedAction?.reason,
        "The persisted strategy is at the Mini RCA checkpoint and current managed readiness is the prerequisite for generating the frozen Mini RCA artifact."
      );
      assert.strictEqual(continued.recommendedAction?.integrity.contractVersion, "dvqr-managed-recommended-action-integrity-v1");
      assert.match(continued.recommendedAction?.integrity.actionId ?? "", /^dva-[0-9a-f]{24}$/);
      assert.strictEqual(continued.recommendedAction?.integrity.strategyStepOrder, 6);
      assert.strictEqual(continued.recommendedAction?.integrity.executionBoundary, "OneExplicitToolCall");
      assert.strictEqual(continued.recommendedAction?.integrity.exactToolAndPersistedArgumentsRequired, true);
      assert.strictEqual(continued.recommendedAction?.integrity.transientHostArgumentsMayBeAddedOnlyAsSpecified, true);
      assert.strictEqual(continued.recommendedAction?.integrity.mustStopAfterExecution, true);
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  });
  test("Pass 10.8.6 returns an executable target-aware runtime action with a transient source-record requirement", () => {
    const harness = createHarness();
    try {
      const created = harness.application.start({ question: "Investigate Contact and downstream contoso_workitem", subject: { kind: "Record", logicalName: "contact", recordId: "11111111-1111-4111-8111-111111111111" } as any });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
      harness.acquisition.record({ investigationId: created.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact", recommendedAnchor: { logicalName: "account" } } } });
      const persisted = harness.investigations.get(created.investigationId) as any;
      harness.investigations.save({
        ...persisted,
        currentIntent: {
          intentVersion: 1,
          leadingDirection: "contoso_workitem",
          directionLabel: "contoso_workitem",
          directionLogicalName: "contoso_workitem",
          reportedProblem: "Understand the downstream work item.",
          keywords: [],
          reason: "Explicit user target.",
          updatedBy: "User",
          updatedAt: new Date().toISOString()
        }
      });
      const continued = harness.application.continue(created.investigationId, harness.environmentUrl);
      assert.strictEqual(continued.presentedStep?.title, "Acquire target-aware runtime evidence");
      assert.strictEqual(continued.recommendedAction?.kind, "ToolCall");
      assert.strictEqual(continued.recommendedAction?.tool, "dvqr_acquire_investigation_evidence");
      assert.deepStrictEqual(continued.recommendedAction?.arguments, {
        investigationId: created.investigationId,
        providerId: "business-path-runtime",
        targetTable: "contoso_workitem"
      });
      assert.strictEqual(continued.recommendedAction?.requiredHostArguments?.sourceRecordId?.source, "CurrentConversationSubjectRecordId");
      assert.strictEqual(continued.recommendedAction?.requiredHostArguments?.sourceRecordId?.persist, false);
      assert.match(continued.recommendedAction?.reason ?? "", /target-aware runtime validation/i);
    } finally {
      fs.rmSync(harness.root, { recursive: true, force: true });
    }
  });


  test("Pass 10.8.8 exposes Timeline only as an optional exact branch after deterministic post-checkpoint work completes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-timeline-optional-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const application = new InvestigationApplicationService(investigations, environmentUrl);
    try {
      const now = "2026-08-12T00:00:00.000Z";
      const evidenceRefs = [
        { evidenceId: "ev-11111111-1111-4111-8111-111111111111", providerId: "metadata", evidenceType: "EntityMetadata", status: "Acquired", acquiredAt: now, summary: "metadata" },
        { evidenceId: "ev-22222222-2222-4222-8222-222222222222", providerId: "relationship-context", evidenceType: "RelationshipContext", status: "Acquired", acquiredAt: now, summary: "relationship" },
        { evidenceId: "ev-33333333-3333-4333-8333-333333333333", providerId: "business-path-runtime", evidenceType: "BusinessPathRuntime", status: "Acquired", acquiredAt: now, summary: "runtime" },
        { evidenceId: "ev-44444444-4444-4444-8444-444444444444", providerId: "mechanism-context", evidenceType: "MechanismContext", status: "Acquired", acquiredAt: now, summary: "mechanism", decisionSignals: { pluginTraceState: "Observed" } },
        { evidenceId: "ev-55555555-5555-4555-8555-555555555555", providerId: "plugin-execution-understanding", evidenceType: "PluginExecutionUnderstanding", status: "Acquired", acquiredAt: now, summary: "plugin execution" }
      ];
      const base: any = {
        investigationId: "inv-88888888-8888-4888-8888-888888888888",
        schemaVersion: "dvqr-investigation-v1",
        title: "Timeline optional",
        type: "Record",
        status: "ReadyForMiniRca",
        environmentId: "example.crm.dynamics.com",
        subject: { kind: "Record", logicalName: "msemr_careplanactivity", recordIdMasked: "***3a6a75e8" },
        question: "Investigate downstream bu_task",
        createdAt: now, updatedAt: now, bootstrapCompletedAt: now,
        evidenceRefs, contributorStates: [], miniRcaArtifactRefs: ["mrca-88888888-8888-4888-8888-888888888888"], executionRefs: [], reportRefs: [],
        lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" }, limitations: [], staleState: { isStale: false, reasons: [] },
        currentIntent: { intentVersion: 1, leadingDirection: "bu_task", directionLabel: "bu_task", directionLogicalName: "bu_task", directionSource: "UserCustom", reportedProblem: "How did task come to exist?", keywords: [], reason: "confirmed", updatedBy: "User", updatedAt: now }
      };
      const fp = investigationEvidenceSetFingerprint(base);
      base.managedReadiness = { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: base.investigationId, posture: "Conditional", summary: "current", evidenceCount: 5, providerContributions: [], gaps: [], recommendations: [], baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify", limitations: [], assessmentUtc: now, evidenceSetFingerprint: fp, isStale: false };
      base.managedMiniRcaCheckpoint = { artifactId: base.miniRcaArtifactRefs[0], evidenceSetFingerprint: fp, readinessAssessmentUtc: now, generatedAt: now };
      investigations.save(base);
      const continued = application.continue(base.investigationId, environmentUrl);
      assert.strictEqual(continued.recommendedAction, undefined);
      assert.strictEqual(continued.optionalActions?.length, 1);
      assert.strictEqual(continued.optionalActions?.[0]?.kind, "ToolCall");
      assert.strictEqual(continued.optionalActions?.[0]?.tool, "dvqr_acquire_timeline_context");
      assert.deepStrictEqual(continued.optionalActions?.[0]?.arguments, { investigationId: base.investigationId, targetTable: "bu_task" });
      assert.strictEqual(continued.optionalActions?.[0]?.requiredHostArguments?.fromIso?.required, true);
      assert.strictEqual(continued.optionalActions?.[0]?.requiredHostArguments?.toIso?.required, true);
      assert.match(continued.optionalActions?.[0]?.reason ?? "", /optional independent chronology discriminator/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

});
