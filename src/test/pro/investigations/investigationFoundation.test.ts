import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { InvestigationApplicationService, WorkspaceInvestigationRepository } from "../../../pro/investigations/index.js";

suite("investigationFoundation", () => {
  let root: string;
  setup(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-investigation-")); });
  teardown(() => fs.rmSync(root, { recursive: true, force: true }));

  test("starts, persists, reloads and indexes an environment-bound investigation", () => {
    const repository = new WorkspaceInvestigationRepository(root);
    const service = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com", () => new Date("2026-08-03T12:00:00.000Z"));
    const created = service.start({ question: "Investigate why registration failed", subject: { kind: "Record", logicalName: "contact", recordIdMasked: "***1234", displayLabel: "Contact ***1234" } });
    assert.match(created.investigationId, /^inv-/);
    assert.strictEqual(created.type, "Record");
    assert.strictEqual(created.status, "Active");
    assert.strictEqual(created.environmentId, "example.crm.dynamics.com");
    assert.strictEqual(created.environmentUrlHash?.length, 64);
    assert.deepStrictEqual(service.get(created.investigationId), created);
    assert.strictEqual(service.list().length, 1);
    assert.strictEqual(service.list()[0].investigationId, created.investigationId);
    const stored = fs.readFileSync(path.join(root, ".dvforgelab", "dvqr", "investigations", "active", `${created.investigationId}.json`), "utf8");
    assert.doesNotMatch(stored, /https:\/\//);
  });

  test("does not persist secret-like values", () => {
    const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
    assert.throws(() => service.start({ question: "access_token=secret", subject: { kind: "General" } }), /secret-like/i);
    assert.strictEqual(fs.existsSync(path.join(root, ".dvforgelab", "dvqr", "investigations", "index.json")), false);
  });

  test("filters the local index without acquiring evidence", () => {
    const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://one.crm.dynamics.com");
    service.start({ question: "First" });
    service.start({ question: "Second", environmentUrl: "https://two.crm.dynamics.com" });
    assert.strictEqual(service.list("one.crm.dynamics.com").length, 1);
    assert.strictEqual(service.list(undefined, "Active").length, 2);
  });

  test("refuses a corrupt index rather than silently overwriting it", () => {
    const investigationsRoot = path.join(root, ".dvforgelab", "dvqr", "investigations");
    fs.mkdirSync(investigationsRoot, { recursive: true });
    fs.writeFileSync(path.join(investigationsRoot, "index.json"), "{broken", "utf8");
    const service = new InvestigationApplicationService(new WorkspaceInvestigationRepository(root), "https://example.crm.dynamics.com");
    assert.throws(() => service.start({ question: "Do not overwrite" }), /corrupt/i);
  });
});
