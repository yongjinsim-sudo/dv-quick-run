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
