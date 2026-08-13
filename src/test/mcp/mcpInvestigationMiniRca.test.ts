import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { InvestigationMiniRcaService, WorkspaceInvestigationEvidenceRepository, WorkspaceInvestigationMiniRcaRepository, WorkspaceInvestigationRepository } from "../../pro/investigations/index.js";
import type { Investigation } from "../../pro/investigations/investigationContracts.js";
import type { InvestigationEvidence } from "../../pro/investigations/investigationEvidence.js";
import { investigationEvidenceSetFingerprint } from "../../pro/investigations/investigationStrategyReconciler.js";

function investigation(now: string): Investigation {
  const base: Investigation = {
    investigationId: "inv-11111111-1111-1111-1111-111111111111", schemaVersion: "dvqr-investigation-v1", title: "Contact investigation: ***12345678", type: "Record", status: "Active", environmentId: "example.crm.dynamics.com", subject: { kind: "Record", logicalName: "contact", recordIdMasked: "***12345678" }, question: "Investigate Contact ***12345678.", createdAt: now, updatedAt: now,
    evidenceRefs: [
      { evidenceId: "ev-11111111-1111-1111-1111-111111111111", evidenceType: "EntityMetadata", providerId: "metadata", status: "Acquired", summary: "metadata", acquiredAt: now },
      { evidenceId: "ev-22222222-2222-2222-2222-222222222222", evidenceType: "RelationshipContext", providerId: "relationship-context", status: "Acquired", summary: "relationships", acquiredAt: now },
      { evidenceId: "ev-33333333-3333-3333-3333-333333333333", evidenceType: "RuntimeRelationship", providerId: "runtime-relationship", status: "Acquired", summary: "observed", acquiredAt: now }
    ], contributorStates: [], miniRcaArtifactRefs: [], executionRefs: [], reportRefs: [], lineage: { derivedFromArtifactIds: [], createdByCapability: "test" }, limitations: []
  };
  return { ...base, managedReadiness: { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: base.investigationId, posture: "Conditional", summary: "bounded", evidenceCount: 3, providerContributions: [
    { contributorId: "schema-understanding", label: "Schema Understanding", state: "Available" },
    { contributorId: "business-surface-understanding", label: "Business Surface Understanding", state: "Partial" },
    { contributorId: "runtime-relationship-understanding", label: "Runtime Relationship Understanding", state: "Available" }
  ], gaps: [], recommendations: [], baseSynthesizedConfidence: "Low", effectiveSynthesizedConfidence: "Low", confidenceEffect: "Qualify", limitations: [], assessmentUtc: now, evidenceSetFingerprint: investigationEvidenceSetFingerprint(base), latestEvidenceAt: now } };
}
function evidence(id: string, providerId: string, type: string, summary: string, payload: unknown, now: string): InvestigationEvidence { return { evidenceId: id, schemaVersion: "dvqr-investigation-evidence-v1", investigationId: "inv-11111111-1111-1111-1111-111111111111", evidenceType: type, providerId, status: "Acquired", summary, payload, provenance: { providerId, capability: "test", environmentId: "example.crm.dynamics.com", acquiredAt: now, readOnly: true }, limitations: [], recommendations: [] }; }

