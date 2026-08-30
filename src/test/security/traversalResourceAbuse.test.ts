import * as assert from "node:assert";
import {
  findRelationshipPaths,
  type McpRelationshipEdge,
  type McpRelationshipGraph
} from "../../mcp/mcpRelationshipIntelligence.js";
import { McpBusinessPathRuntimeValidationApplicationService } from "../../mcp/mcpBusinessPathRuntimeValidationApplicationService.js";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";
import { pathologicalGraphFixtures } from "./fixtures/pathologicalGraphs.js";
import { oversizedPayloadFixtures } from "./fixtures/oversizedPayloads.js";
import { validateMcpToolArguments } from "../../mcp/mcpInputSecurity.js";

function edge(fromTable: string, toTable: string, suffix = ""): McpRelationshipEdge {
  return {
    fromTable,
    toTable,
    navigationProperty: `${fromTable}_${toTable}${suffix}`,
    relationshipSchemaName: `${fromTable}_${toTable}${suffix}`,
    relationshipType: "OneToMany",
    direction: "oneToMany",
    collectionValued: true,
    polymorphicTargetQualified: true
  };
}

function graphFromAdjacency(adjacency: Readonly<Record<string, readonly string[]>>): McpRelationshipGraph {
  const edges: McpRelationshipEdge[] = [];
  const nodes = new Set<string>();
  for (const [from, targets] of Object.entries(adjacency)) {
    nodes.add(from);
    targets.forEach((to, index) => {
      nodes.add(to);
      edges.push(edge(from, to, `_${index}`));
    });
  }
  return { nodes: [...nodes], edges };
}

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 1000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

