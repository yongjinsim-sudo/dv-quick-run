import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { InvestigationApplicationService } from "../../pro/investigations/investigationApplicationService.js";
import { InvestigationEvidenceAcquisitionService } from "../../pro/investigations/investigationEvidenceAcquisitionService.js";
import { InvestigationEvidenceProviderRegistry, MetadataInvestigationEvidenceProvider } from "../../pro/investigations/investigationEvidenceProvider.js";
import { WorkspaceInvestigationEvidenceRepository } from "../../pro/investigations/investigationEvidenceRepository.js";
import { WorkspaceInvestigationJournalRepository } from "../../pro/investigations/investigationJournal.js";
import { WorkspaceInvestigationRepository } from "../../pro/investigations/investigationRepository.js";

suite("mcpInvestigationFrameworkMaturation", () => {
  test("isolates investigation lists by Dataverse environment", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass42-env-"));
    try {
      const firstUrl = "https://first.crm.dynamics.com";
      const secondUrl = "https://second.crm.dynamics.com";
      const first = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root, firstUrl), firstUrl);
      const second = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root, secondUrl), secondUrl);
      const firstInvestigation = first.start({ question: "First", subject: { table: "contact" } });
      const secondInvestigation = second.start({ question: "Second", subject: { table: "account" } });
      assert.deepStrictEqual(first.list().map((item) => item.investigationId), [firstInvestigation.investigationId]);
      assert.deepStrictEqual(second.list().map((item) => item.investigationId), [secondInvestigation.investigationId]);
      assert.strictEqual(first.get(secondInvestigation.investigationId), undefined);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("migrates legacy investigations into environment scopes idempotently", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass42-migrate-"));
    try {
      const url = "https://example.crm.dynamics.com";
      const legacyRepository = new WorkspaceInvestigationRepository(root);
      const created = new InvestigationApplicationService(legacyRepository, url).start({ question: "Legacy", subject: { table: "contact" } });
      const scoped = new WorkspaceInvestigationRepository(root, url);
      assert.strictEqual(scoped.get(created.investigationId)?.investigationId, created.investigationId);
      assert.strictEqual(new WorkspaceInvestigationRepository(root, url).list().length, 1);
      assert.strictEqual(fs.existsSync(path.join(root, ".dvforgelab", "dvqr", "investigations", "active", `${created.investigationId}.json`)), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("keeps exactly one current strategy step and does not complete evidence-managed work by continuation alone", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass42-strategy-"));
    try {
      const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
      const created = service.start({ question: "Investigate", subject: { table: "contact" } });
      service.continue(created.investigationId);
      const second = service.continue(created.investigationId);
      assert.strictEqual(second.investigation.strategy?.steps.filter((step) => step.status === "Current").length, 1);
      assert.deepStrictEqual(second.investigation.strategy?.steps.slice(0, 2).map((step) => step.status), ["Completed", "Current"]);
      assert.strictEqual(second.statusCard.evidenceCount, 0);
      assert.strictEqual(second.statusCard.readiness, "NotAssessed");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("reuses unchanged metadata evidence and records a structured journal event", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass42-dedupe-"));
    try {
      const url = "https://example.crm.dynamics.com";
      const repository = new WorkspaceInvestigationRepository(root, url);
      const investigation = new InvestigationApplicationService(repository, url).start({ question: "Investigate", subject: { table: "contact" } });
      const evidence = new WorkspaceInvestigationEvidenceRepository(root, url);
      const journal = new WorkspaceInvestigationJournalRepository(root, url);
      const acquisition = new InvestigationEvidenceAcquisitionService(repository, evidence, new InvestigationEvidenceProviderRegistry([new MetadataInvestigationEvidenceProvider()]), journal);
      const rawResult = { ok: true, summary: "Metadata retrieved.", structuredContent: { entity: { LogicalName: "contact", PrimaryIdAttribute: "contactid" } } };
      const first = acquisition.record({ investigationId: investigation.investigationId, providerId: "metadata", rawResult });
      const second = acquisition.record({ investigationId: investigation.investigationId, providerId: "metadata", rawResult });
      assert.strictEqual(first.reusedExisting, false);
      assert.strictEqual(second.reusedExisting, true);
      assert.strictEqual(second.evidence.evidenceId, first.evidence.evidenceId);
      assert.strictEqual(evidence.list(investigation.investigationId).length, 1);
      assert.strictEqual(repository.get(investigation.investigationId)?.evidenceRefs.length, 1);
      const journalEntries = journal.list(investigation.investigationId);
      assert.strictEqual(journalEntries[journalEntries.length - 1]?.outcome, "Reused");
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
