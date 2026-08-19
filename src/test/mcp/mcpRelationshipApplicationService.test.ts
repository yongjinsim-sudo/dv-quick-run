import * as assert from "node:assert";
import { DvqrMcpFreeApplicationAdapter } from "../../mcp/mcpFreeApplicationAdapter.js";
import { McpRelationshipApplicationService } from "../../mcp/mcpRelationshipApplicationService.js";
import { McpRelationshipMetadataRepository } from "../../mcp/mcpRelationshipMetadataRepository.js";
import { McpOperationalAnchorApplicationService } from "../../mcp/mcpOperationalAnchorApplicationService.js";
import { McpLookupNavigationApplicationService } from "../../mcp/mcpLookupNavigationApplicationService.js";
import { McpRelationshipPathDiscoveryApplicationService } from "../../mcp/mcpRelationshipPathDiscoveryApplicationService.js";
import { McpBusinessPathDiscoveryApplicationService } from "../../mcp/mcpBusinessPathDiscoveryApplicationService.js";
import { McpRelationshipQueryApplicationService } from "../../mcp/mcpRelationshipQueryApplicationService.js";
import { McpRelationshipTraversalApplicationService } from "../../mcp/mcpRelationshipTraversalApplicationService.js";
import { McpRelationshipProbeService } from "../../mcp/mcpRelationshipProbeService.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: true,
  textMirrorMaxCharacters: 32768
};

suite("mcpRelationshipApplicationService", () => {
  test("preserves relationship-tool validation contracts through the adapter facade", async () => {
    const service = new McpRelationshipApplicationService(config);
    const adapter = new DvqrMcpFreeApplicationAdapter(config);

    const cases: ReadonlyArray<{
      readonly adapterCall: () => Promise<unknown>;
      readonly serviceCall: () => Promise<unknown>;
    }> = [
      {
        adapterCall: () => adapter.discoverOperationalAnchors({}),
        serviceCall: () => service.discoverOperationalAnchors({})
      },
      {
        adapterCall: () => adapter.resolveNavigationProperty({}),
        serviceCall: () => service.resolveNavigationProperty({})
      },
      {
        adapterCall: () => adapter.findRelationshipPaths({}),
        serviceCall: () => service.findRelationshipPaths({})
      },
      {
        adapterCall: () => adapter.discoverBusinessPaths({}),
        serviceCall: () => service.discoverBusinessPaths({})
      },
      {
        adapterCall: () => adapter.validateBusinessPaths({}),
        serviceCall: () => service.validateBusinessPaths({})
      },
      {
        adapterCall: () => adapter.generateRelationshipQuery({}),
        serviceCall: () => service.generateRelationshipQuery({})
      },
      {
        adapterCall: () => adapter.probeRelationshipPath({}),
        serviceCall: () => service.probeRelationshipPath({})
      },
      {
        adapterCall: () => adapter.explainLookup({}),
        serviceCall: () => service.explainLookup({})
      }
    ];

    for (const item of cases) {
      assert.deepStrictEqual(await item.adapterCall(), await item.serviceCall());
    }
  });

  test("centralises environment validation in the metadata repository", async () => {
    const repository = new McpRelationshipMetadataRepository(config);

    assert.deepStrictEqual(await repository.metadataContext({}), {
      ok: false,
      code: "EnvironmentRequired",
      message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call."
    });
    assert.deepStrictEqual(await repository.metadataContext({ environmentUrl: "http://example.crm.dynamics.com" }), {
      ok: false,
      code: "InvalidArguments",
      message: "environmentUrl must use HTTPS."
    });
  });

  test("keeps operational-anchor validation behind its focused application service", async () => {
    const repository = new McpRelationshipMetadataRepository(config);
    const service = new McpOperationalAnchorApplicationService(repository);

    assert.deepStrictEqual(await service.discoverOperationalAnchors({}), {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable is required."
    });
  });


  test("keeps operational-anchor discovery usable when a downstream relationship table is inaccessible", async () => {
    const repository = {
      metadataContext: async () => ({ baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" }),
      fetchEntityCatalogue: async () => [],
      fetchRelationships: async (_base: string, _token: string, table: string) => {
        if (table === "contact") {
          return [{
            fromTable: "contact",
            toTable: "restricted_child",
            navigationProperty: "contact_restricted_child",
            relationshipType: "OneToMany",
            direction: "oneToMany",
            collectionValued: true
          }];
        }
        throw new Error("HTTP 403 while inspecting restricted_child metadata");
      }
    };
    const service = new McpOperationalAnchorApplicationService(repository as never);

    const result = await service.discoverOperationalAnchors({ sourceTable: "contact", maxDepth: 3, maxResults: 8, maxTablesInspected: 60 });

    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as Record<string, unknown>;
    const coverage = content.discoveryCoverage as Record<string, unknown>;
    assert.strictEqual(coverage.relationshipMetadataFailures, 1);
    assert.strictEqual(coverage.explorationComplete, false);
    assert.deepStrictEqual(coverage.inaccessibleOrFailedTables, [{
      table: "restricted_child",
      depth: 1,
      message: "HTTP 403 while inspecting restricted_child metadata"
    }]);
  });

  test("still fails operational-anchor discovery when source relationship metadata is inaccessible", async () => {
    const repository = {
      metadataContext: async () => ({ baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" }),
      fetchEntityCatalogue: async () => [],
      fetchRelationships: async () => { throw new Error("HTTP 403 on source metadata"); }
    };
    const service = new McpOperationalAnchorApplicationService(repository as never);

    const result = await service.discoverOperationalAnchors({ sourceTable: "contact" });

    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.code, "ExecutionFailed");
  });

  test("keeps lookup and navigation validation behind their focused application service", async () => {
    const repository = new McpRelationshipMetadataRepository(config);
    const service = new McpLookupNavigationApplicationService(config, repository);

    assert.deepStrictEqual(await service.resolveNavigationProperty({ sourceTable: "contact" }), {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable and targetTable are required."
    });
    assert.deepStrictEqual(await service.explainLookup({ sourceTable: "contact" }), {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable and lookup are required."
    });
  });

  test("keeps path discovery, query generation and traversal validation behind focused services", async () => {
    const repository = new McpRelationshipMetadataRepository(config);
    const probes = new McpRelationshipProbeService(config, repository);
    const pathDiscovery = new McpRelationshipPathDiscoveryApplicationService(repository);
    const businessPathDiscovery = new McpBusinessPathDiscoveryApplicationService(repository, config);
    const queryGeneration = new McpRelationshipQueryApplicationService(repository);
    const traversal = new McpRelationshipTraversalApplicationService(repository, probes);

    const missingTables = {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable and targetTable are required."
    };
    assert.deepStrictEqual(await pathDiscovery.findRelationshipPaths({}), missingTables);
    assert.deepStrictEqual(await businessPathDiscovery.discoverBusinessPaths({}), missingTables);
    assert.deepStrictEqual(await queryGeneration.generateRelationshipQuery({}), missingTables);
    assert.deepStrictEqual(await traversal.probeRelationshipPath({}), {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable, targetTable and sourceRecordId are required."
    });
  });

  test("keeps the established lookup argument failure", async () => {
    const service = new McpRelationshipApplicationService(config);
    assert.deepStrictEqual(await service.explainLookup({ sourceTable: "contact" }), {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable and lookup are required."
    });
  });
});
