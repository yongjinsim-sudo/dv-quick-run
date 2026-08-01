import * as assert from "assert";
import type { CustomApiDefinition } from "../../customApi/models/customApiTypes.js";
import { McpCustomApiApplicationService, type McpCustomApiRepositoryLike } from "../../mcp/mcpCustomApiApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm6.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

const definitions: CustomApiDefinition[] = [
  {
    id: "1", uniqueName: "new_GetSummary", displayName: "Get Summary", description: "Returns a summary",
    operationKind: "Function", bindingKind: "Unbound", boundTargetKind: "none", isPrivate: false,
    requestParameters: [{ uniqueName: "Text", type: "10", typeLabel: "String", typeCategory: "primitive" }],
    responseProperties: [{ uniqueName: "Summary", type: "10", typeLabel: "String" }]
  },
  {
    id: "2", uniqueName: "new_RunPrivateAction", displayName: "Private action",
    operationKind: "Action", bindingKind: "Bound", boundTargetKind: "entity", boundEntityLogicalName: "account", isPrivate: true,
    requestParameters: [], responseProperties: []
  },
  {
    id: "3", uniqueName: "new_StartProcess", displayName: "Start process",
    operationKind: "Action", bindingKind: "Unbound", boundTargetKind: "none", isPrivate: false,
    requestParameters: [{ uniqueName: "Enabled", typeLabel: "Boolean", typeCategory: "primitive" }], responseProperties: []
  },
  {
    id: "4", uniqueName: "new_UpdateAccounts", displayName: "Update accounts",
    operationKind: "Action", bindingKind: "Bound", boundTargetKind: "collection", boundEntityLogicalName: "account", isPrivate: false,
    requestParameters: [], responseProperties: []
  }
];

const repository: McpCustomApiRepositoryLike = {
  async discover() { return { definitions }; }
};

