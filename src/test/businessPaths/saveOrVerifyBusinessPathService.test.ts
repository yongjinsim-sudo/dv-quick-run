import * as assert from "assert";
import type { BusinessPathArtifact, BusinessPathRepository } from "../../core/businessPaths/index.js";
import { SaveOrVerifyBusinessPathService } from "../../runtime/businessPaths/saveOrVerifyBusinessPathService.js";

class MemoryRepository implements BusinessPathRepository {
  private items: BusinessPathArtifact[] = [];
  list(): readonly BusinessPathArtifact[] { return this.items; }
  findById(id: string): BusinessPathArtifact | undefined { return this.items.find((item) => item.id === id); }
  findMatching(sourceTable: string, targetTable: string): readonly BusinessPathArtifact[] {
    return this.items.filter((item) => item.sourceTable === sourceTable && item.targetTable === targetTable);
  }
  save(artifact: BusinessPathArtifact): void {
    this.items = [...this.items.filter((item) => item.id !== artifact.id), artifact];
  }
  delete(id: string): boolean {
    const before = this.items.length; this.items = this.items.filter((item) => item.id !== id); return before !== this.items.length;
  }
}

const hops = [{
  ordinal: 1,
  fromTable: "contact",
  toTable: "task",
  relationshipSchemaName: "contact_tasks",
  relationshipType: "OneToMany" as const,
  direction: "forward" as const,
  navigationProperty: "contact_tasks"
}];

suite("SaveOrVerifyBusinessPathService", () => {
  test("creates saved guidance without silently making it BusinessPreferred", () => {
    const repository = new MemoryRepository();
    const service = new SaveOrVerifyBusinessPathService(repository, { nowIso: () => "2026-08-20T06:00:00.000Z" });
    const result = service.execute({
      environmentId: "https://dev.crm6.dynamics.com",
      sourceTable: "contact",
      targetTable: "task",
      hops,
      observedTargetRows: 2,
      userRequestedAction: "saveOrVerify"
    });
    assert.strictEqual(result.outcome, "Created");
    assert.strictEqual(result.artifact.state, "saved");
    assert.strictEqual(repository.list().length, 1);
  });

  test("reverification is idempotent and preserves preference governance", () => {
    const repository = new MemoryRepository();
    new SaveOrVerifyBusinessPathService(repository, { nowIso: () => "2026-08-20T06:00:00.000Z" }).execute({
      environmentId: "https://dev.crm6.dynamics.com", sourceTable: "contact", targetTable: "task", hops,
      userRequestedAction: "saveOrVerify"
    });
    const first = repository.list()[0];
    repository.save({ ...first, state: "preferred", name: "Human governed path" });
    const result = new SaveOrVerifyBusinessPathService(repository, { nowIso: () => "2026-08-20T07:00:00.000Z" }).execute({
      environmentId: "https://dev.crm6.dynamics.com", sourceTable: "contact", targetTable: "task", hops,
      observedTargetRows: 3, userRequestedAction: "saveOrVerify"
    });
    assert.strictEqual(result.outcome, "VerifiedExisting");
    assert.strictEqual(repository.list().length, 1);
    assert.strictEqual(result.artifact.id, first.id);
    assert.strictEqual(result.artifact.state, "preferred");
    assert.strictEqual(result.artifact.name, "Human governed path");
    assert.strictEqual(result.artifact.verification?.verifiedAt, "2026-08-20T07:00:00.000Z");
  });
});
