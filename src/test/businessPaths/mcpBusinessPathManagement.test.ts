import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { McpBusinessPathManagementApplicationService } from "../../mcp/mcpBusinessPathManagementApplicationService.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { McpPreferredBusinessPathRuntimeValidationService } from "../../mcp/mcpPreferredBusinessPathRuntimeValidationService.js";
import { businessPathPromotionAuthorizations } from "../../mcp/mcpBusinessPathPromotionAuthorizationStore.js";
import type { BusinessPathHop } from "../../core/businessPaths/index.js";

const config = {
  environmentUrl: "https://example.crm.dynamics.com",
  tenantId: undefined,
  proEnabled: false,
  requestTimeoutMs: 1000,
  emitTextMirror: true,
  textMirrorMaxCharacters: 32768
};

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

suite("MCP Managed Business Path management", () => {
  let workspace: string;
  let previousWorkspace: string | undefined;

  setup(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-business-paths-"));
    previousWorkspace = process.env.DVQR_MCP_WORKSPACE_ROOT;
    process.env.DVQR_MCP_WORKSPACE_ROOT = workspace;
  });

  teardown(() => {
    if (previousWorkspace === undefined) {
      delete process.env.DVQR_MCP_WORKSPACE_ROOT;
    } else {
      process.env.DVQR_MCP_WORKSPACE_ROOT = previousWorkspace;
    }
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function serviceWithMetadata() {
    const service = new McpBusinessPathManagementApplicationService({ ...config, workspaceRoot: workspace } as any);
    (service as any).metadata = {
      metadataContext: async () => ({
        baseEnvironmentUrl: "https://example.crm.dynamics.com",
        token: "token"
      }),
      fetchEntityCatalogue: async () => [
        { LogicalName: "contact" },
        { LogicalName: "account" }
      ],
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
    return service;
  }


  test("fails explicitly when the MCP host did not bind a workspace root", async () => {
    const unbound = new McpBusinessPathManagementApplicationService(config as any);
    const result = await unbound.list({});
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /explicit VS Code workspace root/i);
    assert.strictEqual((result.structuredContent as any).workspace.available, false);
  });

  test("persists across MCP application-service instances bound to the same workspace", async () => {
    const first = serviceWithMetadata();
    const saved = await first.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);

    const second = serviceWithMetadata();
    const listed = await second.list({});
    assert.strictEqual(listed.ok, true);
    if (!listed.ok) return;
    const content = listed.structuredContent as any;
    assert.strictEqual(content.resultCount, 1);
    assert.strictEqual(content.workspace.workspaceRoot, workspace);
    assert.strictEqual(
      content.workspace.businessPathDirectory,
      path.join(workspace, ".dvforgelab", "dvqr", "business-paths")
    );
  });

  test("keeps Managed Business Paths workspace-scoped across different MCP bindings", async () => {
    const first = serviceWithMetadata();
    const saved = await first.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);

    const otherWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-mcp-other-workspace-"));
    try {
      const other = new McpBusinessPathManagementApplicationService({
        ...config,
        workspaceRoot: otherWorkspace
      } as any);
      const listed = await other.list({});
      assert.strictEqual(listed.ok, true);
      if (!listed.ok) return;
      assert.strictEqual((listed.structuredContent as any).resultCount, 0);
      assert.strictEqual((listed.structuredContent as any).workspace.workspaceRoot, otherWorkspace);
    } finally {
      fs.rmSync(otherWorkspace, { recursive: true, force: true });
    }
  });



  test("saves an authorized runtime-validated route without trusting host reconstruction", async () => {
    const service = serviceWithMetadata();
    const authorization = businessPathPromotionAuthorizations.issue({
      sourceTable: "contact",
      targetTable: "account",
      sourceRecordId: "record-validated",
      environmentIdentity: "example.crm.dynamics.com",
      pathId: "contact:contact_customer_accounts:account",
      tables: ["contact", "account"],
      relationshipSchemaNames: ["contact_customer_accounts"],
      hops,
      observedTargetRows: 4
    });

    const result = await service.save({
      promotionAuthorizationId: authorization.authorizationId,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });

    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.promotionMode, "AuthorizedRuntimeValidation");
    assert.strictEqual(content.pathNameSource, "DvqrSuggested");
    assert.strictEqual(content.path.name, "contact to account");
    assert.strictEqual(content.promotionAuthorization.consumed, true);
    assert.deepStrictEqual(content.intendedTables, ["contact", "account"]);
    assert.strictEqual(content.routeIntegrity.matched, true);
    assert.match(content.routeIntegrity.rule, /server-held promotion authorization/i);
    assert.strictEqual(content.path.verification.status, "verified");
    assert.strictEqual(content.path.verification.observedTargetRows, 4);
    assert.strictEqual(content.path.provenance.promotedFrom, "runtime-validation");
    assert.strictEqual(businessPathPromotionAuthorizations.get(authorization.authorizationId), undefined);
  });

  test("rejects host attempts to rewrite an authorized route", async () => {
    const service = serviceWithMetadata();
    const authorization = businessPathPromotionAuthorizations.issue({
      sourceTable: "contact",
      targetTable: "account",
      sourceRecordId: "record-validated",
      environmentIdentity: "example.crm.dynamics.com",
      pathId: "contact:contact_customer_accounts:account",
      tables: ["contact", "account"],
      relationshipSchemaNames: ["contact_customer_accounts"],
      hops,
      observedTargetRows: 4
    });

    const result = await service.save({
      name: "Wrong route",
      promotionAuthorizationId: authorization.authorizationId,
      intendedTables: ["contact", "careplan", "account"],
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /does not match the authorized promotion route/i);
    assert.ok(businessPathPromotionAuthorizations.get(authorization.authorizationId), "failed save must not consume authorization");
    assert.deepStrictEqual(new WorkspaceBusinessPathRepository(workspace).list(), []);
  });

  test("rejects reuse of a consumed promotion authorization", async () => {
    const service = serviceWithMetadata();
    const authorization = businessPathPromotionAuthorizations.issue({
      sourceTable: "contact",
      targetTable: "account",
      sourceRecordId: "record-validated",
      environmentIdentity: "example.crm.dynamics.com",
      pathId: "contact:contact_customer_accounts:account",
      tables: ["contact", "account"],
      relationshipSchemaNames: ["contact_customer_accounts"],
      hops,
      observedTargetRows: 4
    });

    const first = await service.save({
      name: "Contact to Account",
      promotionAuthorizationId: authorization.authorizationId,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(first.ok, true);

    const replay = await service.save({
      name: "Replay",
      promotionAuthorizationId: authorization.authorizationId,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(replay.ok, false);
    if (replay.ok) return;
    assert.match(replay.message, /missing, expired, already consumed/i);
  });

  test("rejects saving a runtime shortcut when it differs from the selected business traversal", async () => {
    const service = serviceWithMetadata();
    const result = await service.save({
      name: "Contact to Task via Care Plan",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "careplan", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /route being saved differs from the selected\/asserted business traversal/i);
    assert.match(result.message, /contact → careplan → account/i);
    assert.match(result.message, /contact → account/i);
    assert.deepStrictEqual(new WorkspaceBusinessPathRepository(workspace).list(), []);
  });

  test("requires explicit save confirmation before any mutation", async () => {
    const service = serviceWithMetadata();
    const result = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      hops
    });

    assert.strictEqual(result.ok, false);
    if (result.ok) throw new Error("Expected failure.");
    assert.match(result.message, /confirmSave=true/i);
    assert.deepStrictEqual(new WorkspaceBusinessPathRepository(workspace).list(), []);
  });

  test("saves only after exact current metadata validates the route", async () => {
    const service = serviceWithMetadata();
    const result = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });

    assert.strictEqual(result.ok, true);
    if (!result.ok) throw new Error("Expected Business Path save to succeed.");
    const content = result.structuredContent as any;
    assert.strictEqual(content.metadataValidation.state, "valid");
    assert.strictEqual(content.path.state, "preferred");
    assert.strictEqual(content.path.verification.status, "not-runtime-verified");
    assert.strictEqual(new WorkspaceBusinessPathRepository(workspace).list().length, 1);
  });

  test("rejects a stale exact relationship before persistence", async () => {
    const service = serviceWithMetadata();
    (service as any).metadata.fetchRelationships = async () => [];

    const result = await service.save({
      name: "Stale route",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });

    assert.strictEqual(result.ok, false);
    const failureMessage = "message" in result ? result.message : "";
    assert.match(failureMessage, /cannot be saved/i);
    assert.deepStrictEqual(new WorkspaceBusinessPathRepository(workspace).list(), []);
  });

  test("lists, gets and revalidates the canonical saved artifact", async () => {
    const service = serviceWithMetadata();
    const saved = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);
    const pathId = (saved as any).structuredContent.path.id;

    const listed = await service.list({});
    assert.strictEqual(listed.ok, true);
    assert.strictEqual((listed as any).structuredContent.resultCount, 1);

    const loaded = await service.get({ pathId });
    assert.strictEqual(loaded.ok, true);
    assert.strictEqual((loaded as any).structuredContent.path.id, pathId);

    const revalidated = await service.revalidate({
      pathId,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(revalidated.ok, true);
    assert.strictEqual((revalidated as any).structuredContent.validation.state, "valid");
  });


  test("canonically tests the exact saved path and refreshes verification only after runtime success", async () => {
    const service = serviceWithMetadata();
    const saved = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);
    const pathId = (saved as any).structuredContent.path.id;

    const original = McpPreferredBusinessPathRuntimeValidationService.prototype.validatePreferredPath;
    try {
      McpPreferredBusinessPathRuntimeValidationService.prototype.validatePreferredPath = async function(request: any) {
        assert.strictEqual(request.artifact.id, pathId);
        assert.strictEqual(request.revalidation.state, "valid");
        assert.strictEqual(request.sourceRecordId, "record-1");
        return {
          ok: true,
          summary: "Exact saved path reached target.",
          structuredContent: {
            assertedBusinessTraversal: {
              pathId: "contact:contact_customer_accounts:account",
              runtimeStatus: "RuntimeViable",
              reachedTarget: true
            },
            validatedPaths: [{
              pathId: "contact:contact_customer_accounts:account",
              runtimeStatus: "RuntimeViable",
              reachedTarget: true,
              observedTargetRecordCount: 4
            }]
          }
        } as any;
      };

      const result = await service.test({
        pathId,
        sourceRecordId: "record-1",
        environmentUrl: "https://example.crm.dynamics.com"
      });

      assert.strictEqual(result.ok, true);
      const content = (result as any).structuredContent;
      assert.strictEqual(content.currentRuntimeObservation.runtimeStatus, "RuntimeViable");
      assert.strictEqual(content.currentRuntimeObservation.reachedTarget, true);
      assert.strictEqual(content.currentRuntimeObservation.observedTargetRows, 4);
      assert.strictEqual(content.verificationRefresh.refreshed, true);

      const persisted = new WorkspaceBusinessPathRepository(workspace).findById(pathId)!;
      assert.strictEqual(persisted.verification?.status, "verified");
      assert.strictEqual(persisted.verification?.observedTargetRows, 4);
      assert.strictEqual(persisted.verification?.environment?.identity, "example.crm.dynamics.com");
    } finally {
      McpPreferredBusinessPathRuntimeValidationService.prototype.validatePreferredPath = original;
    }
  });

  test("a later empty current run never downgrades earlier successful verification", async () => {
    const service = serviceWithMetadata();
    const saved = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);
    const pathId = (saved as any).structuredContent.path.id;

    const repository = new WorkspaceBusinessPathRepository(workspace);
    const current = repository.findById(pathId)!;
    repository.save({
      ...current,
      verification: {
        status: "verified",
        environment: { identity: "example.crm.dynamics.com" },
        verifiedAt: "2026-08-18T03:00:00.000Z",
        testedSourceCount: 1,
        reachedTargetCount: 1,
        observedTargetRows: 3,
        bounded: true
      },
      applicability: {
        scope: "workspace",
        verifiedEnvironmentIds: ["example.crm.dynamics.com"]
      }
    });

    const original = McpPreferredBusinessPathRuntimeValidationService.prototype.validatePreferredPath;
    try {
      McpPreferredBusinessPathRuntimeValidationService.prototype.validatePreferredPath = async function() {
        return {
          ok: true,
          summary: "No continuation.",
          structuredContent: {
            assertedBusinessTraversal: {
              pathId: "contact:contact_customer_accounts:account",
              runtimeStatus: "NoContinuationObserved",
              reachedTarget: false
            },
            validatedPaths: [{
              pathId: "contact:contact_customer_accounts:account",
              runtimeStatus: "NoContinuationObserved",
              reachedTarget: false,
              observedTargetRecordCount: 0
            }]
          }
        } as any;
      };

      const result = await service.test({
        pathId,
        sourceRecordId: "record-empty",
        environmentUrl: "https://example.crm.dynamics.com"
      });

      assert.strictEqual(result.ok, true);
      const content = (result as any).structuredContent;
      assert.strictEqual(content.currentRuntimeObservation.runtimeStatus, "NoContinuationObserved");
      assert.strictEqual(content.verificationRefresh.refreshed, false);

      const persisted = repository.findById(pathId)!;
      assert.strictEqual(persisted.verification?.status, "verified");
      assert.strictEqual(persisted.verification?.verifiedAt, "2026-08-18T03:00:00.000Z");
      assert.strictEqual(persisted.verification?.observedTargetRows, 3);
    } finally {
      McpPreferredBusinessPathRuntimeValidationService.prototype.validatePreferredPath = original;
    }
  });

  test("requires explicit delete confirmation and removes workspace preference only", async () => {
    const service = serviceWithMetadata();
    const saved = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);
    const pathId = (saved as any).structuredContent.path.id;

    const refused = await service.remove({ pathId });
    assert.strictEqual(refused.ok, false);
    assert.strictEqual(new WorkspaceBusinessPathRepository(workspace).list().length, 1);

    const removed = await service.remove({ pathId, confirmDelete: true });
    assert.strictEqual(removed.ok, true);
    assert.strictEqual((removed as any).structuredContent.deleted, true);
    assert.deepStrictEqual(new WorkspaceBusinessPathRepository(workspace).list(), []);
  });

  test("disabled paths are hidden from default list but remain inspectable with includeDisabled", async () => {
    const service = serviceWithMetadata();
    const saved = await service.save({
      name: "Contact to Account",
      sourceTable: "contact",
      targetTable: "account",
      intendedTables: ["contact", "account"],
      hops,
      confirmSave: true,
      environmentUrl: "https://example.crm.dynamics.com"
    });
    assert.strictEqual(saved.ok, true);
    const pathId = (saved as any).structuredContent.path.id;

    const repository = new WorkspaceBusinessPathRepository(workspace);
    const artifact = repository.findById(pathId)!;
    repository.save({ ...artifact, state: "disabled", updatedAt: "2026-08-18T10:00:00.000Z" });

    const defaultList = await service.list({});
    assert.strictEqual((defaultList as any).structuredContent.resultCount, 0);

    const fullList = await service.list({ includeDisabled: true });
    assert.strictEqual((fullList as any).structuredContent.resultCount, 1);
    assert.strictEqual((fullList as any).structuredContent.paths[0].state, "disabled");
  });
});