suite("mcpCustomApiApplicationService", () => {
  test("discovers all public operation and binding kinds by default with summary counts", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({});
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.contractVersion, "dvqr-mcp-custom-api-catalogue-v2");
    assert.strictEqual(content.totalMatching, 3);
    assert.strictEqual(content.returned, 3);
    assert.strictEqual(content.summary.actions, 2);
    assert.strictEqual(content.summary.functions, 1);
    assert.strictEqual(content.summary.global, 2);
    assert.strictEqual(content.summary.entityCollectionBound, 1);
    assert.strictEqual(content.summary.privateExcluded, 1);
    assert.deepStrictEqual(Object.keys(content.definitions[0]).sort(), ["bindingKind", "operationKind", "uniqueName"]);
    assert.ok(result.displayText?.includes("Custom APIs: 3 of 3 matching definitions"));
    assert.ok(result.displayText?.includes("use dvqr_get_custom_api_definition"));
  });

  test("treats an omitted query and an explicit empty query identically", async () => {
    const service = new McpCustomApiApplicationService(config, repository);
    const omitted = await service.discover({ maxResults: 2 });
    const explicit = await service.discover({ query: "", maxResults: 2 });
    assert.strictEqual(omitted.ok, true);
    assert.strictEqual(explicit.ok, true);
    if (!omitted.ok || !explicit.ok) return;
    const omittedContent = omitted.structuredContent as any;
    const explicitContent = explicit.structuredContent as any;
    assert.strictEqual(omittedContent.filters.query, "");
    assert.strictEqual(explicitContent.filters.query, "");
    assert.deepStrictEqual(omittedContent.definitions, explicitContent.definitions);
    assert.strictEqual(omittedContent.totalMatching, explicitContent.totalMatching);
    assert.strictEqual(omitted.displayText, explicit.displayText);
  });

  test("supports public binding filters without exposing Unknown as a selectable filter", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({ bindingKind: "EntityCollection" });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      const content = result.structuredContent as any;
      assert.strictEqual(content.totalMatching, 1);
      assert.strictEqual(content.definitions[0].uniqueName, "new_UpdateAccounts");
      assert.strictEqual(content.definitions[0].description, undefined);
    }
    const invalid = await new McpCustomApiApplicationService(config, repository).discover({ bindingKind: "Unknown" });
    assert.strictEqual(invalid.ok, false);
    if (!invalid.ok) assert.strictEqual(invalid.code, "InvalidArguments");
  });

  test("supports summary detail without returning full definitions", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({ detailLevel: "summary" });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      const item = (result.structuredContent as any).definitions[0];
      assert.strictEqual(item.displayName, "Get Summary");
      assert.strictEqual(item.description, "Returns a summary");
      assert.strictEqual(item.requestParameters, undefined);
    }
  });

  test("supports explicit private metadata discovery", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({ includePrivate: true });
    assert.strictEqual(result.ok, true);
    if (result.ok) assert.strictEqual((result.structuredContent as any).totalMatching, 4);
  });

  test("returns deterministic continuation paging and rejects filter drift", async () => {
    const service = new McpCustomApiApplicationService(config, repository);
    const first = await service.discover({ maxResults: 2 });
    assert.strictEqual(first.ok, true);
    if (!first.ok) return;
    const firstContent = first.structuredContent as any;
    assert.strictEqual(firstContent.returned, 2);
    assert.strictEqual(firstContent.hasMore, true);
    assert.ok(firstContent.nextContinuationToken);

    const second = await service.discover({ maxResults: 2, continuationToken: firstContent.nextContinuationToken });
    assert.strictEqual(second.ok, true);
    if (second.ok) {
      const secondContent = second.structuredContent as any;
      assert.strictEqual(secondContent.returned, 1);
      assert.strictEqual(secondContent.hasMore, false);
      assert.strictEqual(secondContent.definitions[0].uniqueName, "new_UpdateAccounts");
    }

    const drift = await service.discover({ operationKind: "Action", maxResults: 2, continuationToken: firstContent.nextContinuationToken });
    assert.strictEqual(drift.ok, false);
    if (!drift.ok) assert.strictEqual(drift.code, "InvalidArguments");
  });

  test("retrieves exact definition with a metadata-only invocation scaffold", async () => {
    const service = new McpCustomApiApplicationService(config, repository);
    const found = await service.getDefinition({ uniqueName: "new_GetSummary" });
    assert.strictEqual(found.ok, true);
    if (found.ok) {
      const content = found.structuredContent as any;
      assert.strictEqual(content.contractVersion, "dvqr-mcp-custom-api-definition-v2");
      assert.strictEqual(content.found, true);
      assert.strictEqual(content.invocation.method, "GET");
      assert.strictEqual(content.invocation.routeTemplate, "/api/data/v9.2/new_GetSummary(...)");
      assert.strictEqual(content.invocation.executionEligibility.status, "metadata_only");
      assert.strictEqual(content.invocation.functionParameters.Text, "<value>");
      assert.ok(found.displayText?.includes("Kind: Function"));
      assert.ok(found.displayText?.includes("Binding: Global"));
      assert.ok(found.displayText?.includes("Execution eligibility: Metadata only"));
    }
    const missing = await service.getDefinition({ uniqueName: "Get Summary" });
    assert.strictEqual(missing.ok, true);
    if (missing.ok) assert.strictEqual((missing.structuredContent as any).found, false);
  });

  test("builds action body and bound route scaffolds without claiming verified execution", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).getDefinition({ uniqueName: "new_RunPrivateAction" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const invocation = (result.structuredContent as any).invocation;
    assert.strictEqual(invocation.method, "POST");
    assert.strictEqual(invocation.routeTemplate, "/api/data/v9.2/{verifiedEntitySet}({rowId})/new_RunPrivateAction");
    assert.deepStrictEqual(invocation.bodyTemplate, {});
    assert.strictEqual(invocation.executionEligibility.status, "metadata_only");
  });

  test("rejects invalid detail levels", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({ detailLevel: "full" });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.code, "InvalidArguments");
  });

  test("rejects invalid operation filters before repository access", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({ operationKind: "Procedure" });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.code, "InvalidArguments");
  });

  test("rejects invalid continuation tokens", async () => {
    const result = await new McpCustomApiApplicationService(config, repository).discover({ continuationToken: "not-a-token" });
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.strictEqual(result.code, "InvalidArguments");
  });
});
