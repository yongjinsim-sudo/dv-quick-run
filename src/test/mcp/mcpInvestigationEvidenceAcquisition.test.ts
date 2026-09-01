import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { InvestigationApplicationService } from "../../pro/investigations/investigationApplicationService.js";
import { InvestigationEvidenceAcquisitionService } from "../../pro/investigations/investigationEvidenceAcquisitionService.js";
import { InvestigationEvidenceIntelligenceService } from "../../pro/investigations/investigationEvidenceIntelligence.js";
import { InvestigationEvidenceProviderRegistry, MetadataInvestigationEvidenceProvider, RelationshipContextInvestigationEvidenceProvider, RuntimeRelationshipInvestigationEvidenceProvider, BusinessPathRuntimeInvestigationEvidenceProvider, MechanismContextInvestigationEvidenceProvider } from "../../pro/investigations/investigationEvidenceProvider.js";
import { WorkspaceInvestigationEvidenceRepository } from "../../pro/investigations/investigationEvidenceRepository.js";
import { WorkspaceInvestigationJournalRepository } from "../../pro/investigations/investigationJournal.js";
import { WorkspaceInvestigationRepository } from "../../pro/investigations/investigationRepository.js";

suite("mcpInvestigationEvidenceAcquisition", () => {
  test("persists exactly one metadata evidence artifact and journal entry", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass4-"));
    const investigations = new WorkspaceInvestigationRepository(root);
    const application = new InvestigationApplicationService(investigations, "https://example.crm.dynamics.com", () => new Date("2026-08-04T00:00:00.000Z"));
    const investigation = application.start({ question: "Investigate contact", subject: { table: "contact" } });
    const evidenceRepository = new WorkspaceInvestigationEvidenceRepository(root);
    const acquisition = new InvestigationEvidenceAcquisitionService(
      investigations,
      evidenceRepository,
      new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider()]),
      new WorkspaceInvestigationJournalRepository(root),
      () => new Date("2026-08-04T00:01:00.000Z")
    );

    const result = acquisition.record({
      investigationId: investigation.investigationId,
      providerId: "metadata",
      rawResult: { ok: true, summary: "Metadata retrieved for contact.", structuredContent: { entity: { LogicalName: "contact", PrimaryIdAttribute: "contactid" } } }
    });

    assert.strictEqual(result.oneProviderOnly, true);
    assert.strictEqual(result.evidence.status, "Acquired");
    assert.strictEqual(result.evidence.providerId, "metadata");
    assert.strictEqual(result.investigation.evidenceRefs.length, 1);
    assert.ok(result.evidence.recommendations.some((item) => /relationship-context evidence/i.test(item)));
    assert.strictEqual(evidenceRepository.list(investigation.investigationId).length, 1);
    const journalPath = path.join(root, ".dvforgelab", "dvqr", "investigations", "journal", `${investigation.investigationId}.jsonl`);
    assert.strictEqual(fs.existsSync(journalPath), true);
    assert.strictEqual(fs.readFileSync(journalPath, "utf8").trim().split(/\r?\n/).length, 1);
  });

  test("refuses unsupported providers without writing evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass4-"));
    const investigations = new WorkspaceInvestigationRepository(root);
    const investigation = new InvestigationApplicationService(investigations, "https://example.crm.dynamics.com").start({ question: "Investigate contact", subject: { table: "contact" } });
    const evidenceRepository = new WorkspaceInvestigationEvidenceRepository(root);
    const acquisition = new InvestigationEvidenceAcquisitionService(investigations, evidenceRepository, new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider()]), new WorkspaceInvestigationJournalRepository(root));
    assert.throws(() => acquisition.record({ investigationId: investigation.investigationId, providerId: "relationships", rawResult: {} }), /provider was not found/i);
    assert.strictEqual(evidenceRepository.list(investigation.investigationId).length, 0);
  });

  test("stores only the bounded entity payload from metadata results", () => {
    const provider = new MetadataInvestigationEvidenceProvider();
    const result = provider.normalize(
      { ok: true, summary: "ok", structuredContent: { environmentUrl: "https://secret.example", transport: { token: "not-persisted" }, entity: { LogicalName: "contact" } } },
      { investigation: { subject: { logicalName: "contact" } } as never, acquiredAt: "2026-08-04T00:00:00.000Z" }
    );
    assert.deepStrictEqual(result.payload, { entity: { LogicalName: "contact" } });
  });

  test("persists and deduplicates bounded relationship-context evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass5-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const investigation = new InvestigationApplicationService(investigations, environmentUrl).start({ question: "Investigate contact", subject: { table: "contact" } });
    const evidenceRepository = new WorkspaceInvestigationEvidenceRepository(root, environmentUrl);
    const journal = new WorkspaceInvestigationJournalRepository(root, environmentUrl);
    const acquisition = new InvestigationEvidenceAcquisitionService(
      investigations,
      evidenceRepository,
      new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider(), new RelationshipContextInvestigationEvidenceProvider()]),
      journal,
      () => new Date("2026-08-04T00:02:00.000Z")
    );
    const rawResult = {
      ok: true,
      summary: "Top metadata-derived operational anchor: msemr_encounter (100/100).",
      structuredContent: {
        contractVersion: "dvqr-mcp-business-capability-understanding-v3",
        sourceTable: "contact",
        searchBounds: { maxDepth: 3, maxResults: 8, maxTablesInspected: 60 },
        discoveryCoverage: { tablesInspected: 60, graphEdgesInspected: 4311, explorationComplete: false },
        investigationSummary: { primaryOperationalAnchor: "msemr_encounter", evidencePosture: "MetadataDerivedRuntimeUnverified" },
        capabilityLandscape: [{ layer: "Execution" }],
        architecturalConclusions: [{ title: "Primary Operational Anchor", subject: "msemr_encounter", runtimeStatus: "NotProbed" }],
        recommendedAnchor: { logicalName: "msemr_encounter", score: 100 },
        operationalAnchors: Array.from({ length: 12 }, (_, index) => ({ logicalName: `anchor_${index}` })),
        supportingAnchors: [],
        downstreamWorkItems: []
      }
    };

    const first = acquisition.record({ investigationId: investigation.investigationId, providerId: "relationship-context", rawResult });
    const second = acquisition.record({ investigationId: investigation.investigationId, providerId: "relationship-context", rawResult });

    assert.strictEqual(first.evidence.evidenceType, "RelationshipContext");
    assert.strictEqual(first.evidence.providerId, "relationship-context");
    assert.strictEqual(first.reusedExisting, false);
    assert.strictEqual(second.reusedExisting, true);
    assert.strictEqual(second.evidence.evidenceId, first.evidence.evidenceId);
    assert.strictEqual(evidenceRepository.list(investigation.investigationId).length, 1);
    const payload = first.evidence.payload as { operationalAnchors: unknown[]; investigationSummary: { evidencePosture: string } };
    assert.strictEqual(payload.operationalAnchors.length, 8);
    assert.strictEqual(payload.investigationSummary.evidencePosture, "MetadataDerivedRuntimeUnverified");
    assert.ok(first.evidence.limitations.some((item) => /does not prove runtime participation/i.test(item)));
    const persisted = investigations.get(investigation.investigationId)!;
    assert.ok((persisted.contributorStates as Array<{ contributorId?: string }>).some((item) => item.contributorId === "business-surface-understanding"));
  });

  test("relationship-context provider excludes unbounded and transport fields", () => {
    const provider = new RelationshipContextInvestigationEvidenceProvider();
    const result = provider.normalize(
      { ok: true, summary: "ok", structuredContent: { sourceTable: "contact", environmentUrl: "https://secret.example", transport: { token: "not-persisted" }, operationalAnchors: [{ logicalName: "account" }] } },
      { investigation: { subject: { logicalName: "contact" } } as never, acquiredAt: "2026-08-04T00:00:00.000Z" }
    );
    const payload = result.payload as Record<string, unknown>;
    assert.strictEqual("environmentUrl" in payload, false);
    assert.strictEqual("transport" in payload, false);
    assert.deepStrictEqual(payload.operationalAnchors, [{ logicalName: "account" }]);
  });


  test("normalizes bounded runtime relationship observations without raw identifiers or transport", () => {
    const provider = new RuntimeRelationshipInvestigationEvidenceProvider();
    const result = provider.normalize(
      {
        ok: true,
        summary: "Observed one target row.",
        structuredContent: {
          sourceTable: "contact",
          requestedTargetTable: "msemr_encounter",
          sourceRecordId: "11111111-1111-4111-8111-111111111111",
          runtimeRecommendation: { finalTargetRecordCount: 1 },
          runtimeEvidence: { observations: [{ pathId: "p1", tables: ["contact", "msemr_encounter"], targetTable: "msemr_encounter", reachedTarget: true, completedHops: 1, finalTargetRecordCount: 1 }] },
          probeResults: [{ finalTargetRecordIds: ["22222222-2222-4222-8222-222222222222"], steps: [{ query: "contacts(...)" }], transport: { token: "not-persisted" } }],
          bounds: { maxProbeRequests: 8 }
        }
      },
      { investigation: { subject: { logicalName: "contact" } } as never, acquiredAt: "2026-08-04T00:00:00.000Z" }
    );
    const payload = result.payload as Record<string, unknown>;
    assert.strictEqual(payload.classification, "Observed");
    assert.strictEqual(payload.sourceRecordIdMasked, "***11111111");
    assert.deepStrictEqual(payload.sampledTargetIds, ["***22222222"]);
    assert.strictEqual(JSON.stringify(payload).includes("contacts(...)"), false);
    assert.strictEqual(JSON.stringify(payload).includes("not-persisted"), false);
    assert.ok(result.contributorMappings?.some((item) => item.contributorId === "runtime-relationship-understanding" && item.state === "Available"));
  });

  test("classifies a completed no-row runtime probe as Empty rather than invalid metadata", () => {
    const provider = new RuntimeRelationshipInvestigationEvidenceProvider();
    const result = provider.normalize(
      { ok: true, summary: "No target rows observed.", structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_encounter", runtimeEvidence: { observations: [{ reachedTarget: false, finalTargetRecordCount: 0 }] }, probeResults: [], bounds: {} } },
      { investigation: { subject: { logicalName: "contact" } } as never, acquiredAt: "2026-08-04T00:00:00.000Z" }
    );
    assert.strictEqual((result.payload as { classification: string }).classification, "Empty");
    assert.strictEqual(result.status, "Acquired");
    assert.ok(result.limitations.some((item) => /does not invalidate metadata/i.test(item)));
  });


  test("normalizes a bounded ranked-anchor probe and stops on the observed surface", () => {
    const provider = new RuntimeRelationshipInvestigationEvidenceProvider();
    const result = provider.normalize(
      {
        ok: true,
        structuredContent: {
          sourceTable: "contact",
          sourceRecordId: "11111111-1111-4111-8111-111111111111",
          multiAnchorProbes: [
            { targetTable: "msemr_encounter", result: { ok: true, summary: "empty", structuredContent: { runtimeEvidence: { observations: [{ reachedTarget: false, finalTargetRecordCount: 0 }] } } } },
            { targetTable: "msemr_careplan", result: { ok: true, summary: "observed", structuredContent: { runtimeRecommendation: { finalTargetRecordCount: 2 }, runtimeEvidence: { observations: [{ reachedTarget: true, finalTargetRecordCount: 2 }] } } } }
          ],
          bounds: { maxAnchors: 3, stopOnObserved: true }
        }
      },
      { investigation: { subject: { logicalName: "contact" } } as never, acquiredAt: "2026-08-05T00:00:00.000Z" }
    );
    const payload = result.payload as { classification: string; anchorProbeCount: number; stopReason: string; anchorProbes: Array<{ targetTable?: string; classification: string }> };
    assert.strictEqual(payload.classification, "Observed");
    assert.strictEqual(payload.anchorProbeCount, 2);
    assert.strictEqual(payload.stopReason, "Observed");
    assert.deepStrictEqual(payload.anchorProbes.map((item) => [item.targetTable, item.classification]), [["msemr_encounter", "Empty"], ["msemr_careplan", "Observed"]]);
  });

  test("runtime evidence completes the record runtime step and managed readiness advances to the next step", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass62-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const application = new InvestigationApplicationService(investigations, environmentUrl, () => new Date("2026-08-05T00:00:00.000Z"));
    const investigation = application.start({ question: "Investigate contact record", type: "Record", subject: { kind: "Record", table: "contact", recordId: "11111111-1111-4111-8111-111111111111" } });
    const acquisition = new InvestigationEvidenceAcquisitionService(
      investigations,
      new WorkspaceInvestigationEvidenceRepository(root, environmentUrl),
      new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider(), new RelationshipContextInvestigationEvidenceProvider(), new RuntimeRelationshipInvestigationEvidenceProvider()]),
      new WorkspaceInvestigationJournalRepository(root, environmentUrl),
      () => new Date("2026-08-05T00:01:00.000Z")
    );
    acquisition.record({ investigationId: investigation.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
    acquisition.record({ investigationId: investigation.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact", recommendedAnchor: { logicalName: "msemr_encounter" }, operationalAnchors: [] } } });
    const runtime = acquisition.record({ investigationId: investigation.investigationId, providerId: "runtime-relationship", rawResult: { ok: true, structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_encounter", runtimeEvidence: { observations: [{ reachedTarget: false, finalTargetRecordCount: 0 }] } } } });
    assert.strictEqual(runtime.investigation.strategy?.steps[3].status, "Completed");
    assert.strictEqual(runtime.investigation.strategy?.steps[runtime.investigation.strategy.currentStepIndex].title, "Assess investigation readiness");

    const readiness = new InvestigationEvidenceIntelligenceService(investigations, () => new Date("2026-08-05T00:02:00.000Z")).assessManaged(investigation.investigationId);
    assert.strictEqual(readiness.contractVersion, "dvqr-managed-investigation-readiness-v1");
    assert.strictEqual(readiness.posture, "Limited");
    assert.ok(readiness.gaps.some((gap) => /runtime probes are empty/i.test(gap.title)));
    assert.ok(investigations.get(investigation.investigationId)?.managedReadiness);
  });

  test("keeps an observed runtime contribution available after later empty evidence and makes readiness stale", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass63-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const application = new InvestigationApplicationService(investigations, environmentUrl, () => new Date("2026-08-05T00:00:00.000Z"));
    const investigation = application.start({ question: "Investigate contact record", type: "Record", subject: { kind: "Record", table: "contact", recordId: "11111111-1111-4111-8111-111111111111" } });
    const acquisition = new InvestigationEvidenceAcquisitionService(investigations, new WorkspaceInvestigationEvidenceRepository(root, environmentUrl), new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider(), new RelationshipContextInvestigationEvidenceProvider(), new RuntimeRelationshipInvestigationEvidenceProvider()]), new WorkspaceInvestigationJournalRepository(root, environmentUrl), () => new Date("2026-08-05T00:01:00.000Z"));
    acquisition.record({ investigationId: investigation.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
    acquisition.record({ investigationId: investigation.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact", recommendedAnchor: { logicalName: "msemr_encounter" }, operationalAnchors: [] } } });
    acquisition.record({ investigationId: investigation.investigationId, providerId: "runtime-relationship", rawResult: { ok: true, structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_encounter", runtimeRecommendation: { finalTargetRecordCount: 2 }, runtimeEvidence: { observations: [{ reachedTarget: true, finalTargetRecordCount: 2 }] } } } });
    const intelligence = new InvestigationEvidenceIntelligenceService(investigations, () => new Date("2026-08-05T00:02:00.000Z"));
    intelligence.assessManaged(investigation.investigationId);
    acquisition.record({ investigationId: investigation.investigationId, providerId: "runtime-relationship", rawResult: { ok: true, structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_careplan", runtimeEvidence: { observations: [{ reachedTarget: false, finalTargetRecordCount: 0 }] } } } });
    const loaded = investigations.get(investigation.investigationId)!;
    const runtime = (loaded.contributorStates as Array<{ contributorId: string; state: string }>).find((item) => item.contributorId === "runtime-relationship-understanding");
    assert.strictEqual(runtime?.state, "Available");
    assert.strictEqual(loaded.strategy?.steps[4].status, "Current");
    const readiness = intelligence.getReadiness(investigation.investigationId) as { isStale?: boolean; currentEvidenceCount?: number };
    assert.strictEqual(readiness.isStale, true);
    assert.strictEqual(readiness.currentEvidenceCount, 4);
  });

  test("normalizes path-aware runtime validation as bounded investigation evidence", () => {
    const provider = new BusinessPathRuntimeInvestigationEvidenceProvider();
    const result = provider.normalize(
      {
        ok: true,
        summary: "Runtime validation observed a viable business path.",
        structuredContent: {
          sourceTable: "contact",
          targetTable: "msemr_careplanactivity",
          validationMode: "BoundedHopByHopRuntimeValidation",
          rankingBasis: "RuntimeViabilityFirstThenBusinessMetadataScore",
          metadataSource: "Fresh",
          runtimePreferredPath: {
            pathId: "patient-careplan",
            tables: ["contact", "msemr_careplan", "msemr_careplanactivity"],
            metadataBusinessScore: 100,
            runtimeStatus: "RuntimeViable",
            observedTargetRecordCount: 3,
            targetObservationBound: 3,
            targetCountBoundary: "AtLimit",
            businessPreferred: "RuntimePreferred",
            routeSemantics: "MultiHopBusinessTraversalCandidate",
            businessAuthority: "AssertedBusinessTraversal"
          },
          businessPreferredTraversal: {
            pathId: "patient-careplan",
            tables: ["contact", "msemr_careplan", "msemr_careplanactivity"],
            runtimeStatus: "RuntimeViable",
            observedTargetRecordCount: 3,
            targetObservationBound: 3,
            targetCountBoundary: "AtLimit",
            routeSemantics: "MultiHopBusinessTraversalCandidate",
            businessAuthority: "AssertedBusinessTraversal"
          },
          assertedBusinessTraversal: {
            tables: ["contact", "msemr_careplan", "msemr_careplanactivity"],
            metadataResolution: "ResolvedCandidate",
            runtimeStatus: "RuntimeViable",
            reachedTarget: true,
            pathId: "patient-careplan",
            interpretation: "The asserted traversal was runtime validated."
          },
          validatedPaths: [
            { pathId: "patient-careplan", tables: ["contact", "msemr_careplan", "msemr_careplanactivity"], metadataBusinessScore: 100, metadataAssessment: "StrongCandidate", runtimeStatus: "RuntimeViable", reachedTarget: true, completedHops: 2, totalHops: 2, observedTargetRecordCount: 3, targetObservationBound: 3, targetCountBoundary: "AtLimit", businessPreferred: "RuntimePreferred" },
            { pathId: "activity-goal", tables: ["contact", "msemr_careplanactivitygoal", "msemr_careplanactivity"], metadataBusinessScore: 79, metadataAssessment: "StrongCandidate", runtimeStatus: "AccessLimited", reachedTarget: false, completedHops: 0, totalHops: 2, breakHop: 1, breakFromTable: "contact", breakToTable: "msemr_careplanactivitygoal", businessPreferred: "Indeterminate" }
          ],
          validationSummary: { candidatesSelectedForRuntime: 2, pathsActuallyProbed: 2, runtimeViablePaths: 1, emptyPaths: 0, accessLimitedPaths: 1, executionFailedPaths: 0, notTestedPaths: 0 },
          bounds: { maxDepth: 5, maxCandidates: 8, maxRecordsPerStep: 3, maxProbeRequests: 30 },
          sourceRecordId: "11111111-1111-4111-8111-111111111111",
          transport: { token: "must-not-persist" }
        }
      },
      { investigation: { subject: { logicalName: "contact" } } as never, acquiredAt: "2026-08-08T00:00:00.000Z" }
    );
    assert.strictEqual(result.evidenceType, "BusinessPathRuntime");
    assert.strictEqual(result.status, "Acquired");
    const payload = result.payload as any;
    assert.strictEqual(payload.preferredPath.businessPreferred, "RuntimePreferred");
    assert.strictEqual(payload.preferredPath.targetCountBoundary, "AtLimit");
    assert.match(payload.preferredPath.pathObservationSemantics, /at least/i);
    assert.strictEqual(payload.businessPreferredTraversal.businessAuthority, "AssertedBusinessTraversal");
    assert.deepStrictEqual(payload.businessPreferredTraversal.tables, ["contact", "msemr_careplan", "msemr_careplanactivity"]);
    assert.strictEqual(payload.assertedBusinessTraversal.metadataResolution, "ResolvedCandidate");
    assert.strictEqual(payload.evidencePosture, "BusinessPreferredTraversalObserved");
    assert.strictEqual(payload.validatedPaths[1].runtimeStatus, "AccessLimited");
    assert.strictEqual("sourceRecordId" in payload, false);
    assert.strictEqual("transport" in payload, false);
    assert.ok(result.contributorMappings?.some((item) => item.contributorId === "runtime-relationship-understanding" && item.state === "Available"));
    assert.ok(result.limitations.some((item) => /BelowLimit.*does not prove/i.test(item)));
  });


  test("normalizes bounded mechanism context without raw execution identifiers or sensitive payloads", () => {
    const provider = new MechanismContextInvestigationEvidenceProvider();
    const result = provider.normalize({
      ok: true,
      structuredContent: {
        targetTable: "msemr_careplanactivity",
        interval: { fromIso: "2026-08-01T00:00:00Z", toIso: "2026-08-02T00:00:00Z" },
        audit: { ok: true, structuredContent: { data: { value: [
          { auditid: "11111111-1111-1111-1111-111111111111", createdon: "2026-08-01T01:00:00Z", objecttypecode: "msemr_careplanactivity", _objectid_value: "22222222-2222-2222-2222-222222222222", _userid_value: "33333333-3333-3333-3333-333333333333", changedata: "SECRET" },
          { auditid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", createdon: "2026-08-01T01:00:00Z", objecttypecode: "account" }
        ] } } },
        asyncOperations: { ok: true, structuredContent: { data: { value: [
          { asyncoperationid: "44444444-4444-4444-4444-444444444444", name: "Create activity", primaryentitytype: "msemr_careplanactivity", createdon: "2026-08-01T01:01:00Z", correlationid: "55555555-5555-5555-5555-555555555555" }
        ] } } },
        pluginTrace: { ok: false, code: "ExecutionFailed", message: "Access denied" }
      }
    }, { investigation: { subject: { kind: "Record", logicalName: "contact" }, currentIntent: { directionLogicalName: "msemr_careplanactivity" } } as never, acquiredAt: "2026-08-02T00:00:00Z" });

    assert.strictEqual(result.status, "Acquired");
    assert.match(result.summary, /2 evidence sources/i);
    const payload = result.payload as any;
    assert.strictEqual(payload.targetTable, "msemr_careplanactivity");
    assert.strictEqual(payload.timeline.state, "NotAcquired");
    assert.strictEqual(payload.sources[0].observedCount, 1, "unrelated audit rows must be filtered locally");
    assert.strictEqual(payload.sources[2].state, "Unavailable");
    assert.match(payload.sources[2].interpretationBoundary, /indeterminate/i);
    assert.match(payload.evidenceBoundary, /Empty means no matching rows were observed/i);
    const persistedText = JSON.stringify(payload);
    assert.ok(!persistedText.includes("SECRET"));
    assert.ok(!persistedText.includes("22222222-2222-2222-2222-222222222222"));
    assert.ok(persistedText.includes("***22222222"));
    assert.ok(result.limitations.some((item) => /does not prove causality/i.test(item)));
  });

  test("treats readable Empty mechanism sources as bounded absence of observation, not proof of non-participation", () => {
    const provider = new MechanismContextInvestigationEvidenceProvider();
    const result = provider.normalize({
      ok: true,
      structuredContent: {
        targetTable: "sample_task",
        interval: { fromIso: "2026-08-01T00:00:00Z", toIso: "2026-08-02T00:00:00Z" },
        audit: { ok: true, structuredContent: { data: { value: [] } } },
        asyncOperations: { ok: true, structuredContent: { data: { value: [] } } },
        pluginTrace: { ok: true, structuredContent: { data: { value: [] } } }
      }
    }, { investigation: { subject: { kind: "Record", logicalName: "contact" }, currentIntent: { directionLogicalName: "sample_task" } } as never, acquiredAt: "2026-08-02T00:00:00Z" });

    const payload = result.payload as any;
    assert.strictEqual(result.status, "Acquired");
    assert.ok(payload.sources.every((item: any) => item.state === "Empty"));
    const plugin = payload.sources.find((item: any) => item.kind === "PluginTrace");
    const asyncOperation = payload.sources.find((item: any) => item.kind === "AsyncOperation");
    assert.match(plugin.interpretationBoundary, /no matching rows were observed/i);
    assert.match(plugin.interpretationBoundary, /does not establish that no plug-in/i);
    assert.match(asyncOperation.interpretationBoundary, /does not establish that no asynchronous workflow or operation/i);
    assert.match(payload.evidenceBoundary, /not that the mechanism did not participate/i);
    assert.ok(result.limitations.some((item) => /Empty readable source/i.test(item)));
    const normalizedText = JSON.stringify(result)
      .replace(/does not establish that no plug-in participated/gi, "")
      .replace(/does not establish that no asynchronous workflow or operation participated/gi, "")
      .replace(/not that the mechanism did not participate/gi, "")
      .replace(/does not prove that the corresponding mechanism did not participate/gi, "");
    assert.doesNotMatch(normalizedText, /the plug-in did not run|the workflow did not run|the mechanism did not participate/i);
  });

  test("marks prior managed readiness stale after post-checkpoint mechanism evidence and refreshes it without confidence increase", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass1051-mechanism-readiness-"));
    const environmentUrl = "https://example.crm.dynamics.com";
    const investigations = new WorkspaceInvestigationRepository(root, environmentUrl);
    const application = new InvestigationApplicationService(investigations, environmentUrl, () => new Date("2026-08-09T00:00:00.000Z"));
    const started = application.start({ question: "Investigate Contact", type: "Record", subject: { kind: "Record", table: "contact", recordId: "11111111-1111-1111-1111-111111111111" } });
    const evidenceRepository = new WorkspaceInvestigationEvidenceRepository(root, environmentUrl);
    const acquisition = new InvestigationEvidenceAcquisitionService(
      investigations,
      evidenceRepository,
      new InvestigationEvidenceProviderRegistry([
        new MetadataInvestigationEvidenceProvider(),
        new RelationshipContextInvestigationEvidenceProvider(),
        new BusinessPathRuntimeInvestigationEvidenceProvider(),
        new MechanismContextInvestigationEvidenceProvider()
      ]),
      new WorkspaceInvestigationJournalRepository(root, environmentUrl),
      () => new Date("2026-08-09T00:01:00.000Z")
    );
    acquisition.record({ investigationId: started.investigationId, providerId: "metadata", rawResult: { ok: true, structuredContent: { entity: { LogicalName: "contact" } } } });
    acquisition.record({ investigationId: started.investigationId, providerId: "relationship-context", rawResult: { ok: true, structuredContent: { sourceTable: "contact" } } });
    acquisition.record({ investigationId: started.investigationId, providerId: "business-path-runtime", rawResult: { ok: true, structuredContent: { sourceTable: "contact", targetTable: "msemr_careplanactivity", runtimePreferredPath: { pathId: "p1", tables: ["contact", "msemr_careplan", "msemr_careplanactivity"], runtimeStatus: "RuntimeViable", observedTargetRecordCount: 3 }, validatedPaths: [] } } });
    const intelligence = new InvestigationEvidenceIntelligenceService(investigations, () => new Date("2026-08-09T00:02:00.000Z"));
    const first = intelligence.assessManaged(started.investigationId);
    const beforeCheckpoint = investigations.get(started.investigationId)!;
    investigations.save({ ...beforeCheckpoint, status: "ReadyForMiniRca", miniRcaArtifactRefs: ["mrca-11111111-1111-1111-1111-111111111111"] });

    const mechanism = acquisition.record({ investigationId: started.investigationId, providerId: "mechanism-context", rawResult: { ok: true, structuredContent: { targetTable: "msemr_careplanactivity", interval: { fromIso: "2026-08-01T00:00:00Z", toIso: "2026-08-09T00:00:00Z" }, audit: { ok: false, summary: "HTTP 403" }, asyncOperations: { ok: true, structuredContent: { data: { value: [] } } }, pluginTrace: { ok: true, structuredContent: { data: { value: [{ plugintracelogid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", typename: "RetrieveMultiple", primaryentity: "msemr_careplanactivity" }] } } } } } });
    assert.strictEqual(mechanism.investigation.managedReadiness?.isStale, true);
    assert.strictEqual(mechanism.investigation.managedReadiness?.currentEvidenceCount, 4);
    const mechanismRef = mechanism.investigation.evidenceRefs.at(-1) as { decisionSignals?: { pluginTraceState?: string } };
    assert.strictEqual(mechanismRef.decisionSignals?.pluginTraceState, "Observed");
    const stale = intelligence.getReadiness(started.investigationId) as { isStale?: boolean; currentEvidenceCount?: number };
    assert.strictEqual(stale.isStale, true);
    assert.strictEqual(stale.currentEvidenceCount, 4);

    const refreshed = intelligence.assessManaged(started.investigationId);
    assert.strictEqual(refreshed.evidenceCount, 4);
    assert.ok(refreshed.providerContributions.some((item) => item.contributorId === "mechanism-evidence-understanding"));
    assert.strictEqual(refreshed.baseSynthesizedConfidence, first.baseSynthesizedConfidence);
    assert.strictEqual(refreshed.effectiveSynthesizedConfidence, first.effectiveSynthesizedConfidence);
    assert.match(refreshed.summary, /mechanism evidence/i);
    assert.strictEqual(refreshed.isStale, undefined);
    fs.rmSync(root, { recursive: true, force: true });
  });

});
