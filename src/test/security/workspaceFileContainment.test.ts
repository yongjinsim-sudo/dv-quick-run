import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { WorkspaceInvestigationJournalRepository } from "../../pro/investigations/investigationJournal.js";
import { assertWorkspaceContainedPath } from "../../utils/workspacePathSecurity.js";

const hops: readonly BusinessPathHop[] = [{
  ordinal: 1,
  fromTable: "contact",
  toTable: "account",
  relationshipSchemaName: "contact_customer_accounts",
  relationshipType: "ManyToOne",
  direction: "forward",
  navigationProperty: "parentcustomerid_account",
  lookupAttribute: "parentcustomerid"
}];

function artifact(name: string): BusinessPathArtifact {
  const id = businessPathId("contact", "account", hops);
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id,
    name,
    sourceTable: "contact",
    targetTable: "account",
    state: "preferred",
    hops,
    provenance: {
      promotedFrom: "manual-reviewed",
      promotedAt: "2026-08-27T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: { status: "not-runtime-verified", bounded: true },
    applicability: { scope: "workspace" },
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z"
  };
}

suite("Security adversarial workspace and file containment", () => {
  let workspace: string;

  setup(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-workspace-containment-"));
  });

  teardown(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test("A12 rejects lexical traversal, absolute escape and sibling-prefix confusion", () => {
    const outside = path.resolve(workspace, "..", "outside.json");
    assert.throws(
      () => assertWorkspaceContainedPath(workspace, outside),
      /outside the bound workspace/i
    );

    const sibling = `${path.resolve(workspace)}-evil`;
    assert.throws(
      () => assertWorkspaceContainedPath(workspace, path.join(sibling, "file.json")),
      /outside the bound workspace/i
    );

    const absolute = process.platform === "win32"
      ? "C:\\Windows\\Temp\\dvqr-escape.json"
      : "/tmp/dvqr-escape.json";
    if (!path.resolve(absolute).startsWith(path.resolve(workspace) + path.sep)) {
      assert.throws(
        () => assertWorkspaceContainedPath(workspace, absolute),
        /outside the bound workspace/i
      );
    }
  });

  test("A12 encoded/path-shaped Business Path ids cannot select a filesystem destination", () => {
    const repository = new WorkspaceBusinessPathRepository(workspace);
    for (const malicious of [
      "../outside",
      "..%2foutside",
      "%2e%2e%5coutside",
      "C:\\temp\\outside",
      "\\\\server\\share\\outside",
      "CON",
      "NUL",
      "bp_deadbeef.json",
      "bp_deadbeef/../../outside"
    ]) {
      assert.strictEqual(repository.findById(malicious), undefined, malicious);
      assert.strictEqual(repository.delete(malicious), false, malicious);
    }
  });

  test("A20 hostile Business Path display text never controls the persisted filename", () => {
    const repository = new WorkspaceBusinessPathRepository(workspace);
    const hostileName = "..\\..\\CON:../../outside.json";
    const value = artifact(hostileName);
    repository.save(value);

    const directory = path.join(workspace, ".dvforgelab", "dvqr", "business-paths");
    const files = fs.readdirSync(directory);
    assert.deepStrictEqual(files, [`${value.id}.json`]);
    assert.strictEqual(fs.existsSync(path.resolve(workspace, "..", "outside.json")), false);
  });

  test("A12 journal rejects traversal/absolute/reserved investigation ids before write", () => {
    const journal = new WorkspaceInvestigationJournalRepository(workspace);
    for (const malicious of [
      "../outside",
      "..%2foutside",
      "C:\\temp\\outside",
      "\\\\server\\share\\outside",
      "CON",
      "NUL",
      "inv-../../outside"
    ]) {
      assert.throws(
        () => journal.append({
          investigationId: malicious,
          occurredAt: "2026-08-27T00:00:00.000Z",
          kind: "EvidenceFailed",
          summary: "hostile id must not become a path",
          providerId: "test",
          outcome: "Failed"
        }),
        /Invalid investigation ID/i,
        malicious
      );
      assert.deepStrictEqual(journal.list(malicious), []);
    }
  });

  test("A12 existing managed-directory symlink/junction cannot redirect a Business Path write outside workspace", function() {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-external-"));
    try {
      const repository = new WorkspaceBusinessPathRepository(workspace);
      const managedParent = path.join(workspace, ".dvforgelab", "dvqr");
      fs.mkdirSync(managedParent, { recursive: true });
      const managedRoot = path.join(managedParent, "business-paths");

      try {
        fs.symlinkSync(external, managedRoot, process.platform === "win32" ? "junction" : "dir");
      } catch {
        // Some locked-down runners disallow link creation. The lexical containment
        // tests still run everywhere; skip only this platform-specific filesystem case.
        this.skip();
        return;
      }

      assert.throws(
        () => repository.save(artifact("Symlink escape attempt")),
        /redirected outside the bound workspace/i
      );
      assert.deepStrictEqual(fs.readdirSync(external), []);
    } finally {
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  test("A12 investigation journal write cannot follow a managed junction outside workspace", function() {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-journal-external-"));
    try {
      const journal = new WorkspaceInvestigationJournalRepository(workspace);
      const managedParent = path.join(workspace, ".dvforgelab", "dvqr", "investigations");
      fs.mkdirSync(managedParent, { recursive: true });
      const journalRoot = path.join(managedParent, "journal");

      try {
        fs.symlinkSync(external, journalRoot, process.platform === "win32" ? "junction" : "dir");
      } catch {
        this.skip();
        return;
      }

      assert.throws(
        () => journal.append({
          investigationId: "inv-00000000-0000-0000-0000-000000000001",
          occurredAt: "2026-08-27T00:00:00.000Z",
          kind: "EvidenceFailed",
          summary: "must remain inside workspace",
          providerId: "test",
          outcome: "Failed"
        }),
        /redirected outside the bound workspace/i
      );
      assert.deepStrictEqual(fs.readdirSync(external), []);
    } finally {
      fs.rmSync(external, { recursive: true, force: true });
    }
  });


  test("A12 containment helper permits canonical managed paths inside the bound workspace", () => {
    const target = path.join(workspace, ".dvforgelab", "dvqr", "business-paths", "bp_deadbeef.json");
    assert.doesNotThrow(() => assertWorkspaceContainedPath(workspace, target));
  });
});
