import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { WorkspaceInvestigationEvidenceRepository } from "../../pro/investigations/investigationEvidenceRepository.js";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";
import { randomUUID } from "crypto";

const config: DvqrMcpRuntimeConfiguration = {
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

suite("mcpLiveToolDispatcher", () => {
  test("returns capabilities without invoking Dataverse", async () => {
    const response = await new DvqrMcpLiveToolDispatcher(config).dispatch({ name: "dvqr_list_capabilities" });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual((response.structuredContent as any).contractVersion, "dvqr-mcp-capabilities-v1");
    assert.strictEqual((response.structuredContent as any).proEnabled, false);
  });

  test("centralises unknown tool handling", async () => {
    const response = await new DvqrMcpLiveToolDispatcher(config).dispatch({ name: "dvqr_unknown" });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "ToolNotFound");
  });

  test("centralises the Pro capability boundary", async () => {
    const response = await new DvqrMcpLiveToolDispatcher(config).dispatch({
      name: "dvqr_assess_investigation_readiness",
      arguments: {}
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).status, "capability_required");
    assert.strictEqual((response.structuredContent as any).availableIn, "pro");
  });
  test("renders authoritative investigation lifecycle completion text", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.startInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-11111111-1111-1111-1111-111111111111", title: "Contact", status: "Active", environmentId: "example.crm.dynamics.com", subject: { logicalName: "contact", displayLabel: "Contact" }, evidenceRefs: [] } }
        : name === "dvqr.bootstrapInvestigation"
          ? { ok: true, structuredContent: { contractVersion: "dvqr-investigation-bootstrap-v1", investigationId: "inv-11111111-1111-1111-1111-111111111111" } }
          : name === "dvqr.listInvestigations"
            ? { ok: true, structuredContent: [{ investigationId: "inv-11111111-1111-1111-1111-111111111111", title: "Contact", status: "Active" }] }
            : { ok: true, structuredContent: {} }
    };
    const freeAdapter = {
      discoverOperationalAnchors: async () => ({ ok: true, structuredContent: { recommendationBasis: "StructuralMetadataFirstWithSupportingSemantics", operationalAnchors: [{ logicalName: "msemr_careplan", displayName: "Care Plan", score: 92, reasons: [{ message: "Relevant healthcare business surface." }] }] } })
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter as any, foundation as any);
    const started = await dispatcher.dispatch({ name: "dvqr_start_investigation", arguments: { question: "Contact" } });
    assert.match(started.content[0].text, /created the investigation and completed metadata-only preparation/i);
    assert.match(started.content[0].text, /Investigation ID: inv-/i);
    assert.match(started.content[0].text, /Care Plan/i);
    assert.match(started.content[0].text, /no runtime query or investigation evidence acquisition/i);
    assert.strictEqual((started.structuredContent as any).contractVersion, "dvqr-investigation-prepared-start-v2");
    assert.strictEqual((started.structuredContent as any).nextRequiredAction.action, "CaptureAndPersistIntent");
    assert.strictEqual((started.structuredContent as any).nextRequiredAction.tool, "dvqr_update_investigation_intent");
    const listed = await dispatcher.dispatch({ name: "dvqr_list_investigations", arguments: {} });
    assert.match(listed.content[0].text, /successfully listed 1 persisted investigation/i);
    assert.match(listed.content[0].text, /authoritative/i);
  });


  test("forwards Dataverse GUIDs with non-RFC version nibbles to the runtime provider", async () => {
    const proConfig = { ...config, proEnabled: true };
    const suppliedId = "1c167d8a-0d35-ef11-8e4e-000d3a6a071d";
    let receivedProbeArgs: Record<string, unknown> | undefined;
    const freeAdapter = {
      getEntityMetadata: async () => ({ ok: true, structuredContent: { entity: { EntitySetName: "contacts", PrimaryIdAttribute: "contactid" } } }),
      executeOData: async () => ({ ok: true, structuredContent: { value: [{ contactid: suppliedId }] } }),
      probeRelationshipPath: async (args: Record<string, unknown>) => {
        receivedProbeArgs = args;
        return { ok: true, summary: "Observed", structuredContent: { sourceTable: "contact", requestedTargetTable: "msemr_encounter", sourceRecordId: args.sourceRecordId, runtimeRecommendation: { finalTargetRecordCount: 1 }, runtimeEvidence: { observations: [{ reachedTarget: true, finalTargetRecordCount: 1 }] }, probeResults: [], bounds: {} } };
      }
    };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-1", status: "Active", subject: { kind: "Record", logicalName: "contact" }, staleState: { isStale: false } } }
        : { ok: true, structuredContent: { investigationId: "inv-1", evidence: { evidenceId: "ev-1" } } }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter as any, foundation as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_investigation_evidence",
      arguments: { investigationId: "inv-1", providerId: "runtime-relationship", sourceRecordId: suppliedId, targetTable: "msemr_encounter" }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual(receivedProbeArgs?.sourceRecordId, suppliedId);
    assert.strictEqual(receivedProbeArgs?.targetTable, "msemr_encounter");
  });

  test("distinguishes a missing runtime sourceRecordId from an invalid one for a Record investigation", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-1", status: "Active", subject: { kind: "Record", logicalName: "contact" }, staleState: { isStale: false } } }
        : { ok: true, structuredContent: {} }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, undefined, foundation as any);
    const missing = await dispatcher.dispatch({ name: "dvqr_acquire_investigation_evidence", arguments: { investigationId: "inv-1", providerId: "runtime-relationship" } });
    assert.strictEqual(missing.isError, true);
    assert.match(missing.content[0].text, /field was not received/i);
    const invalid = await dispatcher.dispatch({ name: "dvqr_acquire_investigation_evidence", arguments: { investigationId: "inv-1", providerId: "runtime-relationship", sourceRecordId: "abc123" } });
    assert.strictEqual(invalid.isError, true);
    assert.match(invalid.content[0].text, /not a canonical Dataverse GUID/i);
  });

  test("reports incompatible managed subject before missing business-path runtime arguments", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-general", status: "Active", subject: { kind: "General" }, staleState: { isStale: false } } }
        : { ok: true, structuredContent: {} }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, undefined, foundation as any);
    const response = await dispatcher.dispatch({ name: "dvqr_acquire_investigation_evidence", arguments: { investigationId: "inv-general", providerId: "business-path-runtime" } });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "UnsupportedSubject");
    assert.strictEqual((response.structuredContent as any).actualSubjectKind, "General");
    assert.strictEqual((response.structuredContent as any).standaloneFallbackAllowed, false);
    assert.strictEqual((response.structuredContent as any).expectedSubjectKind, "Record");
    assert.match(response.content[0].text, /Record-scoped investigation subject/i);
  });


  test("probes ranked anchors until runtime rows are observed", async () => {
    const proConfig = { ...config, proEnabled: true };
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass62-dispatch-"));
    const previousRoot = process.env.DVQR_MCP_WORKSPACE_ROOT;
    const previousEnvironment = process.env.DVQR_MCP_ENVIRONMENT_URL;
    process.env.DVQR_MCP_WORKSPACE_ROOT = root;
    process.env.DVQR_MCP_ENVIRONMENT_URL = "https://example.crm.dynamics.com";
    try {
      const investigationId = `inv-${randomUUID()}`;
      const relationshipEvidenceId = `ev-${randomUUID()}`;
      const repository = new WorkspaceInvestigationEvidenceRepository(root, process.env.DVQR_MCP_ENVIRONMENT_URL);
      repository.save({
        evidenceId: relationshipEvidenceId, schemaVersion: "dvqr-investigation-evidence-v1", investigationId, evidenceType: "RelationshipContext", providerId: "relationship-context", status: "Acquired", summary: "anchors", provenance: { providerId: "relationship-context", capability: "test", environmentId: "example.crm.dynamics.com", acquiredAt: "2026-08-05T00:00:00.000Z", readOnly: true }, limitations: [], recommendations: [], fingerprint: "fp", revision: 1,
        payload: { recommendedAnchor: { logicalName: "msemr_encounter" }, operationalAnchors: [{ logicalName: "msemr_encounter" }, { logicalName: "msemr_careplan" }, { logicalName: "msemr_referralrequest" }] }
      });
      const targets: string[] = [];
      const freeAdapter = {
        getEntityMetadata: async () => ({ ok: true, structuredContent: { entity: { EntitySetName: "contacts", PrimaryIdAttribute: "contactid" } } }),
        executeOData: async () => ({ ok: true, structuredContent: { value: [{ contactid: "1c167d8a-0d35-ef11-8e4e-000d3a6a071d" }] } }),
        probeRelationshipPath: async (args: Record<string, unknown>) => {
          const target = String(args.targetTable);
          targets.push(target);
          const observed = target === "msemr_careplan";
          return { ok: true, summary: observed ? "observed" : "empty", structuredContent: { runtimeRecommendation: observed ? { finalTargetRecordCount: 1 } : undefined, runtimeEvidence: { observations: [{ reachedTarget: observed, finalTargetRecordCount: observed ? 1 : 0 }] } } };
        }
      };
      const foundation = {
        callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
          ? { ok: true, structuredContent: { investigationId, status: "Active", subject: { kind: "Record", logicalName: "contact" }, staleState: { isStale: false } } }
          : { ok: true, structuredContent: { investigationId, evidence: { evidenceId: `ev-${randomUUID()}` } } }
      };
      const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter as any, foundation as any);
      const response = await dispatcher.dispatch({ name: "dvqr_acquire_investigation_evidence", arguments: { investigationId, providerId: "runtime-relationship", sourceRecordId: "1c167d8a-0d35-ef11-8e4e-000d3a6a071d" } });
      assert.strictEqual(response.isError, undefined);
      assert.deepStrictEqual(targets, ["msemr_encounter", "msemr_careplan"]);
    } finally {
      if (previousRoot === undefined) delete process.env.DVQR_MCP_WORKSPACE_ROOT; else process.env.DVQR_MCP_WORKSPACE_ROOT = previousRoot;
      if (previousEnvironment === undefined) delete process.env.DVQR_MCP_ENVIRONMENT_URL; else process.env.DVQR_MCP_ENVIRONMENT_URL = previousEnvironment;
    }
  });

  test("assesses a persisted investigation by investigationId without a guessed request envelope", async () => {
    const proConfig = { ...config, proEnabled: true };
    let received: unknown;
    const foundation = {
      callTool: (call: unknown) => {
        received = call;
        return { ok: true, structuredContent: { contractVersion: "dvqr-managed-investigation-readiness-v1", investigationId: "inv-1", posture: "Limited", evidenceCount: 3, gaps: [], confidenceEffect: "Dampen", effectiveSynthesizedConfidence: "Low", summary: "Managed readiness assessed." } };
      }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, undefined, foundation as any);
    const response = await dispatcher.dispatch({ name: "dvqr_assess_investigation_readiness", arguments: { investigationId: "inv-1" } });
    assert.strictEqual(response.isError, undefined);
    assert.deepStrictEqual(received, { name: "dvqr.assessInvestigationReadiness", arguments: { investigationId: "inv-1" } });
    assert.match(response.content[0].text, /without requiring an internal request envelope/i);
  });

  test("rejects a source record that does not resolve in the investigation subject table before probing", async () => {
    const proConfig = { ...config, proEnabled: true };
    let probed = false;
    const freeAdapter = {
      getEntityMetadata: async () => ({ ok: true, structuredContent: { entity: { EntitySetName: "contacts", PrimaryIdAttribute: "contactid" } } }),
      executeOData: async () => ({ ok: false, code: "ExecutionFailed", message: "404 not found" }),
      probeRelationshipPath: async () => { probed = true; return { ok: true, structuredContent: {} }; }
    };
    const foundation = { callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation" ? { ok: true, structuredContent: { investigationId: "inv-1", status: "Active", subject: { kind: "Record", logicalName: "contact" }, staleState: { isStale: false } } } : { ok: true, structuredContent: {} } };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter as any, foundation as any);
    const response = await dispatcher.dispatch({ name: "dvqr_acquire_investigation_evidence", arguments: { investigationId: "inv-1", providerId: "runtime-relationship", sourceRecordId: "8fe4c5e3-ac62-f011-bec1-000d3a6a5105", targetTable: "msemr_encounter" } });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "SourceRecordSubjectMismatch");
    assert.strictEqual(probed, false);
  });


  test("Pass 10.7.5.3 forwards the persisted asserted traversal into live managed business-path runtime", async () => {
    const proConfig = { ...config, proEnabled: true };
    const investigationId = `inv-${randomUUID()}`;
    let received: Record<string, unknown> | undefined;
    const freeAdapter = {
      getEntityMetadata: async () => ({ ok: true, structuredContent: { entity: { EntitySetName: "contacts", PrimaryIdAttribute: "contactid" } } }),
      executeOData: async () => ({ ok: true, structuredContent: { value: [{ contactid: "d264ceff-8763-f011-bec2-002248985631" }] } }),
      validateBusinessPaths: async (args: Record<string, unknown>) => {
        received = args;
        return { ok: true, summary: "validated", structuredContent: { assertedBusinessTraversal: { tables: args.assertedBusinessPathTables, reachedTarget: true }, validatedPaths: [] } };
      }
    };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId, status: "Active", subject: { kind: "Record", logicalName: "contact" }, staleState: { isStale: false }, assertedBusinessTraversal: { tables: ["contact", "msemr_careplan", "msemr_careplanactivity", "sample_task"], source: "Question" } } }
        : { ok: true, structuredContent: { investigationId, evidence: { evidenceId: `ev-${randomUUID()}` } } }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter as any, foundation as any);
    const response = await dispatcher.dispatch({ name: "dvqr_acquire_investigation_evidence", arguments: { investigationId, providerId: "business-path-runtime", sourceRecordId: "d264ceff-8763-f011-bec2-002248985631", targetTable: "sample_task" } });
    assert.strictEqual(response.isError, undefined);
    assert.deepStrictEqual(received?.assertedBusinessPathTables, ["contact", "msemr_careplan", "msemr_careplanactivity", "sample_task"]);
  });


  test("Pass 10.8.4 routes managed readiness by investigationId without an internal request envelope", async () => {
    const proConfig = { ...config, proEnabled: true };
    const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
    const foundation = {
      callTool: (call: { name: string; arguments?: Record<string, unknown> }) => {
        calls.push(call);
        if (call.name === "dvqr.getInvestigation") {
          return { ok: true, structuredContent: { investigationId: "inv-ready", currentIntent: { directionLogicalName: "sample_task" } } };
        }
        if (call.name === "dvqr.continueInvestigation") {
          return {
            ok: true,
            structuredContent: {
              investigation: { investigationId: "inv-ready" },
              recommendedAction: undefined
            }
          };
        }
        if (call.name === "dvqr.assessInvestigationReadiness") {
          assert.deepStrictEqual(call.arguments, { investigationId: "inv-ready" });
          return {
            ok: true,
            structuredContent: {
              contractVersion: "dvqr-managed-investigation-readiness-v1",
              investigationId: "inv-ready",
              posture: "Conditional",
              summary: "Managed readiness assessed.",
              evidenceCount: 3,
              gaps: [],
              effectiveSynthesizedConfidence: "Low",
              confidenceEffect: "Qualify"
            }
          };
        }
        throw new Error(`Unexpected tool: ${call.name}`);
      }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_assess_investigation_readiness",
      arguments: { investigationId: "inv-ready" }
    });
    assert.strictEqual(response.isError, undefined);
    assert.ok(calls.some((call) => call.name === "dvqr.assessInvestigationReadiness"));
    assert.match(response.content[0].text, /assessed and persisted investigation readiness/i);
    assert.doesNotMatch(response.content[0].text, /request envelope is required/i);
  });

  test("Pass 10.8.4 routes the first-class timeline alias through timeline-context managed acquisition", async () => {
    const proConfig = { ...config, proEnabled: true };
    let recordedProviderId: unknown;
    const foundation = {
      callTool: ({ name, arguments: args }: { name: string; arguments?: Record<string, unknown> }) => {
        if (name === "dvqr.getInvestigation") {
          return {
            ok: true,
            structuredContent: {
              investigationId: "inv-timeline",
              status: "ReadyForMiniRca",
              subject: { kind: "Record", logicalName: "msemr_careplanactivity" },
              currentIntent: { directionLogicalName: "sample_task" },
              staleState: { isStale: false },
              miniRcaArtifactRefs: [{ artifactId: "mini-1" }],
              evidenceRefs: []
            }
          };
        }
        if (name === "dvqr.recordInvestigationEvidence") {
          recordedProviderId = args?.providerId;
          return {
            ok: true,
            structuredContent: {
              investigationId: "inv-timeline",
              evidence: { evidenceId: "ev-timeline", providerId: "timeline-context", status: "Acquired" }
            }
          };
        }
        throw new Error(`Unexpected tool: ${name}`);
      }
    } as never;
    const freeAdapter = {
      executeOData: async () => ({ ok: true, structuredContent: { data: { value: [] } } })
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_timeline_context",
      arguments: {
        investigationId: "inv-timeline",
        targetTable: "sample_task",
        fromIso: "2026-07-01T00:00:00Z",
        toIso: "2026-07-31T23:59:59Z",
        boundaryRequestText: "Use fromIso 2026-07-01T00:00:00Z and toIso 2026-07-31T23:59:59Z"
      }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual(recordedProviderId, "timeline-context");
  });

  test("Pass 10.8.9.4 confirms the same pending investigation through visible bootstrap fallback", async () => {
    const proConfig = { ...config, proEnabled: true };
    const investigationId = "inv-bootstrap-confirm-fallback";
    let updateCalls = 0;
    let bootstrapCalls = 0;
    const foundation = {
      callTool: ({ name }: { name: string; arguments?: Record<string, unknown> }) => {
        if (name === "dvqr.startInvestigation") {
          return { ok: true, structuredContent: { investigationId, status: "Active", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, evidenceRefs: [] } };
        }
        if (name === "dvqr.bootstrapInvestigation") {
          bootstrapCalls += 1;
          return { ok: true, structuredContent: { investigationId } };
        }
        if (name === "dvqr.updateInvestigationIntent") {
          updateCalls += 1;
          return { ok: true, structuredContent: { investigationId, currentIntent: { directionLogicalName: "sample_task" } } };
        }
        if (name === "dvqr.getInvestigation") {
          return { ok: true, structuredContent: { investigationId, subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, evidenceRefs: [], currentIntent: updateCalls ? { directionLogicalName: "sample_task" } : undefined } };
        }
        return { ok: true, structuredContent: { investigationId } };
      }
    } as never;

    const freeAdapter = {
      discoverOperationalAnchors: async () => ({
        kind: "dvqr-operational-anchor-discovery-v1",
        sourceTable: "msemr_careplanactivity",
        candidates: []
      })
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    await dispatcher.dispatch({
      name: "dvqr_start_investigation",
      arguments: {
        question: "Investigate Care Plan Activity adb5efca-c866-f011-b4cb-000d3a6a75e8 and downstream sample_task"
      }
    });

    const confirmed = await dispatcher.dispatch({
      name: "dvqr_bootstrap_investigation",
      arguments: {
        investigationId,
        confirmationText: "Continue Investigation"
      }
    });

    assert.strictEqual(confirmed.isError, undefined);
    assert.strictEqual(updateCalls, 1);
    assert.strictEqual(bootstrapCalls, 1, "Only the preparation bootstrap from start should run; confirmation fallback must route through intent persistence rather than re-bootstrap.");
    assert.match(confirmed.content[0].text, /confirmed|persisted intent|first evidence/i);
  });

  test("Pass 10.8.5 renders the exact continuation ToolCall instead of leaving the host to semantic tool search", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.continueInvestigation"
        ? {
            ok: true,
            structuredContent: {
              investigation: { investigationId: "inv-rca-action" },
              presentedStep: { order: 6, title: "Generate Mini RCA checkpoint", capability: "dvqr_generate_mini_rca", requiresExplicitUserAction: true },
              recommendedAction: {
                kind: "ToolCall",
                tool: "dvqr_generate_mini_rca_checkpoint",
                arguments: { investigationId: "inv-rca-action" },
                reason: "Current managed readiness is eligible."
              },
              noExecutionPerformed: true,
              evidenceAcquired: false
            }
          }
        : { ok: true, structuredContent: {} }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({ name: "dvqr_continue_investigation", arguments: { investigationId: "inv-rca-action" } });
    assert.strictEqual(response.isError, undefined);
    assert.match(response.content[0].text, /Exact executable action: dvqr_generate_mini_rca_checkpoint/i);
    assert.match(response.content[0].text, /Do not search for a similarly named tool/i);
    assert.match(response.content[0].text, /substitute a retrieval-only tool/i);
  });



  test("Pass 10.9.1.2 executes only the canonical Mini RCA recommendation through continuation fallback", async () => {
    const proConfig = { ...config, proEnabled: true };
    const calls: string[] = [];
    const foundation = {
      callTool: ({ name }: { name: string }) => {
        calls.push(name);
        if (name === "dvqr.continueInvestigation") return {
          ok: true,
          structuredContent: {
            investigation: { investigationId: "inv-mini-fallback" },
            recommendedAction: {
              kind: "ToolCall",
              tool: "dvqr_generate_mini_rca_checkpoint",
              arguments: { investigationId: "inv-mini-fallback" },
              reason: "Current managed readiness is eligible."
            },
            noExecutionPerformed: true,
            evidenceAcquired: false
          }
        };
        if (name === "dvqr.generateMiniRca") return {
          ok: true,
          structuredContent: { investigationId: "inv-mini-fallback", artifactId: "mrca-fallback-1" }
        };
        return { ok: true, structuredContent: {} };
      }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_continue_investigation",
      arguments: { investigationId: "inv-mini-fallback", executeRecommendedMiniRca: true }
    });
    assert.strictEqual(response.isError, undefined);
    assert.deepStrictEqual(calls, ["dvqr.getInvestigation", "dvqr.continueInvestigation", "dvqr.generateMiniRca"]);
    assert.match(response.content[0].text, /restricted continuation fallback/i);
    assert.match(response.content[0].text, /Dataverse evidence acquired: no/i);
  });

  test("Pass 10.9.1.2 refuses continuation fallback for every non-Mini-RCA recommendation", async () => {
    const proConfig = { ...config, proEnabled: true };
    const calls: string[] = [];
    const foundation = {
      callTool: ({ name }: { name: string }) => {
        calls.push(name);
        return {
          ok: true,
          structuredContent: {
            investigation: { investigationId: "inv-non-mini" },
            recommendedAction: {
              kind: "ToolCall",
              tool: "dvqr_acquire_investigation_evidence",
              arguments: { investigationId: "inv-non-mini", providerId: "business-path-runtime" }
            }
          }
        };
      }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_continue_investigation",
      arguments: { investigationId: "inv-non-mini", executeRecommendedMiniRca: true }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any)?.code, "MiniRcaFallbackNotApplicable");
    assert.deepStrictEqual(calls, ["dvqr.getInvestigation", "dvqr.continueInvestigation"]);
  });

  test("Pass 10.8.8 renders Timeline as an explicit optional branch rather than a deterministic recommendedAction", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.continueInvestigation"
        ? {
            ok: true,
            structuredContent: {
              investigation: { investigationId: "inv-timeline-optional" },
              optionalActions: [{
                kind: "ToolCall",
                tool: "dvqr_acquire_timeline_context",
                arguments: { investigationId: "inv-timeline-optional", targetTable: "sample_task" },
                requiredHostArguments: {
                  fromIso: { source: "ExplicitJustifiedChronologyWindow", required: true, persist: false },
                  toIso: { source: "ExplicitJustifiedChronologyWindow", required: true, persist: false }
                },
                reason: "Optional chronology discriminator."
              }],
              noExecutionPerformed: true,
              evidenceAcquired: false
            }
          }
        : { ok: true, structuredContent: {} }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({ name: "dvqr_continue_investigation", arguments: { investigationId: "inv-timeline-optional" } });
    assert.strictEqual(response.isError, undefined);
    assert.match(response.content[0].text, /Optional managed branches: dvqr_acquire_timeline_context/i);
    assert.match(response.content[0].text, /Optional transient host arguments/i);
    assert.match(response.content[0].text, /Execute one only after an explicit user branch choice/i);
    assert.doesNotMatch(response.content[0].text, /Exact executable action: dvqr_acquire_timeline_context/i);
  });

  test("Pass 10.8.5 blocks timeline-context from leapfrogging the first Mini RCA checkpoint", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? {
            ok: true,
            structuredContent: {
              investigationId: "inv-pre-checkpoint",
              status: "ReadyForMiniRca",
              subject: { kind: "Record", logicalName: "msemr_careplanactivity" },
              currentIntent: { directionLogicalName: "msemr_careplanactivity" },
              miniRcaArtifactRefs: [],
              staleState: { isStale: false }
            }
          }
        : { ok: true, structuredContent: {} }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_timeline_context",
      arguments: {
        investigationId: "inv-pre-checkpoint",
        targetTable: "msemr_careplanactivity",
        fromIso: "2026-07-01T00:00:00Z",
        toIso: "2026-07-31T23:59:59Z"
      }
    });
    assert.strictEqual(response.isError, true);
    assert.match(
      response.content[0].text,
      /(post-checkpoint discriminator|persisted Mini RCA checkpoint|post-checkpoint mechanism\/plugin-execution follow-on evidence)/i
    );
    const structured = response.structuredContent as any;
    if (structured?.recommendedAction?.tool) {
      assert.strictEqual(structured.recommendedAction.tool, "dvqr_generate_mini_rca_checkpoint");
    }
    assert.doesNotMatch(response.content[0].text, /timeline evidence (?:was )?acquired|persisted timeline-context/i);
  });

  test("Pass 10.8.6 preserves an explicitly named downstream custom logical target separately from the Record subject", async () => {
    const proConfig = { ...config, proEnabled: true };
    let persistedIntent: Record<string, unknown> | undefined;
    const investigationId = "inv-target-intent";
    const foundation = {
      callTool: ({ name, arguments: args }: { name: string; arguments?: Record<string, unknown> }) => {
        if (name === "dvqr.startInvestigation") return { ok: true, structuredContent: { investigationId, status: "Active", subject: { kind: "Record", logicalName: "msemr_careplanactivity", displayLabel: "Care Plan Activity" }, evidenceRefs: [] } };
        if (name === "dvqr.bootstrapInvestigation") return { ok: true, structuredContent: { investigationId } };
        if (name === "dvqr.getInvestigation") return { ok: true, structuredContent: { investigationId, status: "Active", subject: { kind: "Record", logicalName: "msemr_careplanactivity" } } };
        if (name === "dvqr.updateInvestigationIntent") {
          persistedIntent = args;
          return { ok: true, structuredContent: { investigationId, currentIntent: args } };
        }
        throw new Error(`Unexpected tool ${name}`);
      }
    } as never;
    const freeAdapter = {
      discoverOperationalAnchors: async () => ({ ok: true, structuredContent: { operationalAnchors: [{ logicalName: "msemr_careplan", displayName: "Care Plan", score: 100, reasons: [] }] } })
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const started = await dispatcher.dispatch({
      name: "dvqr_start_investigation",
      arguments: { question: "Investigate Care Plan Activity adb5efca-c866-f011-b4cb-000d3a6a75e8 and understand how it relates to downstream contoso_workitem records." }
    });
    assert.strictEqual((started.structuredContent as any).explicitTarget.logicalName, "contoso_workitem");
    assert.match(started.content[0].text, /Explicit downstream target: contoso_workitem/i);
    const confirmed = await dispatcher.dispatch({
      name: "dvqr_continue_investigation",
      arguments: { investigationId, confirmationText: "Continue Investigation" }
    });
    assert.strictEqual(confirmed.isError, undefined);
    assert.strictEqual(persistedIntent?.directionLogicalName, "contoso_workitem");
    assert.strictEqual(persistedIntent?.leadingDirection, "contoso_workitem");
    assert.notStrictEqual(persistedIntent?.directionLogicalName, "msemr_careplanactivity");
  });

  test("Pass 10.8.7.2 exposes and routes first-class mechanism-context alias through canonical managed acquisition", async () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_mechanism_context");
    if (!tool) throw new Error("Managed mechanism alias missing.");
    assert.match(tool.description, /FIRST-CLASS POST-CHECKPOINT MECHANISM HANDOFF/i);
    assert.match(tool.description, /same canonical managed mechanism-context provider/i);
    assert.match(tool.description, /never invent a time boundary when the user supplied none/i);
    assert.match(tool.description, /abstract strategy capability label/i);
  });

  test("Pass 10.8.9.5 rejects agent-delegated mechanism boundary selection even when the host supplied concrete ISO values", async () => {
    const proConfig = { ...config, proEnabled: true };
    let executionCalls = 0;
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-delegated-mech", status: "ReadyForMiniRca", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, currentIntent: { directionLogicalName: "sample_task" }, staleState: { isStale: false }, miniRcaArtifactRefs: ["mini-1"] } }
        : { ok: true, structuredContent: {} }
    } as never;
    const freeAdapter = { executeOData: async () => { executionCalls += 1; return { ok: true, structuredContent: { data: { value: [] } } }; } } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_mechanism_context",
      arguments: {
        investigationId: "inv-delegated-mech",
        targetTable: "sample_task",
        fromIso: "2026-07-13T00:00:00Z",
        toIso: "2026-08-12T23:59:59Z",
        boundaryRequestText: "Use whatever time window you think is appropriate."
      }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any)?.code, "AgentBoundaryDelegationNotAllowed");
    assert.strictEqual(executionCalls, 0);
    assert.match(response.content[0].text, /delegated selection.*time boundary/i);
    assert.match(response.content[0].text, /do not manufacture boundaryRequestText/i);
  });

  test("Pass 10.8.9.5 rejects agent-delegated Timeline boundary selection instead of persisting UserRelativeBoundary", async () => {
    const proConfig = { ...config, proEnabled: true };
    let executionCalls = 0;
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-delegated-timeline", status: "ReadyForMiniRca", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, currentIntent: { directionLogicalName: "sample_task" }, staleState: { isStale: false }, miniRcaArtifactRefs: ["mini-1"] } }
        : { ok: true, structuredContent: {} }
    } as never;
    const freeAdapter = { executeOData: async () => { executionCalls += 1; return { ok: true, structuredContent: { data: { value: [] } } }; } } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_timeline_context",
      arguments: {
        investigationId: "inv-delegated-timeline",
        targetTable: "sample_task",
        fromIso: "2026-07-13T00:00:00Z",
        toIso: "2026-08-12T23:59:59Z",
        boundaryRequestText: "Pick a sensible period yourself."
      }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any)?.code, "AgentBoundaryDelegationNotAllowed");
    assert.strictEqual(executionCalls, 0);
  });

  test("Pass 10.8.9.5 still accepts genuine user-relative temporal intent", async () => {
    const proConfig = { ...config, proEnabled: true };
    let provenance: any;
    const foundation = {
      callTool: ({ name, arguments: callArgs }: { name: string; arguments?: Record<string, unknown> }) => {
        if (name === "dvqr.getInvestigation") return { ok: true, structuredContent: { investigationId: "inv-genuine-relative", status: "ReadyForMiniRca", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, currentIntent: { directionLogicalName: "sample_task" }, staleState: { isStale: false }, miniRcaArtifactRefs: ["mini-1"] } };
        if (name === "dvqr.recordInvestigationEvidence") {
          provenance = ((callArgs?.rawResult as any)?.structuredContent as any)?.boundaryProvenance;
          return { ok: true, structuredContent: { evidence: { evidenceId: "ev-genuine-relative", providerId: "mechanism-context", status: "Acquired" } } };
        }
        return { ok: true, structuredContent: {} };
      }
    } as never;
    const freeAdapter = { executeOData: async () => ({ ok: true, structuredContent: { data: { value: [] } } }) } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_mechanism_context",
      arguments: {
        investigationId: "inv-genuine-relative",
        targetTable: "sample_task",
        fromIso: "2026-07-13T00:00:00Z",
        toIso: "2026-08-12T23:59:59Z",
        boundaryRequestText: "Use the last 30 days."
      }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual(provenance?.source, "UserRelativeBoundary");
    assert.strictEqual(provenance?.requestText, "Use the last 30 days.");
  });

  test("Pass 10.8.9.2 accepts explicit relative mechanism windows and records UserRelativeBoundary provenance", async () => {
    const proConfig = { ...config, proEnabled: true };
    let provenance: any;
    const foundation = {
      callTool: ({ name, arguments: callArgs }: { name: string; arguments?: Record<string, unknown> }) => {
        if (name === "dvqr.getInvestigation") return { ok: true, structuredContent: { investigationId: "inv-boundary", status: "ReadyForMiniRca", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, currentIntent: { directionLogicalName: "sample_task" }, staleState: { isStale: false }, miniRcaArtifactRefs: ["mini-1"] } };
        if (name === "dvqr.recordInvestigationEvidence") {
          provenance = ((callArgs?.rawResult as any)?.structuredContent as any)?.boundaryProvenance;
          return { ok: true, structuredContent: { evidence: { evidenceId: "ev-relative", providerId: "mechanism-context", status: "Acquired" } } };
        }
        throw new Error(`Unexpected ${name}`);
      }
    } as never;
    const freeAdapter = { executeOData: async () => ({ ok: true, structuredContent: { data: { value: [] } } }) } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_mechanism_context",
      arguments: {
        investigationId: "inv-boundary",
        targetTable: "sample_task",
        fromIso: "2026-07-13T00:00:00Z",
        toIso: "2026-08-12T23:59:59Z",
        boundaryRequestText: "Use the last 30 days and proceed with mechanism-context."
      }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual(provenance?.source, "UserRelativeBoundary");
    assert.strictEqual(provenance?.requestText, "Use the last 30 days and proceed with mechanism-context.");
    assert.strictEqual(provenance?.resolvedFromIso, "2026-07-13T00:00:00Z");
    assert.strictEqual(provenance?.resolvedToIso, "2026-08-12T23:59:59Z");
  });

  test("Pass 10.8.9.2 still rejects mechanism windows when the user supplied no temporal instruction", async () => {
    const proConfig = { ...config, proEnabled: true };
    const foundation = {
      callTool: ({ name }: { name: string }) => name === "dvqr.getInvestigation"
        ? { ok: true, structuredContent: { investigationId: "inv-boundary-missing", status: "ReadyForMiniRca", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, currentIntent: { directionLogicalName: "sample_task" }, staleState: { isStale: false }, miniRcaArtifactRefs: ["mini-1"] } }
        : { ok: true, structuredContent: {} }
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, {} as never, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_mechanism_context",
      arguments: {
        investigationId: "inv-boundary-missing",
        targetTable: "sample_task",
        fromIso: "2026-07-13T00:00:00Z",
        toIso: "2026-08-12T23:59:59Z",
        boundaryRequestText: "Continue Investigation"
      }
    });
    assert.strictEqual(response.isError, true);
    assert.match(response.content[0].text, /current temporal instruction/i);
    assert.match(response.content[0].text, /do not invent/i);
  });

  test("Pass 10.8.9.2 records explicit ISO boundary requests as UserAbsoluteBoundary", async () => {
    const proConfig = { ...config, proEnabled: true };
    let recorded = false;
    let absoluteProvenance: any;
    const foundation = {
      callTool: ({ name, arguments: callArgs }: { name: string; arguments?: Record<string, unknown> }) => {
        if (name === "dvqr.getInvestigation") return { ok: true, structuredContent: { investigationId: "inv-boundary-ok", status: "ReadyForMiniRca", subject: { kind: "Record", logicalName: "msemr_careplanactivity" }, currentIntent: { directionLogicalName: "sample_task" }, staleState: { isStale: false }, miniRcaArtifactRefs: ["mini-1"] } };
        if (name === "dvqr.recordInvestigationEvidence") { recorded = true; absoluteProvenance = ((callArgs?.rawResult as any)?.structuredContent as any)?.boundaryProvenance; return { ok: true, structuredContent: { evidence: { evidenceId: "ev-mech", providerId: "mechanism-context", status: "Acquired" } } }; }
        throw new Error(`Unexpected ${name}`);
      }
    } as never;
    const freeAdapter = { executeOData: async () => ({ ok: true, structuredContent: { data: { value: [] } } }) } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const response = await dispatcher.dispatch({
      name: "dvqr_acquire_mechanism_context",
      arguments: {
        investigationId: "inv-boundary-ok",
        targetTable: "sample_task",
        fromIso: "2026-07-13T00:00:00Z",
        toIso: "2026-08-12T23:59:59Z",
        boundaryRequestText: "Use fromIso: 2026-07-13T00:00:00Z and toIso: 2026-08-12T23:59:59Z"
      }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual(recorded, true);
    assert.strictEqual(absoluteProvenance?.source, "UserAbsoluteBoundary");
  });

  test("Pass 10.9.5.2 suppresses duplicate pending starts when optimized host supplies question and title only", async () => {
    const proConfig = { ...config, proEnabled: true };
    let startCalls = 0;
    const foundation = {
      callTool: ({ name }: { name: string }) => {
        if (name === "dvqr.startInvestigation") {
          startCalls += 1;
          return {
            ok: true,
            structuredContent: {
              investigationId: `inv-${startCalls}`,
              title: "Investigate Care Plan Activity",
              status: "Active",
              environmentId: "example.crm.dynamics.com",
              subject: { logicalName: "msemr_careplanactivity", displayLabel: "Care Plan Activity" },
              evidenceRefs: []
            }
          };
        }
        if (name === "dvqr.bootstrapInvestigation") {
          return { ok: true, structuredContent: { contractVersion: "dvqr-investigation-bootstrap-v1", investigationId: "inv-1", bootstrapCompletedAt: "2026-08-13T00:00:00.000Z" } };
        }
        return { ok: true, structuredContent: {} };
      }
    } as never;
    const freeAdapter = {
      discoverOperationalAnchors: async () => ({
        ok: true,
        structuredContent: {
          recommendationBasis: "StructuralMetadataFirstWithSupportingSemantics",
          operationalAnchors: [{ logicalName: "msemr_careplan", displayName: "Care Plan", score: 92, reasons: [{ message: "Relevant business surface." }] }]
        }
      })
    } as never;
    const dispatcher = new DvqrMcpLiveToolDispatcher(proConfig, freeAdapter, foundation);
    const args = {
      question: "Investigate Care Plan Activity adb5efca-c866-f011-b4cb-000d3a6a75e8. I want to understand how this record relates to downstream sample_task records and what evidence exists about how the task came to exist.",
      title: "Investigate Care Plan Activity to sample_task downstream evidence"
    };

    const first = await dispatcher.dispatch({ name: "dvqr_start_investigation", arguments: args });
    const second = await dispatcher.dispatch({ name: "dvqr_start_investigation", arguments: args });

    assert.strictEqual(startCalls, 1, "The second pending start must not persist another investigation.");
    assert.strictEqual((first.structuredContent as any).investigation.investigationId, "inv-1");
    assert.strictEqual((second.structuredContent as any).investigation.investigationId, "inv-1");
    assert.deepStrictEqual(second.structuredContent, first.structuredContent);
    assert.strictEqual((first.structuredContent as any).hostProtocolGuard.duplicateStartSuppression, "SessionScopedPendingRecord");
  });

});
