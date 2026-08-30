import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop,
  type BusinessPathRepository
} from "../../core/businessPaths/index.js";
import { McpBusinessPathManagementApplicationService } from "../../mcp/mcpBusinessPathManagementApplicationService.js";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import {
  DVQR_PROMPT_CATALOGUE,
  createDvqrPromptEvidenceMatrix,
  renderDvqrPrompt
} from "../../product/promptLibrary/index.js";
import { SaveOrVerifyBusinessPathService } from "../../runtime/businessPaths/saveOrVerifyBusinessPathService.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";

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

class MemoryBusinessPathRepository implements BusinessPathRepository {
  private readonly values = new Map<string, BusinessPathArtifact>();

  public list(): readonly BusinessPathArtifact[] {
    return [...this.values.values()];
  }

  public findById(id: string): BusinessPathArtifact | undefined {
    return this.values.get(id);
  }

  public findMatching(sourceTable: string, targetTable: string): readonly BusinessPathArtifact[] {
    const source = sourceTable.trim().toLowerCase();
    const target = targetTable.trim().toLowerCase();
    return this.list().filter((artifact) =>
      artifact.sourceTable.trim().toLowerCase() === source
      && artifact.targetTable.trim().toLowerCase() === target
    );
  }

  public save(artifact: BusinessPathArtifact): void {
    this.values.set(artifact.id, artifact);
  }

  public delete(id: string): boolean {
    return this.values.delete(id);
  }
}