suite("Security adversarial traversal bounds and resource exhaustion", () => {
  test("A10 self/two-node/long cycles never revisit a table within a returned path", () => {
    for (const id of ["self-cycle", "two-node-cycle", "long-cycle"]) {
      const fixture = pathologicalGraphFixtures.find((item) => item.id === id)!;
      const graph = graphFromAdjacency(fixture.adjacency);
      const paths = findRelationshipPaths(graph, fixture.start, "__unreachable__", {
        maxDepth: 1000,
        maxPaths: 1000
      });
      assert.strictEqual(paths.length, 0, id);
    }

    const cyclicGraph: McpRelationshipGraph = {
      nodes: ["a", "b", "c", "target"],
      edges: [
        edge("a", "b"),
        edge("b", "a"),
        edge("b", "c"),
        edge("c", "b"),
        edge("c", "target")
      ]
    };
    const paths = findRelationshipPaths(cyclicGraph, "a", "target", { maxDepth: 1000, maxPaths: 1000 });
    assert.strictEqual(paths.length, 1);
    const tables = ["a", ...paths[0].map((item) => item.toTable)];
    assert.strictEqual(new Set(tables).size, tables.length);
  });

  test("A10/A19 high fan-out remains bounded by canonical maxPaths even when caller requests more", () => {
    const targets = Array.from({ length: 500 }, (_, index) => `branch_${index}`);
    const edges = targets.flatMap((branch, index) => [
      edge("root", branch, `_${index}`),
      edge(branch, "target", `_${index}`)
    ]);
    const paths = findRelationshipPaths(
      { nodes: ["root", "target", ...targets], edges },
      "root",
      "target",
      { maxDepth: 999, maxPaths: 99999 }
    );
    assert.strictEqual(paths.length, 100);
    assert.ok(paths.every((path) => path.length <= 6));
  });

  test("A10 deep paths beyond the canonical hop limit are deterministically truncated", () => {
    const fixture = pathologicalGraphFixtures.find((item) => item.id === "deep-beyond-normal-bound")!;
    const graph = graphFromAdjacency(fixture.adjacency);
    const target = Object.keys(fixture.adjacency).at(-1)!;
    const paths = findRelationshipPaths(graph, fixture.start, target, { maxDepth: 1000, maxPaths: 1000 });
    assert.strictEqual(paths.length, 0, "a target deeper than six hops must not be reached");
  });

  test("A11 oversized tool arguments are rejected before provider execution", async () => {
    let providerCalls = 0;
    const dispatcher = new DvqrMcpLiveToolDispatcher(config, {
      executeOData: async () => {
        providerCalls += 1;
        return { ok: true, structuredContent: { value: [] } };
      }
    } as any);

    const hugeQuery = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: oversizedPayloadFixtures.hugeQuery }
    });
    assert.strictEqual(hugeQuery.isError, true);
    assert.strictEqual((hugeQuery.structuredContent as any).code, "InvalidArguments");

    const hugeArray = await dispatcher.dispatch({
      name: "dvqr_validate_business_paths",
      arguments: {
        sourceTable: "contact",
        targetTable: "account",
        sourceRecordId: "00000000-0000-0000-0000-000000000001",
        assertedBusinessPathTables: oversizedPayloadFixtures.hugeArray
      }
    });
    assert.strictEqual(hugeArray.isError, true);
    assert.strictEqual((hugeArray.structuredContent as any).code, "InvalidArguments");
    assert.strictEqual(providerCalls, 0);
  });

  test("A19 runtime validation uses one shared probe budget and never grants a second candidate budget", async () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      pathId: `source:source_bridge_${index}:bridge_${index}|bridge_${index}:bridge_target:target`,
      tables: ["source", `bridge_${index}`, "target"],
      bridgeTables: [`bridge_${index}`],
      hops: [
        edge("source", `bridge_${index}`, `_${index}`),
        edge(`bridge_${index}`, "target", `_${index}`)
      ],
      score: 100 - index,
      family: `family_${index}`,
      reasons: []
    }));
    const metadata = {
      metadataContext: async () => ({ baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" }),
      discoverDepthDiverseBusinessPaths: async () => ({
        ranked: candidates,
        nodes: new Set(["source", "target", ...candidates.map((item) => item.bridgeTables[0])]),
        edges: candidates.flatMap((item) => item.hops),
        coverage: {
          tablesInspected: 10,
          directPathsFound: 0,
          bridgedPathsFound: candidates.length,
          operationalHubsInspected: [],
          explorationComplete: true
        }
      }),
      fetchEntityCatalogue: async () => [],
      getCachedDepthDiverseBusinessPaths: () => undefined,
      getCachedEntityCatalogue: () => undefined
    };

    let calls = 0;
    const remainingSeen: number[] = [];
    const probes = {
      probeRankedRelationshipPath: async (_context: unknown, path: any, _source: string, _maxRecords: number, budget: { remaining: number }) => {
        remainingSeen.push(budget.remaining);
        if (budget.remaining <= 0) throw new Error("test attempted to probe without budget");
        budget.remaining -= 1;
        calls += 1;
        return {
          observation: {
            pathId: path.pathId,
            tables: path.tables,
            targetTable: "target",
            family: path.family,
            metadataScore: path.score,
            status: "NoContinuationObserved",
            reachedTarget: false,
            completedHops: 1,
            totalHops: path.hops.length,
            intermediateRowsObserved: 0,
            finalTargetRecordCount: 0,
            runtimeEvidenceScore: -5,
            investigationScore: 80,
            reasons: []
          },
          reachedTarget: false,
          finalTargetRecordIds: [],
          probeRequestsUsed: 1,
          steps: [{ index: 1, continuationRecordCount: 0, status: "NoMatchingDataObserved" }]
        };
      }
    };

    const service = new McpBusinessPathRuntimeValidationApplicationService(metadata as any, probes as any);
    const result = await service.validateBusinessPaths({
      sourceTable: "source",
      targetTable: "target",
      sourceRecordId: "00000000-0000-0000-0000-000000000001",
      maxCandidates: 8,
      maxProbeRequests: 3
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(calls, 3);
    assert.deepStrictEqual(remainingSeen, [3, 2, 1]);
    const content = (result as any).structuredContent;
    assert.strictEqual(content.validationSummary.probesUsed, 3);
    assert.strictEqual(content.validationSummary.probesRemaining, 0);
    assert.ok(content.validationSummary.notTestedPaths >= 5);
    assert.strictEqual(content.bounds.maxProbeRequests, 3);
  });

  test("A19 saved exact-route runtime cohort cannot spend budget on alternative candidates", async () => {
    const exact = {
      pathId: "source:exact_role:bridge|bridge:bridge_target:target",
      tables: ["source", "bridge", "target"],
      bridgeTables: ["bridge"],
      hops: [edge("source", "bridge", "_exact"), edge("bridge", "target", "_exact")],
      score: 80,
      family: "exact",
      reasons: []
    };
    const alternatives = Array.from({ length: 20 }, (_, index) => ({
      pathId: `source:alt_${index}:alt_${index}|alt_${index}:alt_target:target`,
      tables: ["source", `alt_${index}`, "target"],
      bridgeTables: [`alt_${index}`],
      hops: [edge("source", `alt_${index}`, `_${index}`), edge(`alt_${index}`, "target", `_${index}`)],
      score: 100 - index,
      family: `alt_${index}`,
      reasons: []
    }));
    const metadata = {
      metadataContext: async () => ({ baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "token" }),
      discoverDepthDiverseBusinessPaths: async () => ({
        ranked: [...alternatives, exact],
        nodes: new Set(["source", "bridge", "target"]),
        edges: [...alternatives, exact].flatMap((item) => item.hops),
        coverage: { tablesInspected: 3, directPathsFound: 0, bridgedPathsFound: 21, operationalHubsInspected: [], explorationComplete: true }
      }),
      fetchEntityCatalogue: async () => [],
      getCachedDepthDiverseBusinessPaths: () => undefined,
      getCachedEntityCatalogue: () => undefined
    };
    const probed: string[] = [];
    const probes = {
      probeRankedRelationshipPath: async (_context: unknown, path: any, _source: string, _maxRecords: number, budget: { remaining: number }) => {
        probed.push(path.pathId);
        budget.remaining -= 1;
        return {
          observation: {
            pathId: path.pathId, tables: path.tables, targetTable: "target", family: path.family,
            metadataScore: path.score, status: "NoContinuationObserved", reachedTarget: false,
            completedHops: 1, totalHops: path.hops.length, intermediateRowsObserved: 0,
            finalTargetRecordCount: 0, runtimeEvidenceScore: -5, investigationScore: 75, reasons: []
          },
          reachedTarget: false, finalTargetRecordIds: [], probeRequestsUsed: 1,
          steps: [{ index: 1, continuationRecordCount: 0, status: "NoMatchingDataObserved" }]
        };
      }
    };

    const service = new McpBusinessPathRuntimeValidationApplicationService(metadata as any, probes as any);
    const result = await service.validateBusinessPaths({
      sourceTable: "source",
      targetTable: "target",
      sourceRecordId: "00000000-0000-0000-0000-000000000001",
      assertedBusinessPathTables: ["source", "bridge", "target"],
      assertedBusinessPathRelationshipSchemaNames: ["source_bridge_exact", "bridge_target_exact"],
      preferredBusinessPathId: "bp_deadbeef",
      maxCandidates: 8,
      maxProbeRequests: 30
    });

    // The exact saved relationship identities resolve successfully. Even with many higher-scored
    // alternatives available, only the exact saved route may consume runtime budget.
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(probed, [exact.pathId]);
    const content = (result as any).structuredContent;
    assert.strictEqual(content.validatedPaths.length, 1);
    assert.strictEqual(content.validatedPaths[0].pathId, exact.pathId);
    assert.strictEqual(content.validationSummary.pathsActuallyProbed, 1);
  });
  test("A11 canonical input validation bounds deeply nested and oversized unstructured payloads", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        // No nested schema means parameters are deliberately unstructured and therefore
        // subject to DVQR's generic depth/width limits.
        parameters: {}
      }
    };
    const deep = validateMcpToolArguments(schema, {
      parameters: oversizedPayloadFixtures.deepObject
    });
    assert.strictEqual(deep.valid, false);
    assert.ok(deep.issues.some((issue) => /maximum nesting depth/i.test(issue)));

    const wide = validateMcpToolArguments(schema, {
      parameters: Object.fromEntries(
        Array.from({ length: 150 }, (_, index) => [`field_${index}`, index])
      )
    });
    assert.strictEqual(wide.valid, false);
    assert.ok(wide.issues.some((issue) => /100 fields/i.test(issue)));
  });


});
