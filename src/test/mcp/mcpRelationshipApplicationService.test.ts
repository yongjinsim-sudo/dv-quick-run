import * as assert from "node:assert";
import { DvqrMcpFreeApplicationAdapter } from "../../mcp/mcpFreeApplicationAdapter.js";
import { McpRelationshipApplicationService } from "../../mcp/mcpRelationshipApplicationService.js";
import { McpRelationshipMetadataRepository } from "../../mcp/mcpRelationshipMetadataRepository.js";
import { McpOperationalAnchorApplicationService } from "../../mcp/mcpOperationalAnchorApplicationService.js";
import { McpLookupNavigationApplicationService } from "../../mcp/mcpLookupNavigationApplicationService.js";
import { McpRelationshipPathDiscoveryApplicationService } from "../../mcp/mcpRelationshipPathDiscoveryApplicationService.js";
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
    const queryGeneration = new McpRelationshipQueryApplicationService(repository);
    const traversal = new McpRelationshipTraversalApplicationService(repository, probes);

    const missingTables = {
      ok: false,
      code: "InvalidArguments",
      message: "sourceTable and targetTable are required."
    };
    assert.deepStrictEqual(await pathDiscovery.findRelationshipPaths({}), missingTables);
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
