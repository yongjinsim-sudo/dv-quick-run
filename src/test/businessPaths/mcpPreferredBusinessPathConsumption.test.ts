import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop
} from "../../core/businessPaths/index.js";
import { WorkspaceBusinessPathRepository } from "../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { McpBusinessPathDiscoveryApplicationService } from "../../mcp/mcpBusinessPathDiscoveryApplicationService.js";
import { McpRelationshipMetadataRepository } from "../../mcp/mcpRelationshipMetadataRepository.js";
import type { McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

const preferredHops: readonly BusinessPathHop[] = [
  {
    ordinal: 1,
    fromTable: "contact",
    toTable: "careplan",
    relationshipSchemaName: "contact_careplan_patient",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "contact_careplans",
    lookupAttribute: "patientid"
  },
  {
    ordinal: 2,
    fromTable: "careplan",
    toTable: "task",
    relationshipSchemaName: "careplan_tasks",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "careplan_tasks",
    lookupAttribute: "regardingid"
  }
];

function preferredArtifact(): BusinessPathArtifact {
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId("contact", "task", preferredHops),
    name: "Contact to Task via Care Plan",
    sourceTable: "contact",
    targetTable: "task",
    state: "preferred",
    priority: 0,
    hops: preferredHops,
    provenance: {
      promotedFrom: "runtime-validation",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "verified",
      environment: { identity: "example.crm.dynamics.com" },
      verifiedAt: "2026-08-18T01:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 5,
      bounded: true
    },
    applicability: {
      scope: "workspace",
      verifiedEnvironmentIds: ["example.crm.dynamics.com"]
    },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T01:00:00.000Z"
  };
}

function edge(
  fromTable: string,
  toTable: string,
  relationshipSchemaName: string,
  navigationProperty: string,
  referencingAttribute: string
): McpRelationshipEdge {
  return {
    fromTable,
    toTable,
    navigationProperty,
    relationshipSchemaName,
    referencingAttribute,
    relationshipType: "OneToMany",
    direction: "oneToMany",
    collectionValued: true,
    polymorphicTargetQualified: true
  };
}

