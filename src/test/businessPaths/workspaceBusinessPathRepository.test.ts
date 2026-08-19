import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  serializeBusinessPathArtifact,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";
import {
  WorkspaceBusinessPathRepository,
  businessPathWorkspaceRoot
} from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";

const firstHop: BusinessPathHop = {
  ordinal: 1,
  fromTable: "contact",
  toTable: "account",
  relationshipSchemaName: "contact_customer_accounts",
  relationshipType: "ManyToOne",
  direction: "forward",
  navigationProperty: "parentcustomerid_account",
  lookupAttribute: "parentcustomerid"
};

const taskHop: BusinessPathHop = {
  ordinal: 2,
  fromTable: "account",
  toTable: "task",
  relationshipSchemaName: "Account_Tasks",
  relationshipType: "OneToMany",
  direction: "forward",
  navigationProperty: "Account_Tasks",
  lookupAttribute: "regardingobjectid"
};

const directTaskHop: BusinessPathHop = {
  ordinal: 1,
  fromTable: "contact",
  toTable: "task",
  relationshipSchemaName: "Contact_Tasks",
  relationshipType: "OneToMany",
  direction: "forward",
  navigationProperty: "Contact_Tasks",
  lookupAttribute: "regardingobjectid"
};

function artifact(
  name: string,
  hops: readonly BusinessPathHop[] = [firstHop, taskHop],
  priority?: number
): BusinessPathArtifact {
  const sourceTable = "contact";
  const targetTable = "task";
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId(sourceTable, targetTable, hops),
    name,
    sourceTable,
    targetTable,
    state: "preferred",
    ...(priority !== undefined ? { priority } : {}),
    hops,
    provenance: {
      promotedFrom: "runtime-validation",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "verified",
      verifiedAt: "2026-08-18T00:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 2,
      bounded: true
    },
    applicability: { scope: "workspace" },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

suite("WorkspaceBusinessPathRepository", () => {
  let workspaceRoot: string;

  setup(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-business-paths-"));
  });

  teardown(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  test("uses the canonical DV ForgeLab DVQR workspace location", () => {
    assert.strictEqual(
      businessPathWorkspaceRoot(workspaceRoot),
      path.join(path.resolve(workspaceRoot), ".dvforgelab", "dvqr", "business-paths")
    );
  });

  test("returns an empty library without creating workspace files", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    assert.deepStrictEqual(repository.list(), []);
    assert.deepStrictEqual(repository.inspect(), { artifacts: [], diagnostics: [] });
    assert.strictEqual(fs.existsSync(businessPathWorkspaceRoot(workspaceRoot)), false);
  });

  test("saves one deterministic Git-friendly artifact", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const value = artifact("Contact to Task via Account");

    repository.save(value);

    const root = businessPathWorkspaceRoot(workspaceRoot);
    const files = fs.readdirSync(root);
    assert.deepStrictEqual(files, [`${value.id}.json`]);

    const text = fs.readFileSync(path.join(root, files[0]), "utf8");
    assert.strictEqual(text, serializeBusinessPathArtifact(value));
    assert.ok(text.endsWith("\n"));
    assert.ok(text.includes('"relationshipSchemaName": "contact_customer_accounts"'));
    assert.ok(!text.includes(workspaceRoot));
  });

  test("updates the same canonical path rather than creating a duplicate", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const first = artifact("Original name");
    const updated: BusinessPathArtifact = {
      ...first,
      name: "Reviewed name",
      description: "Institutional guidance.",
      updatedAt: "2026-08-18T01:00:00.000Z"
    };

    repository.save(first);
    repository.save(updated);

    assert.deepStrictEqual(fs.readdirSync(businessPathWorkspaceRoot(workspaceRoot)), [`${first.id}.json`]);
    assert.strictEqual(repository.findById(first.id)?.name, "Reviewed name");
    assert.strictEqual(repository.findById(first.id)?.description, "Institutional guidance.");
  });

  test("finds matching source and target case-insensitively", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const viaAccount = artifact("Via Account");
    const direct = artifact("Direct", [directTaskHop]);

    repository.save(viaAccount);
    repository.save(direct);

    assert.deepStrictEqual(
      repository.findMatching("CONTACT", "TASK").map((item) => item.id),
      repository.list().map((item) => item.id)
    );
    assert.deepStrictEqual(repository.findMatching("account", "task"), []);
  });

  test("orders matching paths deterministically by source target priority and stable id", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const lowerPriority = artifact("Lower priority", [firstHop, taskHop], 20);
    const higherPriority = artifact("Higher priority", [directTaskHop], 1);

    repository.save(lowerPriority);
    repository.save(higherPriority);

    assert.deepStrictEqual(
      repository.list().map((item) => item.id),
      [higherPriority.id, lowerPriority.id]
    );
  });

  test("isolates malformed artifacts instead of crashing normal reads", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const valid = artifact("Valid");
    repository.save(valid);

    const libraryRoot = businessPathWorkspaceRoot(workspaceRoot);
    fs.writeFileSync(path.join(libraryRoot, "broken.json"), "{not json", "utf8");

    const inspection = repository.inspect();
    assert.deepStrictEqual(inspection.artifacts.map((item) => item.id), [valid.id]);
    assert.strictEqual(inspection.diagnostics.length, 1);
    assert.strictEqual(inspection.diagnostics[0].code, "malformed-artifact");
    assert.strictEqual(inspection.diagnostics[0].fileName, "broken.json");
    assert.deepStrictEqual(repository.list().map((item) => item.id), [valid.id]);
  });

  test("reports duplicate valid artifacts and keeps the first deterministic file", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const value = artifact("Canonical");
    repository.save(value);

    const libraryRoot = businessPathWorkspaceRoot(workspaceRoot);
    fs.writeFileSync(
      path.join(libraryRoot, "aaa-duplicate.json"),
      serializeBusinessPathArtifact(value),
      "utf8"
    );

    const inspection = repository.inspect();
    assert.strictEqual(inspection.artifacts.length, 1);
    assert.strictEqual(inspection.artifacts[0].id, value.id);
    assert.ok(inspection.diagnostics.some((item) => item.code === "duplicate-artifact"));
  });

  test("save removes additional valid files claiming the same deterministic id", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const value = artifact("Canonical");
    const libraryRoot = businessPathWorkspaceRoot(workspaceRoot);
    fs.mkdirSync(libraryRoot, { recursive: true });
    fs.writeFileSync(path.join(libraryRoot, "legacy-copy.json"), serializeBusinessPathArtifact(value), "utf8");

    repository.save(value);

    assert.deepStrictEqual(fs.readdirSync(libraryRoot), [`${value.id}.json`]);
  });

  test("delete removes only the requested valid Business Path and preserves malformed files", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const viaAccount = artifact("Via Account");
    const direct = artifact("Direct", [directTaskHop]);
    repository.save(viaAccount);
    repository.save(direct);

    const libraryRoot = businessPathWorkspaceRoot(workspaceRoot);
    fs.writeFileSync(path.join(libraryRoot, "broken.json"), "{not json", "utf8");

    assert.strictEqual(repository.delete(viaAccount.id), true);
    assert.strictEqual(repository.findById(viaAccount.id), undefined);
    assert.strictEqual(repository.findById(direct.id)?.id, direct.id);
    assert.strictEqual(fs.existsSync(path.join(libraryRoot, "broken.json")), true);
  });

  test("rejects unsafe ids without traversing outside the managed library", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    assert.strictEqual(repository.findById("../../package"), undefined);
    assert.strictEqual(repository.delete("../../package"), false);
    assert.strictEqual(fs.existsSync(path.join(workspaceRoot, "package.json")), false);
  });

  test("leaves no temporary files after a successful atomic write", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    repository.save(artifact("Atomic"));

    const files = fs.readdirSync(businessPathWorkspaceRoot(workspaceRoot));
    assert.strictEqual(files.some((file) => file.endsWith(".tmp")), false);
  });

  test("returns clones so callers cannot mutate repository state in memory", () => {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const value = artifact("Immutable");
    repository.save(value);

    const listed = repository.list() as BusinessPathArtifact[];
    listed[0] = { ...listed[0], name: "Mutated externally" };

    assert.strictEqual(repository.findById(value.id)?.name, "Immutable");
  });
});