suite("Security adversarial cross-surface semantic parity", () => {
  test("A17 Prompt Library capability authority is an exact projection of the live MCP catalogue", () => {
    const live = new Map(DVQR_LIVE_MCP_TOOLS.map((tool) => [tool.name, tool]));
    for (const prompt of DVQR_PROMPT_CATALOGUE) {
      const tool = live.get(prompt.capabilityTool);
      assert.ok(tool, `${prompt.id} must target a registered public capability`);
      assert.strictEqual(prompt.tier, tool!.tier, `${prompt.id} tier must match live capability authority`);
      assert.ok(prompt.capabilityTool.startsWith("dvqr_"), `${prompt.id} must not expose an internal handler id`);
    }
  });

  test("A17 Prompt Library rendering remains guidance-only and cannot bypass required input", () => {
    const prompt = DVQR_PROMPT_CATALOGUE.find((item) => item.parameters.some((parameter) => parameter.required));
    assert.ok(prompt);

    const missing = renderDvqrPrompt(prompt!, {});
    assert.strictEqual(missing.isReady, false);
    assert.ok(missing.missingRequiredParameters.length > 0);

    const renderedText = missing.text;
    assert.strictEqual(typeof renderedText, "string");
    assert.ok(missing.missingRequiredParameters.every((id) => renderedText.includes(`{{${id}}}`)));
  });

  test("A17 machine-readable Prompt evidence semantics preserve live tier and non-mutation boundaries", () => {
    const matrix = createDvqrPromptEvidenceMatrix();
    const live = new Map(DVQR_LIVE_MCP_TOOLS.map((tool) => [tool.name, tool]));

    assert.strictEqual(matrix.length, live.size);
    for (const entry of matrix) {
      const tool = live.get(entry.toolName);
      assert.ok(tool, entry.toolName);
      assert.strictEqual(entry.tier, tool!.tier, entry.toolName);
      assert.strictEqual(entry.mutatesDataverse, false, entry.toolName);
      assert.ok(entry.interpretationBoundary.length > 0, entry.toolName);
    }

    const relationshipRuntime = matrix.find((entry) => entry.toolName === "dvqr_validate_business_paths");
    assert.ok(relationshipRuntime);
    assert.ok(relationshipRuntime!.interpretationBoundary.some((line) => /does not prove causality/i.test(line)));
    assert.ok(relationshipRuntime!.interpretationBoundary.some((line) => /Empty and access-limited outcomes must remain distinct/i.test(line)));

    const miniRca = matrix.find((entry) => entry.toolName === "dvqr_generate_mini_rca");
    assert.ok(miniRca);
    assert.strictEqual(miniRca!.acquisition, "persisted-write");
    assert.ok(miniRca!.interpretationBoundary.some((line) => /not root-cause proof/i.test(line)));
  });

  test("A17 Guided Traversal and MCP derive identical canonical identity for the same exact route", async () => {
    const expectedId = businessPathId("contact", "account", hops);

    const guidedRepository = new MemoryBusinessPathRepository();
    const guided = new SaveOrVerifyBusinessPathService(
      guidedRepository,
      { nowIso: () => "2026-08-27T00:00:00.000Z" }
    ).execute({
      environmentId: "example.crm.dynamics.com",
      sourceTable: "contact",
      targetTable: "account",
      hops,
      traversalResultId: "guided-result-1",
      observedTargetRows: 3,
      userRequestedAction: "saveOrVerify"
    });

    assert.strictEqual(guided.artifact.id, expectedId);
    assert.strictEqual(guided.artifact.state, "saved");
    assert.strictEqual(guided.artifact.verification?.status, "verified");
    assert.strictEqual(guided.artifact.verification?.observedTargetRows, 3);

    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-cross-surface-"));
    try {
      const service = new McpBusinessPathManagementApplicationService({
        environmentUrl: "https://example.crm.dynamics.com",
        workspaceRoot: workspace,
        proEnabled: false,
        requestTimeoutMs: 1000,
        emitTextMirror: false,
        textMirrorMaxCharacters: 32768
      } as any);

      (service as any).metadata = {
        metadataContext: async () => ({
          baseEnvironmentUrl: "https://example.crm.dynamics.com",
          token: "token"
        }),
        fetchEntityCatalogue: async () => [{ LogicalName: "contact" }, { LogicalName: "account" }],
        fetchRelationships: async (_url: string, _token: string, logicalName: string) =>
          logicalName.toLowerCase() === "contact"
            ? [{
                fromTable: "contact",
                toTable: "account",
                navigationProperty: "parentcustomerid_account",
                relationshipSchemaName: "contact_customer_accounts",
                referencingAttribute: "parentcustomerid",
                relationshipType: "ManyToOne",
                direction: "manyToOne",
                collectionValued: false,
                polymorphicTargetQualified: true
              }]
            : []
      };

      const mcp = await service.save({
        name: "Contact to Account",
        sourceTable: "contact",
        targetTable: "account",
        intendedTables: ["contact", "account"],
        hops,
        confirmSave: true,
        environmentUrl: "https://example.crm.dynamics.com"
      });

      assert.strictEqual(mcp.ok, true);
      const content = (mcp as any).structuredContent;
      assert.strictEqual(content.path.id, expectedId);
      assert.deepStrictEqual(content.routeIntegrity.relationshipSchemaNames, ["contact_customer_accounts"]);

      // Semantic parity does not mean inventing evidence that one surface did not observe.
      // Guided Traversal arrived with bounded runtime evidence; manual MCP save did not.
      assert.strictEqual(content.path.verification.status, "not-runtime-verified");
      assert.strictEqual(guided.artifact.verification?.status, "verified");

      const persisted = new WorkspaceBusinessPathRepository(workspace).findById(expectedId);
      assert.ok(persisted);
      assert.strictEqual(persisted!.id, guided.artifact.id);
      assert.deepStrictEqual(
        persisted!.hops.map((hop) => hop.relationshipSchemaName),
        guided.artifact.hops.map((hop) => hop.relationshipSchemaName)
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("A17 equivalent route identity is stable regardless of display name or surface prose", () => {
    const first = businessPathId("contact", "account", hops);
    const second = businessPathId("CONTACT", "ACCOUNT", hops.map((hop) => ({
      ...hop,
      fromTable: hop.fromTable.toUpperCase(),
      toTable: hop.toTable.toUpperCase(),
      relationshipSchemaName: hop.relationshipSchemaName.toUpperCase()
    })));

    assert.strictEqual(first, second);
  });
});
