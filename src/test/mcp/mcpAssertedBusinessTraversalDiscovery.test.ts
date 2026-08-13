import * as assert from "node:assert";
import { McpRelationshipMetadataRepository } from "../../mcp/mcpRelationshipMetadataRepository.js";
import { McpBusinessPathRuntimeValidationApplicationService } from "../../mcp/mcpBusinessPathRuntimeValidationApplicationService.js";

const edge = (fromTable: string, toTable: string, navigationProperty: string) => ({
  fromTable,
  toTable,
  navigationProperty,
  relationshipSchemaName: navigationProperty,
  referencingAttribute: `${toTable}id`,
  relationshipType: "OneToMany" as const,
  direction: "oneToMany" as const,
  collectionValued: true,
  polymorphicTargetQualified: true
});

suite("mcp asserted business traversal discovery", () => {
  test("forces asserted intermediate tables into metadata inspection even when generic breadth would starve them", async () => {
    const repository = new McpRelationshipMetadataRepository({ requestTimeoutMs: 1000 } as any);
    const noisy = Array.from({ length: 50 }, (_, index) => edge("alpha", `noise_${String(index).padStart(2, "0")}`, `noise_${index}`));
    const relationships = new Map<string, any[]>([
      ["alpha", [...noisy, edge("alpha", "beta", "alpha_beta")]],
      ["beta", [edge("beta", "gamma", "beta_gamma")]],
      ["gamma", [edge("gamma", "omega", "gamma_omega")]],
      ["omega", []]
    ]);
    (repository as any).fetchRelationships = async (_url: string, _token: string, logicalName: string) => relationships.get(logicalName) ?? [];

    const discovered = await repository.discoverDepthDiverseBusinessPaths(
      { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" },
      "alpha",
      "omega",
      4,
      8,
      ["alpha", "beta", "gamma", "omega"]
    );

    const asserted = discovered.ranked.filter((path) => path.tables.join(">").toLowerCase() === "alpha>beta>gamma>omega");
    assert.ok(asserted.length >= 1, "the exact asserted table sequence should survive bounded generic exploration");
  });


  test("constructs the exact asserted traversal even when generic path-finder quota is exhausted first", async () => {
    const repository = new McpRelationshipMetadataRepository({ requestTimeoutMs: 1000 } as any);
    const noisySourceEdges = Array.from({ length: 50 }, (_, index) => edge("alpha", `noise_${String(index).padStart(2, "0")}`, `alpha_noise_${index}`));
    const relationships = new Map<string, any[]>([
      ["alpha", [...noisySourceEdges, edge("alpha", "beta", "alpha_beta")]],
      ["beta", [edge("beta", "gamma", "beta_gamma")]],
      ["gamma", [edge("gamma", "omega", "gamma_omega")]],
      ["omega", []]
    ]);
    for (let index = 0; index < 36; index += 1) {
      const table = `noise_${String(index).padStart(2, "0")}`;
      relationships.set(table, Array.from({ length: 4 }, (_, variant) => edge(table, "omega", `${table}_omega_${variant}`)));
    }
    (repository as any).fetchRelationships = async (_url: string, _token: string, logicalName: string) => relationships.get(logicalName) ?? [];

    const discovered = await repository.discoverDepthDiverseBusinessPaths(
      { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" },
      "alpha",
      "omega",
      4,
      8,
      ["alpha", "beta", "gamma", "omega"]
    );

    const exact = discovered.ranked.filter((path) => path.tables.join(">").toLowerCase() === "alpha>beta>gamma>omega");
    assert.ok(exact.length >= 1, "explicit contiguous construction must preserve the asserted chain even after generic BFS fills its path quota");
    assert.strictEqual(exact[0].hops.length, 3);
    assert.strictEqual(exact[0].hops[0].navigationProperty, "alpha_beta");
    assert.strictEqual(exact[0].hops[1].navigationProperty, "beta_gamma");
    assert.strictEqual(exact[0].hops[2].navigationProperty, "gamma_omega");
  });


  test("executes a finder-starved asserted traversal contiguously to the final target and promotes it independently of the runtime winner", async () => {
    const repository = new McpRelationshipMetadataRepository({ requestTimeoutMs: 1000 } as any);
    const noisySourceEdges = Array.from({ length: 50 }, (_, index) => edge("alpha", `noise_${String(index).padStart(2, "0")}`, `alpha_noise_${index}`));
    const relationships = new Map<string, any[]>([
      ["alpha", [...noisySourceEdges, edge("alpha", "beta", "alpha_beta"), edge("alpha", "omega", "alpha_omega")]],
      ["beta", [edge("beta", "gamma", "beta_gamma")]],
      ["gamma", [edge("gamma", "omega", "gamma_omega")]],
      ["omega", []]
    ]);
    for (let index = 0; index < 36; index += 1) {
      const table = `noise_${String(index).padStart(2, "0")}`;
      relationships.set(table, Array.from({ length: 4 }, (_, variant) => edge(table, "omega", `${table}_omega_${variant}`)));
    }
    (repository as any).fetchRelationships = async (_url: string, _token: string, logicalName: string) => relationships.get(logicalName) ?? [];
    (repository as any).metadataContext = async () => ({ baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" });
    (repository as any).fetchEntityCatalogue = async () => [];

    const probes = {
      probeRankedRelationshipPath: async (_context: unknown, path: any) => {
        const asserted = path.tables.join(">").toLowerCase() === "alpha>beta>gamma>omega";
        const shortcut = path.pathId === "alpha:alpha_omega:omega";
        const viable = asserted || shortcut;
        const counts = asserted ? [1, 2, 2] : shortcut ? [5] : [0];
        return {
          observation: {
            pathId: path.pathId, tables: path.tables, targetTable: "omega", family: "test", metadataScore: path.score,
            status: viable ? "TargetObserved" : "NoContinuationObserved", reachedTarget: viable,
            completedHops: viable ? path.hops.length : 1, totalHops: path.hops.length,
            intermediateRowsObserved: asserted ? 3 : 0, finalTargetRecordCount: viable ? counts[counts.length - 1] : 0,
            runtimeEvidenceScore: shortcut ? 100 : asserted ? 20 : -5, investigationScore: shortcut ? 200 : asserted ? 120 : 0, reasons: []
          },
          reachedTarget: viable, finalTargetRecordIds: viable ? ["id"] : [], probeRequestsUsed: path.hops.length,
          steps: counts.map((count: number, index: number) => ({ index: index + 1, continuationRecordCount: count, status: count ? "DataObserved" : "NoMatchingDataObserved" }))
        };
      }
    };

    const service = new McpBusinessPathRuntimeValidationApplicationService(repository as any, probes as any);
    const result = await service.validateBusinessPaths({
      sourceTable: "alpha", targetTable: "omega", sourceRecordId: "00000000-0000-0000-0000-000000000001",
      assertedBusinessPathTables: ["alpha", "beta", "gamma", "omega"], maxDepth: 4, maxCandidates: 3, maxProbeRequests: 30
    });

    assert.strictEqual(result.ok, true);
    const content = (result as any).structuredContent;
    assert.strictEqual(content.assertedBusinessTraversal.metadataResolution, "ResolvedCandidates");
    assert.strictEqual(content.assertedBusinessTraversal.reachedTarget, true);
    assert.deepStrictEqual(content.businessPreferredTraversal.tables, ["alpha", "beta", "gamma", "omega"]);
    assert.strictEqual(content.businessPreferredTraversal.completedHops, 3);
    assert.strictEqual(content.businessPreferredTraversal.reachedTarget, true);
    assert.deepStrictEqual(content.runtimePreferredPath.tables, ["alpha", "omega"]);
  });

  test("preserves bounded relationship variants for the same asserted table sequence", async () => {
    const repository = new McpRelationshipMetadataRepository({ requestTimeoutMs: 1000 } as any);
    const relationships = new Map<string, any[]>([
      ["alpha", [edge("alpha", "beta", "alpha_beta_role_a"), edge("alpha", "beta", "alpha_beta_role_b")]],
      ["beta", [edge("beta", "omega", "beta_omega")]],
      ["omega", []]
    ]);
    (repository as any).fetchRelationships = async (_url: string, _token: string, logicalName: string) => relationships.get(logicalName) ?? [];

    const discovered = await repository.discoverDepthDiverseBusinessPaths(
      { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" },
      "alpha",
      "omega",
      3,
      8,
      ["alpha", "beta", "omega"]
    );

    const asserted = discovered.ranked.filter((path) => path.tables.join(">").toLowerCase() === "alpha>beta>omega");
    assert.strictEqual(asserted.length, 2);
    assert.notStrictEqual(asserted[0].pathId, asserted[1].pathId);
  });

  test("promotes a viable asserted relationship variant even when another asserted variant is empty and a shortcut ranks higher", async () => {
    const assertedEmpty = {
      pathId: "alpha:role_a:beta|beta:beta_omega:omega",
      tables: ["alpha", "beta", "omega"],
      bridgeTables: ["beta"],
      hops: [edge("alpha", "beta", "role_a"), edge("beta", "omega", "beta_omega")],
      score: 90,
      family: "asserted-a",
      reasons: []
    };
    const assertedViable = {
      ...assertedEmpty,
      pathId: "alpha:role_b:beta|beta:beta_omega:omega",
      hops: [edge("alpha", "beta", "role_b"), edge("beta", "omega", "beta_omega")],
      family: "asserted-b"
    };
    const shortcut = {
      pathId: "alpha:alpha_omega:omega",
      tables: ["alpha", "omega"],
      bridgeTables: [],
      hops: [edge("alpha", "omega", "alpha_omega")],
      score: 100,
      family: "shortcut",
      reasons: []
    };
    const discovery = {
      ranked: [shortcut, assertedEmpty, assertedViable],
      nodes: new Set(["alpha", "beta", "omega"]),
      edges: [...shortcut.hops, ...assertedEmpty.hops, assertedViable.hops[0]],
      coverage: { tablesInspected: 3, directPathsFound: 1, bridgedPathsFound: 2, operationalHubsInspected: [], explorationComplete: true }
    };
    const metadata = {
      metadataContext: async () => ({ baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" }),
      discoverDepthDiverseBusinessPaths: async () => discovery,
      fetchEntityCatalogue: async () => [],
      getCachedDepthDiverseBusinessPaths: () => undefined,
      getCachedEntityCatalogue: () => undefined
    };
    const probes = {
      probeRankedRelationshipPath: async (_context: unknown, path: any) => {
        const viable = path.pathId === assertedViable.pathId || path.pathId === shortcut.pathId;
        const counts = path.pathId === assertedViable.pathId ? [1, 1] : path.pathId === shortcut.pathId ? [3] : [0, 0];
        return {
          observation: {
            pathId: path.pathId,
            tables: path.tables,
            targetTable: "omega",
            family: path.family,
            metadataScore: path.score,
            status: viable ? "TargetObserved" : "NoContinuationObserved",
            reachedTarget: viable,
            completedHops: viable ? path.hops.length : 1,
            totalHops: path.hops.length,
            intermediateRowsObserved: viable && counts.length > 1 ? counts[0] : 0,
            finalTargetRecordCount: viable ? counts[counts.length - 1] : 0,
            runtimeEvidenceScore: viable ? 40 : -5,
            investigationScore: viable ? 130 : 85,
            reasons: []
          },
          reachedTarget: viable,
          finalTargetRecordIds: viable ? ["id"] : [],
          probeRequestsUsed: path.hops.length,
          steps: counts.map((count: number, index: number) => ({ index: index + 1, continuationRecordCount: count, status: count ? "DataObserved" : "NoMatchingDataObserved" }))
        };
      }
    };

    const service = new McpBusinessPathRuntimeValidationApplicationService(metadata as any, probes as any);
    const result = await service.validateBusinessPaths({
      sourceTable: "alpha",
      targetTable: "omega",
      sourceRecordId: "00000000-0000-0000-0000-000000000001",
      assertedBusinessPathTables: ["alpha", "beta", "omega"],
      maxCandidates: 3,
      maxProbeRequests: 10
    });

    assert.strictEqual(result.ok, true);
    const content = (result as any).structuredContent;
    assert.strictEqual(content.assertedBusinessTraversal.metadataResolution, "ResolvedCandidates");
    assert.strictEqual(content.assertedBusinessTraversal.relationshipVariantsResolved, 2);
    assert.strictEqual(content.assertedBusinessTraversal.reachedTarget, true);
    assert.strictEqual(content.businessPreferredTraversal.pathId, assertedViable.pathId);
    assert.strictEqual(content.businessPreferredTraversal.businessAuthority, "AssertedBusinessTraversal");
    assert.strictEqual(content.runtimePreferredPath.pathId, shortcut.pathId);
    assert.strictEqual(content.runtimePreferredPath.businessAuthority, "RuntimeShortcut");
  });
});
