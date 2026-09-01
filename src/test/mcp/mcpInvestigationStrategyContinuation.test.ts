import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { InvestigationApplicationService, WorkspaceInvestigationRepository } from "../../pro/investigations/index.js";
import { buildInvestigationStrategy } from "../../pro/investigations/investigationStrategy.js";
import { investigationEvidenceSetFingerprint } from "../../pro/investigations/investigationStrategyReconciler.js";
import type { Investigation } from "../../pro/investigations/investigationContracts.js";

suite("mcpInvestigationStrategyContinuation", () => {
  test("builds deterministic strategy templates for the same investigation type", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-strategy-"));
    try {
      const times = [new Date("2026-08-03T00:00:00.000Z"), new Date("2026-08-03T00:00:00.000Z")];
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com", () => times.shift() ?? new Date("2026-08-03T00:00:00.000Z"));
      const first = service.start({ question: "Investigate Contact", subject: { table: "contact" } });
      const second = service.start({ question: "Investigate Account", subject: { table: "account" } });
      assert.strictEqual(first.strategy?.templateId, "table-investigation-v1");
      assert.deepStrictEqual(first.strategy?.steps.map((step) => ({ title: step.title, capability: step.capability, authority: step.authority })), second.strategy?.steps.map((step) => ({ title: step.title, capability: step.capability, authority: step.authority })));
      assert.strictEqual(first.strategy?.steps[0].status, "Current");
      assert.ok(first.strategy?.steps.some((step) => step.requiresExplicitUserAction));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("backfills and persists a deterministic strategy for pre-Pass-2 investigations", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-strategy-backfill-"));
    try {
      const repository = new WorkspaceInvestigationRepository(root);
      const service = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com");
      const created = service.start({ question: "Investigate Contact", subject: { table: "contact" } });
      const legacy = { ...created } as any;
      delete legacy.strategy;
      repository.save(legacy);
      const loaded = service.get(created.investigationId);
      assert.strictEqual(loaded?.strategy?.templateId, "table-investigation-v1");
      assert.ok((loaded?.strategy?.steps.length ?? 0) > 1);
      assert.strictEqual(repository.get(created.investigationId)?.strategy?.templateId, "table-investigation-v1");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("continues exactly one bounded strategy step without evidence or execution", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-continue-"));
    try {
      let tick = 0;
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com", () => new Date(`2026-08-03T00:00:0${tick++}.000Z`));
      const created = service.start({ question: "Investigate Contact", subject: { table: "contact" } });
      const result = service.continue(created.investigationId);
      assert.strictEqual(result.noExecutionPerformed, true);
      assert.strictEqual(result.evidenceAcquired, false);
      assert.strictEqual(result.presentedStep?.order, 1);
      assert.strictEqual(result.investigation.strategy?.currentStepIndex, 1);
      assert.strictEqual(result.investigation.strategy?.steps[0].status, "Completed");
      assert.strictEqual(result.investigation.strategy?.steps[1].status, "Current");
      assert.deepStrictEqual(result.investigation.evidenceRefs, []);
      assert.deepStrictEqual(result.investigation.executionRefs, []);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });


  test("Pass 10.9.6 binds each deterministic recommendation to a stable exact-action integrity contract", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-action-integrity-"));
    try {
      const repository = new WorkspaceInvestigationRepository(root);
      const service = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com");
      const created = service.start({
        question: "Investigate Contact 11111111-1111-4111-8111-111111111111 downstream account",
        subject: { kind: "Record", logicalName: "contact", recordId: "11111111-1111-4111-8111-111111111111" }
      });
      // The first continuation advances only the scope-confirmation step and presents metadata.
      const first = service.continue(created.investigationId);
      const action = first.recommendedAction;
      assert.ok(action);
      assert.strictEqual(action?.tool, "dvqr_acquire_investigation_evidence");
      assert.strictEqual(action?.arguments.providerId, "metadata");
      assert.strictEqual(action?.integrity.contractVersion, "dvqr-managed-recommended-action-integrity-v1");
      assert.match(action?.integrity.actionId ?? "", /^dva-[0-9a-f]{24}$/);
      assert.strictEqual(action?.integrity.strategyStepOrder, 2);
      assert.strictEqual(action?.integrity.executionBoundary, "OneExplicitToolCall");
      assert.strictEqual(action?.integrity.exactToolAndPersistedArgumentsRequired, true);
      assert.strictEqual(action?.integrity.transientHostArgumentsMayBeAddedOnlyAsSpecified, true);
      assert.strictEqual(action?.integrity.mustStopAfterExecution, true);

      // A repeated read of the same current boundary must produce the same action identity.
      const repeated = service.continue(created.investigationId);
      assert.strictEqual(repeated.recommendedAction?.integrity.actionId, action?.integrity.actionId);
      assert.strictEqual(repeated.recommendedAction?.integrity.evidenceSetFingerprint, action?.integrity.evidenceSetFingerprint);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("pauses and resumes while preserving strategy state", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-pause-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const created = service.start({ question: "Investigate Contact", subject: { table: "contact" } });
      const paused = service.pause(created.investigationId);
      assert.strictEqual(paused.status, "Paused");
      assert.throws(() => service.continue(created.investigationId), /paused/i);
      const resumed = service.resume(created.investigationId, "https://example.crm.dynamics.com");
      assert.strictEqual(resumed.status, "Active");
      assert.strictEqual(resumed.staleState?.isStale, false);
      assert.strictEqual(resumed.strategy?.currentStepIndex, 0);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("blocks continuation and marks stale on environment mismatch", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-stale-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const created = service.start({ question: "Investigate Contact", subject: { table: "contact" } });
      assert.throws(() => service.continue(created.investigationId, "https://other.crm.dynamics.com"), /stale/i);
      const loaded = service.get(created.investigationId);
      assert.strictEqual(loaded?.status, "Limited");
      assert.strictEqual(loaded?.staleState?.isStale, true);
      assert.match(loaded?.staleState?.reasons[0] ?? "", /Environment mismatch/i);
      assert.deepStrictEqual(loaded?.evidenceRefs, []);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("Pass 10.8.7 exposes deterministic mechanism -> stale readiness -> refreshed Mini RCA actions", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-post-checkpoint-refresh-"));
    try {
      const repository = new WorkspaceInvestigationRepository(root);
      const service = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com");
      const now = "2026-08-12T00:00:00.000Z";
      const base = {
        investigationId: "inv-77777777-7777-4777-8777-777777777777",
        schemaVersion: "dvqr-investigation-v1",
        title: "Post-checkpoint refresh",
        type: "Record",
        status: "ReadyForMiniRca",
        environmentId: "example.crm.dynamics.com",
        subject: { kind: "Record", logicalName: "msemr_careplanactivity", displayLabel: "Care Plan Activity", recordIdMasked: "***3a6a75e8" },
        question: "Investigate downstream sample_task creation",
        createdAt: now,
        updatedAt: now,
        evidenceRefs: [
          { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
          { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now },
          { evidenceId: "ev-runtime", providerId: "business-path-runtime", status: "Acquired", acquiredAt: now }
        ],
        contributorStates: [],
        miniRcaArtifactRefs: ["mrca-first"],
        managedMiniRcaCheckpoint: { artifactId: "mrca-first", evidenceSetFingerprint: "pending", readinessAssessmentUtc: now, generatedAt: now },
        executionRefs: [], reportRefs: [],
        lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" },
        limitations: [], staleState: { isStale: false, reasons: [] },
        currentIntent: { intentVersion: 1, leadingDirection: "sample_task", directionLabel: "sample_task", directionLogicalName: "sample_task", reportedProblem: "How did sample_task come to exist?", keywords: [], reason: "confirmed", updatedBy: "User", updatedAt: now }
      } as unknown as Investigation;
      const fp = investigationEvidenceSetFingerprint(base);
      const ready = {
        ...base,
        managedReadiness: { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: base.investigationId, posture: "Conditional", summary: "ready", evidenceCount: 3, providerContributions: [], gaps: [], recommendations: [], baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify", limitations: [], assessmentUtc: now, evidenceSetFingerprint: fp },
        managedMiniRcaCheckpoint: { ...base.managedMiniRcaCheckpoint!, evidenceSetFingerprint: fp },
        strategy: buildInvestigationStrategy(base)
      } as Investigation;
      repository.save(ready);

      const mechanism = service.continue(ready.investigationId);
      assert.strictEqual(mechanism.presentedStep?.title, "Inspect creation / transition mechanism evidence");
      assert.strictEqual(mechanism.recommendedAction?.tool, "dvqr_acquire_investigation_evidence");
      assert.strictEqual(mechanism.recommendedAction?.arguments.providerId, "mechanism-context");
      assert.strictEqual(mechanism.recommendedAction?.arguments.targetTable, "sample_task");
      assert.strictEqual(mechanism.recommendedAction?.requiredHostArguments?.fromIso?.source, "ExplicitJustifiedEvidenceWindow");
      assert.strictEqual(mechanism.recommendedAction?.requiredHostArguments?.toIso?.source, "ExplicitJustifiedEvidenceWindow");
      assert.match(mechanism.recommendedAction?.reason ?? "", /evidence fingerprint/i);

      const withMechanism = {
        ...repository.get(ready.investigationId)!,
        evidenceRefs: [...repository.get(ready.investigationId)!.evidenceRefs, { evidenceId: "ev-mech", providerId: "mechanism-context", status: "Acquired", acquiredAt: "2026-08-12T00:01:00.000Z", decisionSignals: { pluginTraceState: "Observed" } }],
        managedReadiness: { ...ready.managedReadiness!, isStale: true, staleReason: "New or changed investigation evidence exists since this readiness assessment.", currentEvidenceCount: 4 }
      } as Investigation;
      repository.save(withMechanism);

      const reassess = service.continue(ready.investigationId);
      assert.strictEqual(reassess.presentedStep?.title, "Reassess readiness with mechanism evidence");
      assert.strictEqual(reassess.recommendedAction?.tool, "dvqr_assess_investigation_readiness");
      assert.strictEqual(reassess.statusCard.readinessState, "Stale");
      assert.strictEqual(reassess.statusCard.miniRcaCheckpointState, "StaleAgainstEvidence");
      assert.match(reassess.recommendedAction?.reason ?? "", /do not reacquire Dataverse evidence/i);

      const current = repository.get(ready.investigationId)!;
      const refreshedFingerprint = investigationEvidenceSetFingerprint(current);
      repository.save({
        ...current,
        managedReadiness: { ...current.managedReadiness!, assessmentUtc: "2026-08-12T00:02:00.000Z", evidenceCount: 4, evidenceSetFingerprint: refreshedFingerprint, isStale: false, staleReason: undefined, currentEvidenceCount: undefined }
      } as Investigation);

      const regenerate = service.continue(ready.investigationId);
      assert.strictEqual(regenerate.presentedStep?.title, "Regenerate Mini RCA with mechanism evidence");
      assert.strictEqual(regenerate.recommendedAction?.tool, "dvqr_generate_mini_rca_checkpoint");
      assert.strictEqual(regenerate.statusCard.readinessState, "Current");
      assert.strictEqual(regenerate.statusCard.miniRcaCheckpointState, "StaleAgainstEvidence");
      assert.match(regenerate.recommendedAction?.reason ?? "", /new frozen Mini RCA checkpoint/i);
      assert.match(regenerate.recommendedAction?.reason ?? "", /preserve the earlier checkpoint/i);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });


  test("Pass 10.9.1.1 preserves target and completed runtime step after optional Timeline evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass-10911-monotonic-"));
    try {
      const repository = new WorkspaceInvestigationRepository(root);
      const service = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com", () => new Date("2026-08-12T12:00:00.000Z"));
      const now = "2026-08-12T11:00:00.000Z";
      const base = {
        investigationId: "inv-10911000-0000-4000-8000-000000000001",
        schemaVersion: "dvqr-investigation-v1",
        title: "Completion monotonicity",
        type: "Record",
        status: "ReadyForMiniRca",
        environmentId: "example.crm.dynamics.com",
        subject: { kind: "Record", logicalName: "msemr_careplanactivity", displayLabel: "Care Plan Activity", recordIdMasked: "***3a6a75e8" },
        question: "Investigate downstream sample_task creation",
        createdAt: now, updatedAt: now,
        evidenceRefs: [
          { evidenceId: "ev-meta", providerId: "metadata", status: "Acquired", acquiredAt: now },
          { evidenceId: "ev-rel", providerId: "relationship-context", status: "Acquired", acquiredAt: now },
          { evidenceId: "ev-runtime", providerId: "business-path-runtime", status: "Acquired", acquiredAt: now },
          { evidenceId: "ev-mech", providerId: "mechanism-context", status: "Acquired", acquiredAt: now, decisionSignals: { pluginTraceState: "Observed" } },
          { evidenceId: "ev-plugin", providerId: "plugin-execution-understanding", status: "Acquired", acquiredAt: now }
        ],
        contributorStates: [], miniRcaArtifactRefs: ["mrca-final"], executionRefs: [], reportRefs: [],
        lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" }, limitations: [], staleState: { isStale: false, reasons: [] },
        currentIntent: { intentVersion: 1, leadingDirection: "sample_task", directionLabel: "sample_task", directionLogicalName: "sample_task", reportedProblem: "How did sample_task come to exist?", keywords: [], reason: "confirmed", updatedBy: "User", updatedAt: now }
      } as unknown as Investigation;
      const fp = investigationEvidenceSetFingerprint(base);
      const strategy = buildInvestigationStrategy(base);
      const complete = {
        ...base,
        managedReadiness: { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: base.investigationId, posture: "Conditional", summary: "ready", evidenceCount: 5, providerContributions: [], gaps: [], recommendations: [], baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify", limitations: [], assessmentUtc: now, evidenceSetFingerprint: fp, isStale: false },
        managedMiniRcaCheckpoint: { artifactId: "mrca-final", evidenceSetFingerprint: fp, readinessAssessmentUtc: now, generatedAt: now },
        strategy: { ...strategy, currentStepIndex: strategy.steps.length, steps: strategy.steps.map((step) => ({ ...step, status: "Completed" as const })) }
      } as Investigation;
      repository.save(complete);

      const completed = service.continue(complete.investigationId);
      assert.strictEqual(completed.completion?.state, "InvestigationComplete");
      assert.strictEqual(repository.get(complete.investigationId)?.managedCompletionHistory?.length, 1);
      assert.strictEqual(repository.get(complete.investigationId)?.currentIntent?.directionLogicalName, "sample_task");

      const persisted = repository.get(complete.investigationId)!;
      repository.save({
        ...persisted,
        evidenceRefs: [...persisted.evidenceRefs, { evidenceId: "ev-timeline", providerId: "timeline-context", status: "Acquired", acquiredAt: "2026-08-12T11:10:00.000Z" }],
        managedReadiness: { ...persisted.managedReadiness!, isStale: true, staleReason: "Timeline evidence changed the evidence set.", currentEvidenceCount: 6 }
      } as Investigation);

      const reopened = service.continue(complete.investigationId);
      assert.strictEqual(reopened.investigation.currentIntent?.directionLogicalName, "sample_task");
      assert.strictEqual(reopened.recommendedAction?.tool, "dvqr_assess_investigation_readiness");
      assert.notStrictEqual(reopened.recommendedAction?.arguments.providerId, "runtime-relationship");
      assert.strictEqual(reopened.investigation.strategy?.steps.find((step) => step.order === 4)?.status, "Completed");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

});