suite("MCP investigation Mini RCA", () => {
  test("generates a bounded artifact and reuses it for the same evidence set", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-")); const url = "https://example.crm.dynamics.com"; const now = "2026-08-05T00:00:00.000Z";
    const investigations = new WorkspaceInvestigationRepository(root, url); const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, url); investigations.save(investigation(now));
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-33333333-3333-3333-3333-333333333333", "runtime-relationship", "RuntimeRelationship", "observed care plan", { classification: "Observed", requestedTargetTable: "msemr_careplan", observedRowCount: 1, observations: [{ tables: ["contact", "msemr_careplan"], reachedTarget: true, finalTargetRecordCount: 1 }] }, now));
    const service = new InvestigationMiniRcaService(investigations, evidenceRepo, new WorkspaceInvestigationMiniRcaRepository(root, url), () => new Date(now));
    const first = service.generate("inv-11111111-1111-1111-1111-111111111111"); const second = service.generate("inv-11111111-1111-1111-1111-111111111111");
    assert.strictEqual(first.artifact.posture, "Eligible");
    assert.strictEqual(first.artifact.reasoningVersion, "evidence-hypothesis-v1");
    assert.strictEqual(first.artifact.leadingHypothesis?.status, "Supported");
    assert.match(first.artifact.leadingHypothesis?.title ?? "", /careplan/i);
    assert.match(first.artifact.conclusion, /does not establish root cause or causality/i);
    assert.ok(first.artifact.missingEvidence.some((item) => /timeline|audit/i.test(item)));
    assert.strictEqual(second.reusedExisting, true); assert.strictEqual(second.artifact.artifactId, first.artifact.artifactId);
  });
  test("builds bounded hypotheses from observed and empty runtime evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-hypotheses-")); const url = "https://example.crm.dynamics.com"; const now = "2026-08-05T00:00:00.000Z";
    const investigations = new WorkspaceInvestigationRepository(root, url); const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, url);
    const base = investigation(now);
    const emptyRef = { evidenceId: "ev-44444444-4444-4444-4444-444444444444", evidenceType: "RuntimeRelationship", providerId: "runtime-relationship", status: "Acquired", summary: "empty care plan activity", acquiredAt: now } as const;
    const withEmpty = { ...base, evidenceRefs: [...base.evidenceRefs, emptyRef] };
    investigations.save({ ...withEmpty, managedReadiness: { ...withEmpty.managedReadiness!, evidenceCount: 4, evidenceSetFingerprint: investigationEvidenceSetFingerprint(withEmpty) } });
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-33333333-3333-3333-3333-333333333333", "runtime-relationship", "RuntimeRelationship", "observed care plan", { classification: "Observed", requestedTargetTable: "msemr_careplan", observedRowCount: 1, observations: [{ tables: ["contact", "msemr_careplan"], reachedTarget: true, finalTargetRecordCount: 1 }] }, now));
    evidenceRepo.save(evidence("ev-44444444-4444-4444-4444-444444444444", "runtime-relationship", "RuntimeRelationship", "empty care plan activity", { classification: "Empty", requestedTargetTable: "msemr_careplanactivity", observedRowCount: 0, observations: [{ tables: ["contact", "msemr_careplanactivity"], reachedTarget: false, finalTargetRecordCount: 0 }] }, now));
    const artifact = new InvestigationMiniRcaService(investigations, evidenceRepo, new WorkspaceInvestigationMiniRcaRepository(root, url), () => new Date(now)).generate(base.investigationId).artifact;
    assert.ok(artifact.hypotheses.some((item) => item.status === "Supported" && /careplan/i.test(item.title)));
    const activity = artifact.hypotheses.find((item) => /care plan activity|careplanactivity/i.test(item.title));
    assert.ok(activity);
    assert.strictEqual(activity?.status, "Plausible");
    assert.ok(activity?.missingEvidence.some((item) => /multi-hop/i.test(item)));
    assert.doesNotMatch(JSON.stringify(artifact), /root cause is|caused by|most likely cause/i);
  });

  test("keeps empty PluginTrace and AsyncOperation evidence bounded and never turns absence into non-participation", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-mechanism-empty-"));
    const url = "https://example.crm.dynamics.com";
    const now = "2026-08-09T00:00:00.000Z";
    const investigations = new WorkspaceInvestigationRepository(root, url);
    const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, url);
    const artifacts = new WorkspaceInvestigationMiniRcaRepository(root, url);
    const base = investigation(now);
    const mechanismRef = { evidenceId: "ev-66666666-6666-6666-6666-666666666666", evidenceType: "MechanismContext", providerId: "mechanism-context", status: "Acquired", summary: "no mechanism rows observed", acquiredAt: "2026-08-09T00:04:00.000Z", decisionSignals: { pluginTraceState: "Empty" as const } } as const;
    const changed = { ...base, evidenceRefs: [...base.evidenceRefs, mechanismRef] } as Investigation;
    investigations.save({ ...changed, managedReadiness: { ...changed.managedReadiness!, evidenceCount: 4, assessmentUtc: "2026-08-09T00:04:30.000Z", evidenceSetFingerprint: investigationEvidenceSetFingerprint(changed), latestEvidenceAt: "2026-08-09T00:04:00.000Z" } });
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-33333333-3333-3333-3333-333333333333", "runtime-relationship", "RuntimeRelationship", "observed care plan", { classification: "Observed", requestedTargetTable: "bu_task", observedRowCount: 1 }, now));
    evidenceRepo.save(evidence(mechanismRef.evidenceId, "mechanism-context", "MechanismContext", "no mechanism rows observed", {
      targetTable: "bu_task",
      interval: { fromIso: "2026-08-01T00:00:00Z", toIso: "2026-08-09T00:00:00Z" },
      sources: [
        { kind: "Audit", state: "Empty", observedCount: 0, interpretationBoundary: "No matching audit rows observed; bounded absence only." },
        { kind: "AsyncOperation", state: "Empty", observedCount: 0, interpretationBoundary: "No matching async rows observed; bounded absence only." },
        { kind: "PluginTrace", state: "Empty", observedCount: 0, interpretationBoundary: "No matching traces observed; bounded absence only." }
      ],
      timeline: { state: "NotAcquired" },
      evidenceBoundary: "Empty is bounded absence-of-observation evidence only."
    }, "2026-08-09T00:04:00.000Z"));

    const artifact = new InvestigationMiniRcaService(investigations, evidenceRepo, artifacts, () => new Date("2026-08-09T00:05:00.000Z")).generate(base.investigationId).artifact;
    const interpretation = artifact.mechanismInterpretation!;
    assert.strictEqual(interpretation.status, "Unresolved");
    assert.ok(interpretation.notObserved.some((item) => /PluginTrace/i.test(item) && /does not establish/i.test(item)));
    assert.ok(interpretation.notObserved.some((item) => /AsyncOperation/i.test(item) && /does not establish/i.test(item)));
    assert.match(interpretation.remainingUncertainty, /Empty or Unavailable evidence does not establish non-participation/i);
    assert.match(interpretation.causalBoundary, /not that no mechanism ran/i);
    assert.strictEqual(interpretation.nextBestInvestigation.evidenceSource, "Timeline");
    const text = JSON.stringify(artifact);
    assert.doesNotMatch(text, /the plug-in did not run|the plugin did not run|the workflow did not run|was not created by a.*plug-in|was not created by.*workflow/i);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("reuses an artifact after readiness is reassessed without evidence changes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-stable-readiness-")); const url = "https://example.crm.dynamics.com"; const now = "2026-08-05T00:00:00.000Z";
    const investigations = new WorkspaceInvestigationRepository(root, url); const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, url); const value = investigation(now); investigations.save(value);
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-33333333-3333-3333-3333-333333333333", "runtime-relationship", "RuntimeRelationship", "observed care plan", { classification: "Observed", requestedTargetTable: "msemr_careplan", observedRowCount: 1 }, now));
    const service = new InvestigationMiniRcaService(investigations, evidenceRepo, new WorkspaceInvestigationMiniRcaRepository(root, url), () => new Date(now));
    const first = service.generate(value.investigationId);
    assert.strictEqual(first.investigation.investigationPlan?.recommendedNextAction.tool, "dvqr_acquire_mechanism_context");
    assert.match(first.investigation.investigationPlan?.recommendedNextAction.reason ?? "", /first Mini RCA checkpoint.*mechanism-context/i);
    const saved = investigations.get(value.investigationId)!;
    investigations.save({ ...saved, managedReadiness: { ...saved.managedReadiness!, assessmentUtc: "2026-08-05T00:05:00.000Z" } });
    const second = service.generate(value.investigationId);
    assert.strictEqual(second.reusedExisting, true);
    assert.strictEqual(second.artifact.artifactId, first.artifact.artifactId);
  });

  test("explicitly regenerates a new frozen artifact after mechanism evidence is reassessed", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-mechanism-refresh-"));
    const url = "https://example.crm.dynamics.com";
    const now = "2026-08-09T00:00:00.000Z";
    const investigations = new WorkspaceInvestigationRepository(root, url);
    const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, url);
    const artifacts = new WorkspaceInvestigationMiniRcaRepository(root, url);
    const base = investigation(now);
    investigations.save(base);
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-33333333-3333-3333-3333-333333333333", "runtime-relationship", "RuntimeRelationship", "observed care plan", { classification: "Observed", requestedTargetTable: "msemr_careplanactivity", observedRowCount: 1 }, now));
    let generation = 0;
    const service = new InvestigationMiniRcaService(investigations, evidenceRepo, artifacts, () => new Date(generation++ === 0 ? "2026-08-09T00:03:00.000Z" : "2026-08-09T00:05:00.000Z"));
    const first = service.generate(base.investigationId);

    const mechanismRef = { evidenceId: "ev-55555555-5555-5555-5555-555555555555", evidenceType: "MechanismContext", providerId: "mechanism-context", status: "Acquired", summary: "mechanism context", acquiredAt: "2026-08-09T00:04:00.000Z", decisionSignals: { pluginTraceState: "Observed" as const } } as const;
    evidenceRepo.save(evidence("ev-55555555-5555-5555-5555-555555555555", "mechanism-context", "MechanismContext", "mechanism context", {
      targetTable: "msemr_careplanactivity",
      interval: { fromIso: "2026-08-01T00:00:00Z", toIso: "2026-08-09T00:00:00Z" },
      sources: [
        { kind: "Audit", state: "Unavailable", observedCount: 0 },
        { kind: "AsyncOperation", state: "Empty", observedCount: 0 },
        { kind: "PluginTrace", state: "Observed", observedCount: 12, summary: "12 bounded traces" }
      ],
      timeline: { state: "NotAcquired" },
      evidenceBoundary: "Participation only; not causality."
    }, "2026-08-09T00:04:00.000Z"));
    const afterFirst = investigations.get(base.investigationId)!;
    const changed = { ...afterFirst, evidenceRefs: [...afterFirst.evidenceRefs, mechanismRef], contributorStates: [...afterFirst.contributorStates, { contributorId: "mechanism-evidence-understanding", label: "Creation / Transition Mechanism Evidence", state: "Available" }] } as Investigation;
    const refreshed = { ...changed, managedReadiness: { ...changed.managedReadiness!, evidenceCount: 4, providerContributions: [...changed.managedReadiness!.providerContributions, { contributorId: "mechanism-evidence-understanding", label: "Creation / Transition Mechanism Evidence", state: "Available" }], assessmentUtc: "2026-08-09T00:04:30.000Z", evidenceSetFingerprint: investigationEvidenceSetFingerprint(changed), latestEvidenceAt: "2026-08-09T00:04:00.000Z", isStale: undefined, staleReason: undefined, currentEvidenceCount: undefined } } as Investigation;
    investigations.save(refreshed);

    const second = service.generate(base.investigationId);
    assert.strictEqual(second.reusedExisting, false);
    assert.notStrictEqual(second.artifact.artifactId, first.artifact.artifactId);
    assert.strictEqual(second.artifact.evidenceSummary.length, 4);
    assert.strictEqual(second.artifact.mechanismContext?.targetTable, "msemr_careplanactivity");
    assert.strictEqual(second.artifact.mechanismContext?.sources.find((item) => item.kind === "Audit")?.state, "Unavailable");
    assert.strictEqual(second.artifact.mechanismContext?.sources.find((item) => item.kind === "AsyncOperation")?.state, "Empty");
    assert.strictEqual(second.artifact.mechanismContext?.sources.find((item) => item.kind === "PluginTrace")?.observedCount, 12);
    assert.strictEqual(second.artifact.mechanismContext?.timelineState, "NotAcquired");
    assert.strictEqual(second.artifact.mechanismInterpretation?.status, "Unresolved");
    assert.ok(second.artifact.mechanismInterpretation?.supportedObservations.some((item) => /PluginTrace activity is observed/i.test(item)));
    assert.ok(second.artifact.mechanismInterpretation?.notObserved.some((item) => /AsyncOperation/i.test(item)));
    assert.ok(second.artifact.mechanismInterpretation?.unavailable.some((item) => /Audit/i.test(item)));
    assert.ok(second.artifact.mechanismInterpretation?.notAcquired.some((item) => /Timeline/i.test(item)));
    assert.strictEqual(second.artifact.mechanismInterpretation?.nextBestInvestigation.evidenceSource, "PluginExecutionUnderstanding");
    assert.strictEqual(second.artifact.mechanismInterpretation?.nextBestInvestigation.handoff?.capabilityId, "PluginExecutionUnderstanding");
    assert.strictEqual(second.artifact.mechanismInterpretation?.nextBestInvestigation.handoff?.executionStatus, "RecommendedNotExecutable");
    assert.strictEqual(second.artifact.mechanismInterpretation?.nextBestInvestigation.handoff?.prerequisiteEvidenceId, mechanismRef.evidenceId);
    assert.strictEqual(second.artifact.mechanismInterpretation?.nextBestInvestigation.handoff?.targetTable, "msemr_careplanactivity");
    assert.match(second.artifact.mechanismInterpretation?.nextBestInvestigation.informationGainBoundary ?? "", /strongly discriminate/i);
    assert.match(second.artifact.mechanismInterpretation?.nextBestInvestigation.informationGainBoundary ?? "", /does not.*prove/i);
    assert.match(second.artifact.mechanismInterpretation?.causalBoundary ?? "", /not proof of causality/i);
    assert.match(second.artifact.mostValuableNextStep?.action ?? "", /plug-in execution surface/i);
    assert.strictEqual(second.artifact.suggestedFollowUps?.[0]?.followUpId, "mechanism-next-best");
    assert.ok(!second.artifact.suggestedFollowUps?.some((item) => item.followUpId === "verify-business-path"));
    assert.ok(!second.artifact.suggestedFollowUps?.some((item) => item.followUpId === "test-leading-hypothesis"));
    assert.ok(second.artifact.suggestedFollowUps?.some((item) => item.followUpId === "acquire-timeline"));
    assert.ok(second.artifact.suggestedFollowUps?.some((item) => item.followUpId === "resolve-audit-access"));
    assert.match(second.artifact.nextActions[0] ?? "", /plug-in execution surface/i);
    assert.ok(!second.artifact.nextActions.some((item) => /verify.*path|multi-hop route/i.test(item)));
    assert.ok(!second.artifact.nextActions.some((item) => /repeat.*Audit/i.test(item)));
    assert.ok(second.artifact.nextActions.some((item) => /Resolve the Audit access limitation/i.test(item)));
    assert.ok(second.artifact.findings.some((item) => /Mechanism source PluginTrace: Observed \(12 bounded observations\)/i.test(item)));
    assert.match(second.artifact.limitations.join(" "), /does not prove which mechanism/i);
    assert.strictEqual(second.investigation.miniRcaArtifactRefs.length, 2);
    assert.strictEqual(second.investigation.managedMiniRcaCheckpoint?.artifactId, second.artifact.artifactId);
    assert.strictEqual(second.investigation.managedMiniRcaCheckpoint?.evidenceSetFingerprint, refreshed.managedReadiness?.evidenceSetFingerprint);
    assert.strictEqual(second.investigation.strategy?.steps.find((step) => step.title === "Regenerate Mini RCA with mechanism evidence")?.status, "Completed");
    assert.strictEqual(second.investigation.investigationPlan?.recommendedNextAction.tool, "dvqr_acquire_investigation_evidence");
    assert.match(second.investigation.investigationPlan?.recommendedNextAction.reason ?? "", /PluginTrace is Observed.*deterministic follow-on/i);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("rejects generation when readiness is stale", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-stale-")); const url = "https://example.crm.dynamics.com"; const now = "2026-08-05T00:00:00.000Z"; const repo = new WorkspaceInvestigationRepository(root, url); const value = investigation(now); repo.save({ ...value, managedReadiness: { ...value.managedReadiness!, evidenceSetFingerprint: "stale" } });
    const service = new InvestigationMiniRcaService(repo, new WorkspaceInvestigationEvidenceRepository(root, url), new WorkspaceInvestigationMiniRcaRepository(root, url));
    assert.throws(() => service.generate(value.investigationId), /readiness is stale/i);
  });
});

