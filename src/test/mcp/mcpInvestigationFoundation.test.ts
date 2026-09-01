import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DvqrMcpApplicationAdapter } from "../../mcp/mcpApplicationAdapter.js";
import { DVQR_MCP_TOOL_NAMES } from "../../mcp/mcpToolCatalogue.js";
import { InvestigationApplicationService, WorkspaceInvestigationRepository } from "../../pro/investigations/index.js";
import { investigationReadinessSemanticOperations } from "../../core/readiness/index.js";

suite("mcpInvestigationFoundation", () => {
  test("exposes start, get and list through canonical Pro MCP application services", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-investigation-"));
    try {
      const adapter = new DvqrMcpApplicationAdapter(investigationReadinessSemanticOperations, new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com"));
      const started = adapter.call(DVQR_MCP_TOOL_NAMES.startInvestigation, { question: "Investigate a failure" });
      assert.strictEqual(started.ok, true);
      if (!started.ok) return;
      const investigationId = (started.structuredContent as { investigationId: string }).investigationId;
      const loaded = adapter.call(DVQR_MCP_TOOL_NAMES.getInvestigation, { investigationId });
      assert.strictEqual(loaded.ok, true);
      if (loaded.ok) {
        const verification = (loaded.structuredContent as any).managedVerification;
        assert.strictEqual(verification.contractVersion, "dvqr-managed-investigation-verification-v1");
        assert.strictEqual(verification.evidenceCount, 0);
        assert.strictEqual(verification.firstMiniRcaGenerated, false);
        assert.strictEqual(verification.readinessState, "NotAssessed");
        assert.strictEqual(verification.miniRcaCheckpointState, "Missing");
      }
      const strategyRead = adapter.call(DVQR_MCP_TOOL_NAMES.getInvestigationStrategy, { investigationId });
      assert.strictEqual(strategyRead.ok, true);
      if (strategyRead.ok) {
        const strategyTruth = strategyRead.structuredContent as any;
        assert.strictEqual(strategyTruth.truthSource, "PersistedInvestigationJournal");
        assert.strictEqual(strategyTruth.readOnly, true);
        assert.ok(strategyTruth.strategy);
        assert.ok(strategyTruth.managedVerification);
        assert.strictEqual(strategyTruth.managedVerification.contractVersion, "dvqr-managed-investigation-verification-v1");
        assert.strictEqual(strategyTruth.managedVerification.stateConsistency.contractVersion, "dvqr-managed-investigation-state-consistency-v1");
        assert.strictEqual(strategyTruth.managedVerification.stateConsistency.isConsistent, true);
        assert.deepStrictEqual(strategyTruth.managedCompletionHistory, []);
        assert.deepStrictEqual(strategyTruth.miniRcaArtifactRefs, []);
      }
      const listed = adapter.call(DVQR_MCP_TOOL_NAMES.listInvestigations, {});
      assert.strictEqual(listed.ok, true);
      if (listed.ok) assert.strictEqual((listed.structuredContent as unknown[]).length, 1);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test("normalizes conversational table and record aliases into a persisted subject", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-investigation-alias-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const created = service.start({
        question: "Investigate this Contact",
        type: "investigation" as any,
        subject: { kind: "table" as any, table: "contact", recordId: "7d29eec7-4414-f111-8341-6045bdc42f8b" }
      });
      assert.strictEqual(created.type, "Record");
      assert.strictEqual(created.subject.kind, "Record");
      assert.strictEqual(created.subject.logicalName, "contact");
      assert.strictEqual(created.subject.recordIdMasked, "***bdc42f8b");
      assert.ok(!JSON.stringify(created).includes("7d29eec7-4414-f111-8341-6045bdc42f8b"));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("masks full record GUIDs from persisted title question and display label", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-privacy-"));
    const repo = new WorkspaceInvestigationRepository(root, "https://example.crm.dynamics.com");
    const service = new InvestigationApplicationService(repo, "https://example.crm.dynamics.com");
    const guid = "1c167d8a-0d35-ef11-8e4e-000d3a6a071d";
    const created = service.start({ question: `Investigate Contact ${guid}`, title: `Contact ${guid}`, subject: { kind: "Record", table: "contact", recordId: guid, displayLabel: `Contact ${guid}` } });
    assert.ok(!created.question.includes(guid));
    assert.ok(!created.title.includes(guid));
    assert.ok(!created.subject.displayLabel?.includes(guid));
    assert.match(created.question, /\*\*\*3a6a071d/);
  });

  test("Pass 10.3.1 binds an explicit Contact GUID in the question as a Record subject", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-investigation-record-inference-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const guid = "d15b208b-ee61-f011-bec2-0022489568de";
      const created = service.start({ question: `Start a managed investigation for Contact ${guid}. A Care Plan Activity was expected but appears not to have been created.` });
      assert.strictEqual(created.type, "Record");
      assert.strictEqual(created.subject.kind, "Record");
      assert.strictEqual(created.subject.logicalName, "contact");
      assert.strictEqual(created.subject.recordIdMasked, "***489568de");
      assert.doesNotMatch(created.question, new RegExp(guid, "i"));
      assert.doesNotMatch(created.title, new RegExp(guid, "i"));
      const persisted = fs.readFileSync(path.join(root, ".dvforgelab", "dvqr", "investigations", "active", `${created.investigationId}.json`), "utf8");
      assert.doesNotMatch(persisted, new RegExp(guid, "i"));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("Pass 10.3.1 completes a supplied table subject with a GUID found in the question", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-investigation-partial-record-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const created = service.start({
        question: "Investigate contact d15b208b-ee61-f011-bec2-0022489568de",
        subject: { kind: "Table", logicalName: "contact" }
      });
      assert.strictEqual(created.type, "Record");
      assert.strictEqual(created.subject.kind, "Record");
      assert.strictEqual(created.subject.logicalName, "contact");
      assert.strictEqual(created.subject.recordIdMasked, "***489568de");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("Pass 10.7.5.3 persists an asserted business traversal from prose without retaining GUIDs", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-investigation-asserted-path-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const guid = "d264ceff-8763-f011-bec2-002248985631";
      const created = service.start({ question: `Investigate contact ${guid}. The asserted business traversal is exactly: contact -> msemr_careplan -> msemr_careplanactivity -> sample_task. Use managed DVQR investigation only.` });
      assert.deepStrictEqual(created.assertedBusinessTraversal?.tables, ["contact", "msemr_careplan", "msemr_careplanactivity", "sample_task"]);
      assert.strictEqual(created.assertedBusinessTraversal?.source, "Question");
      const persisted = JSON.stringify(created);
      assert.doesNotMatch(persisted, new RegExp(guid, "i"));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });


  test("Pass 0.3 preserves a host-supplied custom logical name when the question uses an industry display label", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-subject-binding-domain-neutral-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const guid = "adb5efca-c866-f011-b4cb-000d3a6a75e8";
      const created = service.start({
        question: `Investigate Care Plan Activity ${guid}. I want to understand the downstream contoso_task.`,
        subject: { kind: "Record", logicalName: "contoso_careplanactivity", recordId: guid, displayLabel: `Care Plan Activity ${guid}` }
      });
      assert.strictEqual(created.subject.logicalName, "contoso_careplanactivity");
      assert.strictEqual(created.subjectBinding?.state, "HostSuppliedUnverified");
      assert.strictEqual(created.subjectBinding?.suppliedLogicalName, "contoso_careplanactivity");
      assert.strictEqual(created.subjectBinding?.resolvedLogicalName, "contoso_careplanactivity");
      assert.match(created.subjectBinding?.reason ?? "", /natural-language labels are not schema authority/i);
      assert.doesNotMatch(JSON.stringify(created), new RegExp(guid, "i"));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("Pass 0.3 does not invent an industry logical name from a display label when no logical name is supplied", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-subject-binding-no-schema-invention-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const guid = "adb5efca-c866-f011-b4cb-000d3a6a75e8";
      const created = service.start({ question: `Investigate Care Plan Activity ${guid}.` });
      assert.strictEqual(created.subject.kind, "Record");
      assert.strictEqual(created.subject.logicalName, undefined);
      assert.strictEqual(created.subjectBinding?.state, "HostSuppliedUnverified");
      assert.strictEqual(created.subjectBinding?.resolvedLogicalName, undefined);
      assert.match(created.subjectBinding?.reason ?? "", /without inventing a schema name/i);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("Pass 10.8.3 preserves an exact user-supplied logical name rather than overriding it from a display label", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-subject-binding-explicit-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const guid = "adb5efca-c866-f011-b4cb-000d3a6a75e8";
      const created = service.start({
        question: `Investigate mspp_careplanactivity ${guid}.`,
        subject: { kind: "Record", logicalName: "mspp_careplanactivity", recordId: guid }
      });
      assert.strictEqual(created.subject.logicalName, "mspp_careplanactivity");
      assert.strictEqual(created.subjectBinding?.state, "ExplicitLogicalName");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