suite("MCP Preferred Business Path consumption", () => {
  let workspace: string;
  let previousWorkspace: string | undefined;
  let repository: McpRelationshipMetadataRepository;
  let service: McpBusinessPathDiscoveryApplicationService;

  setup(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-preferred-consumption-"));
    previousWorkspace = process.env.DVQR_MCP_WORKSPACE_ROOT;
    process.env.DVQR_MCP_WORKSPACE_ROOT = workspace;

    repository = new McpRelationshipMetadataRepository({
      proEnabled: false,
      requestTimeoutMs: 30000,
      emitTextMirror: true,
      textMirrorMaxCharacters: 32768
    });

    (repository as any).metadataContext = async () => ({
      baseEnvironmentUrl: "https://example.crm.dynamics.com",
      token: "token"
    });

    (repository as any).fetchEntityCatalogue = async () => [
      { LogicalName: "contact", SchemaName: "Contact", EntitySetName: "contacts" },
      { LogicalName: "careplan", SchemaName: "CarePlan", EntitySetName: "careplans" },
      { LogicalName: "appointment", SchemaName: "Appointment", EntitySetName: "appointments" },
      { LogicalName: "task", SchemaName: "Task", EntitySetName: "tasks" }
    ];

    (repository as any).fetchRelationships = async (_base: string, _token: string, table: string) => {
      switch (table.toLowerCase()) {
        case "contact":
          return [
            edge("contact", "appointment", "contact_appointments", "contact_appointments", "contactid"),
            edge("contact", "careplan", "contact_careplan_patient", "contact_careplans", "patientid")
          ];
        case "appointment":
          return [edge("appointment", "task", "appointment_tasks", "appointment_tasks", "regardingid")];
        case "careplan":
          return [edge("careplan", "task", "careplan_tasks", "careplan_tasks", "regardingid")];
        default:
          return [];
      }
    };

    service = new McpBusinessPathDiscoveryApplicationService(repository, {
      proEnabled: false,
      requestTimeoutMs: 30000,
      emitTextMirror: true,
      textMirrorMaxCharacters: 32768,
      workspaceRoot: workspace
    });
  });

  teardown(() => {
    if (previousWorkspace === undefined) delete process.env.DVQR_MCP_WORKSPACE_ROOT;
    else process.env.DVQR_MCP_WORKSPACE_ROOT = previousWorkspace;
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  test("new session discovery surfaces persisted Preferred path before unchanged metadata ranking", async () => {
    const before = await service.discoverBusinessPaths({
      sourceTable: "contact",
      targetTable: "task",
      maxDepth: 4,
      maxPaths: 8
    });
    assert.strictEqual(before.ok, true);
    const beforeContent = (before as any).structuredContent;
    assert.strictEqual(beforeContent.preferredBusinessPath, undefined);

    new WorkspaceBusinessPathRepository(workspace).save(preferredArtifact());

    const after = await service.discoverBusinessPaths({
      sourceTable: "contact",
      targetTable: "task",
      maxDepth: 4,
      maxPaths: 8
    });
    assert.strictEqual(after.ok, true);
    const content = (after as any).structuredContent;

    assert.match((after as any).summary, /Workspace Preferred Business Path/i);
    assert.strictEqual(content.preferenceConsumption.mode, "WorkspacePreferenceOverlay");
    assert.strictEqual(content.preferenceConsumption.changesDiscoveryScores, false);

    assert.strictEqual(content.preferredBusinessPath.path.id, preferredArtifact().id);
    assert.strictEqual(content.preferredBusinessPath.path.name, "Contact to Task via Care Plan");
    assert.strictEqual(content.preferredBusinessPath.currentMetadata, "valid");
    assert.strictEqual(content.preferredBusinessPath.historicalRuntimeVerification.status, "verified");
    assert.strictEqual(content.topVisibleRecommendation.kind, "WorkspacePreferredBusinessPath");
    assert.strictEqual(content.topVisibleRecommendation.pathId, preferredArtifact().id);

    assert.deepStrictEqual(
      content.metadataRecommendedCandidate,
      beforeContent.metadataRecommendedCandidate,
      "persisted preference must not alter metadata candidate ranking"
    );
    assert.deepStrictEqual(
      content.recommendedCandidate,
      beforeContent.recommendedCandidate,
      "legacy metadata recommendedCandidate contract remains unchanged"
    );
    assert.deepStrictEqual(
      content.alternatives,
      beforeContent.alternatives,
      "discovered alternatives remain in their original deterministic order"
    );
  });

  test("stale Preferred path stays explicit but does not masquerade as current metadata-valid", async () => {
    new WorkspaceBusinessPathRepository(workspace).save(preferredArtifact());

    const originalFetch = (repository as any).fetchRelationships;
    (repository as any).fetchRelationships = async (base: string, token: string, table: string) => {
      const relationships = await originalFetch(base, token, table);
      return table.toLowerCase() === "contact"
        ? relationships.map((item: McpRelationshipEdge) =>
            item.relationshipSchemaName === "contact_careplan_patient"
              ? { ...item, navigationProperty: "renamed_contact_careplans" }
              : item
          )
        : relationships;
    };

    const result = await service.discoverBusinessPaths({
      sourceTable: "contact",
      targetTable: "task"
    });
    assert.strictEqual(result.ok, true);
    const content = (result as any).structuredContent;
    assert.strictEqual(content.preferredBusinessPath.currentMetadata, "stale");
    assert.strictEqual(content.topVisibleRecommendation.currentMetadata, "stale");
    assert.match((result as any).summary, /metadata stale/i);
  });

  test("disabled path does not participate in implicit consumption", async () => {
    new WorkspaceBusinessPathRepository(workspace).save({
      ...preferredArtifact(),
      state: "disabled"
    });

    const result = await service.discoverBusinessPaths({
      sourceTable: "contact",
      targetTable: "task"
    });
    assert.strictEqual(result.ok, true);
    const content = (result as any).structuredContent;
    assert.strictEqual(content.preferredBusinessPath, undefined);
    assert.strictEqual(content.topVisibleRecommendation.kind, "MetadataRankedCandidate");
  });
});
