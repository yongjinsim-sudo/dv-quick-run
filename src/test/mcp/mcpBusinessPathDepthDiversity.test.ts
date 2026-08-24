import * as assert from "node:assert";
import { McpRelationshipMetadataRepository } from "../../mcp/mcpRelationshipMetadataRepository.js";
import type { McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const edge = (fromTable: string, toTable: string, navigationProperty: string): McpRelationshipEdge => ({
  fromTable,
  toTable,
  navigationProperty,
  relationshipSchemaName: `${fromTable}_${toTable}`,
  relationshipType: "OneToMany",
  direction: "oneToMany",
  collectionValued: true,
  polymorphicTargetQualified: true
});

suite("mcpBusinessPathDepthDiversity", () => {
  test("does not let a high-degree source table suppress a plausible depth-two business route", async () => {
    const config: DvqrMcpRuntimeConfiguration = {
      proEnabled: true,
      requestTimeoutMs: 30000,
      emitTextMirror: true,
      textMirrorMaxCharacters: 32768
    };
    const repository = new McpRelationshipMetadataRepository(config);

    const noisyContactEdges: McpRelationshipEdge[] = [
      edge("contact", "msemr_careplanactivity", "direct_patient_activity"),
      edge("contact", "msemr_careplan", "contact_careplans"),
      ...Array.from({ length: 240 }, (_, index) =>
        edge("contact", `zz_noise_${String(index).padStart(3, "0")}`, `noise_${index}`)
      )
    ];

    (repository as any).fetchRelationships = async (_baseUrl: string, _token: string, table: string) => {
      if (table === "contact") return noisyContactEdges;
      if (table === "msemr_careplan") {
        return [edge("msemr_careplan", "msemr_careplanactivity", "careplan_activities")];
      }
      return [];
    };

    const discovered = await repository.discoverDepthDiverseBusinessPaths(
      { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "test" },
      "contact",
      "msemr_careplanactivity",
      4,
      8
    );

    const shapes = discovered.ranked.map((path) => path.tables.join(" -> "));
    assert.ok(shapes.includes("contact -> msemr_careplanactivity"));
    assert.ok(shapes.includes("contact -> msemr_careplan -> msemr_careplanactivity"));
    assert.ok(discovered.coverage.bridgedPathsFound >= 1);
    assert.ok(discovered.coverage.operationalHubsInspected.includes("msemr_careplan"));
  });

  test("preserves candidates from multiple hop depths before business scoring", async () => {
    const config: DvqrMcpRuntimeConfiguration = {
      proEnabled: true,
      requestTimeoutMs: 30000,
      emitTextMirror: true,
      textMirrorMaxCharacters: 32768
    };
    const repository = new McpRelationshipMetadataRepository(config);

    (repository as any).fetchRelationships = async (_baseUrl: string, _token: string, table: string) => {
      if (table === "contact") {
        return [
          edge("contact", "msemr_careplanactivity", "direct_activity"),
          edge("contact", "msemr_careplan", "contact_careplans"),
          edge("contact", "msemr_encounter", "contact_encounters")
        ];
      }
      if (table === "msemr_careplan") {
        return [edge("msemr_careplan", "msemr_careplanactivity", "careplan_activities")];
      }
      if (table === "msemr_encounter") {
        return [edge("msemr_encounter", "msemr_careplan", "encounter_careplans")];
      }
      return [];
    };

    const discovered = await repository.discoverDepthDiverseBusinessPaths(
      { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "test" },
      "contact",
      "msemr_careplanactivity",
      4,
      8
    );

    const depths = new Set(discovered.ranked.map((path) => path.hops.length));
    assert.ok(depths.has(1));
    assert.ok(depths.has(2));
    assert.ok(depths.has(3));
  });
});

test("bounds high-connectivity metadata acquisition without suppressing a target-linked business route", async () => {
  const config: DvqrMcpRuntimeConfiguration = {
    proEnabled: true,
    requestTimeoutMs: 30000,
    emitTextMirror: true,
    textMirrorMaxCharacters: 32768
  };
  const repository = new McpRelationshipMetadataRepository(config);
  const calls: string[] = [];

  (repository as any).fetchRelationships = async (_baseUrl: string, _token: string, table: string) => {
    calls.push(table);
    if (table === "bu_tasks") {
      // Target-side metadata is scheduling evidence only; the forward route still has to be
      // observed from careplanactivity before it can appear in the graph.
      return [edge("bu_tasks", "msemr_careplanactivity", "reverse_task_activity")];
    }
    if (table === "contact") {
      return [
        edge("contact", "msemr_careplan", "contact_careplans"),
        ...Array.from({ length: 240 }, (_, index) =>
          edge("contact", `zz_noise_${String(index).padStart(3, "0")}`, `noise_${index}`)
        )
      ];
    }
    if (table === "msemr_careplan") {
      return [edge("msemr_careplan", "msemr_careplanactivity", "careplan_activities")];
    }
    if (table === "msemr_careplanactivity") {
      return [edge("msemr_careplanactivity", "bu_tasks", "activity_task")];
    }
    return [];
  };

  const discovered = await repository.discoverDepthDiverseBusinessPaths(
    { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "test" },
    "contact",
    "bu_tasks",
    5,
    10
  );

  const shapes = discovered.ranked.map((path) => path.tables.join(" -> "));
  assert.ok(shapes.includes("contact -> msemr_careplan -> msemr_careplanactivity -> bu_tasks"));
  assert.ok(discovered.coverage.tablesInspected <= 24);
  // One optional target-hint fetch plus the bounded forward inspection envelope.
  assert.ok(calls.length <= 25, `expected at most 25 metadata-table fetches, got ${calls.length}`);
});

test("target-side scheduling hints never manufacture a forward relationship path", async () => {
  const config: DvqrMcpRuntimeConfiguration = {
    proEnabled: true,
    requestTimeoutMs: 30000,
    emitTextMirror: true,
    textMirrorMaxCharacters: 32768
  };
  const repository = new McpRelationshipMetadataRepository(config);

  (repository as any).fetchRelationships = async (_baseUrl: string, _token: string, table: string) => {
    if (table === "target") return [edge("target", "bridge", "reverse_hint")];
    if (table === "source") return [edge("source", "bridge", "source_bridge")];
    return [];
  };

  const discovered = await repository.discoverDepthDiverseBusinessPaths(
    { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "test" },
    "source",
    "target",
    4,
    8
  );

  assert.strictEqual(discovered.ranked.length, 0);
  assert.strictEqual(discovered.coverage.directPathsFound, 0);
  assert.strictEqual(discovered.coverage.bridgedPathsFound, 0);
});

test("briefly reuses discovery relationship metadata without changing candidate selection", async () => {
  const config: DvqrMcpRuntimeConfiguration = {
    proEnabled: true,
    requestTimeoutMs: 30000,
    emitTextMirror: true,
    textMirrorMaxCharacters: 32768
  };
  const repository = new McpRelationshipMetadataRepository(config);
  let fetchCount = 0;

  (repository as any).fetchRelationships = async (_baseUrl: string, _token: string, table: string) => {
    fetchCount += 1;
    if (table === "source") return [edge("source", "bridge", "source_bridge")];
    if (table === "bridge") return [edge("bridge", "target", "bridge_target")];
    if (table === "target") return [edge("target", "bridge", "target_bridge_reverse")];
    return [];
  };

  const context = { baseEnvironmentUrl: "https://example.crm.dynamics.com", token: "test" };
  const first = await repository.discoverDepthDiverseBusinessPaths(context, "source", "target", 3, 4);
  const afterFirst = fetchCount;
  const second = await repository.discoverDepthDiverseBusinessPaths(context, "source", "target", 3, 4);

  assert.deepStrictEqual(second.ranked.map((path) => path.pathId), first.ranked.map((path) => path.pathId));
  assert.strictEqual(fetchCount, afterFirst, "second discovery should reuse the short-lived relationship metadata cache");
});