suite("MCP intent-driven Mini RCA", () => {
  test("persists intent and returns goal-aware correlations and follow-ups", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mini-rca-intent-")); const url = "https://example.crm.dynamics.com"; const now = "2026-08-05T00:00:00.000Z";
    const investigations = new WorkspaceInvestigationRepository(root, url); const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, url);
    const base = investigation(now);
    investigations.save({ ...base, currentIntent: { intentVersion: 1, leadingDirection: "CarePlanActivity", directionLabel: "Care Plan Activity", reportedProblem: "Care Plan Activity never appeared.", keywords: ["care", "plan", "activity"], reason: "Initial investigator intent.", updatedBy: "User", updatedAt: now }, intentHistory: [] });
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-33333333-3333-3333-3333-333333333333", "runtime-relationship", "RuntimeRelationship", "observed care plan", { classification: "Observed", requestedTargetTable: "msemr_careplan", observedRowCount: 1 }, now));
    const artifact = new InvestigationMiniRcaService(investigations, evidenceRepo, new WorkspaceInvestigationMiniRcaRepository(root, url), () => new Date(now)).generate(base.investigationId).artifact;
    assert.strictEqual(artifact.reasoningMode, "IntentDriven");
    assert.strictEqual(artifact.intent?.reportedProblem, "Care Plan Activity never appeared.");
    assert.ok(artifact.hypotheses.some((item) => /Care Plan Activity/i.test(item.title)));
    assert.ok((artifact.suggestedFollowUps?.length ?? 0) >= 4);
    assert.ok(artifact.suggestedFollowUps?.some((item) => item.kind === "Custom"));
    assert.ok(artifact.mostValuableNextStep?.expectedInformationGain === "VeryHigh");
  });
  test("accepts path-aware runtime evidence as the managed runtime prerequisite", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mrca-path-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const evidenceRepo = new WorkspaceInvestigationEvidenceRepository(root, environmentUrl);
    const artifacts = new WorkspaceInvestigationMiniRcaRepository(root, environmentUrl);
    const now = "2026-08-08T00:00:00.000Z";
    const base = investigation(now);
    const pathRef = { evidenceId: "ev-55555555-5555-5555-5555-555555555555", evidenceType: "BusinessPathRuntime", providerId: "business-path-runtime", status: "Acquired", summary: "runtime-preferred care plan path", acquiredAt: now } as const;
    const changed = { ...base, evidenceRefs: [...base.evidenceRefs.slice(0, 2), pathRef], contributorStates: base.contributorStates };
    const pathInvestigation = { ...changed, managedReadiness: { ...changed.managedReadiness!, evidenceCount: 3, evidenceSetFingerprint: investigationEvidenceSetFingerprint(changed) } };
    investigations.save(pathInvestigation as any);
    evidenceRepo.save(evidence("ev-11111111-1111-1111-1111-111111111111", "metadata", "EntityMetadata", "metadata", {}, now));
    evidenceRepo.save(evidence("ev-22222222-2222-2222-2222-222222222222", "relationship-context", "RelationshipContext", "relationships", {}, now));
    evidenceRepo.save(evidence("ev-55555555-5555-5555-5555-555555555555", "business-path-runtime", "BusinessPathRuntime", "runtime-preferred care plan path", { targetTable: "msemr_careplanactivity", preferredPath: { tables: ["contact", "msemr_careplan", "msemr_careplanactivity"], observedTargetRecordCount: 3, runtimeStatus: "RuntimeViable" }, validatedPaths: [] }, now));
    const service = new InvestigationMiniRcaService(investigations, evidenceRepo, artifacts, () => new Date(now));
    const generated = service.generate(pathInvestigation.investigationId);
    assert.ok(generated.artifact.strongestRuntimeObservation);
    assert.strictEqual(generated.artifact.strongestRuntimeObservation?.targetTable, "msemr_careplanactivity");
    assert.strictEqual(generated.artifact.strongestRuntimeObservation?.observedRowCount, 3);
  });

});
