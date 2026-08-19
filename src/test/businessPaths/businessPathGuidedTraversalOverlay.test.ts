import * as assert from "node:assert";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop,
  type BusinessPathRepository
} from "../../core/businessPaths/index.js";
import {
  buildGuidedTraversalBusinessPathOverlay,
  isExactBusinessPathRoute
} from "../../commands/router/actions/traversal/businessPathGuidedTraversalOverlay.js";
import type {
  TraversalGraph,
  TraversalRoute
} from "../../commands/router/actions/shared/traversal/traversalTypes.js";

const hops: readonly BusinessPathHop[] = [
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

function artifact(args: {
  state?: "preferred" | "disabled";
  priority?: number;
  hops?: readonly BusinessPathHop[];
  verifiedAt?: string;
} = {}): BusinessPathArtifact {
  const routeHops = args.hops ?? hops;
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId("contact", "task", routeHops),
    name: "Contact to Task via Care Plan",
    sourceTable: "contact",
    targetTable: "task",
    state: args.state ?? "preferred",
    ...(args.priority !== undefined ? { priority: args.priority } : {}),
    hops: routeHops,
    provenance: {
      promotedFrom: "runtime-validation",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "verified",
      environment: { identity: "example.crm.dynamics.com" },
      verifiedAt: args.verifiedAt ?? "2026-08-18T00:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 2,
      bounded: true
    },
    applicability: {
      scope: "workspace",
      verifiedEnvironmentIds: ["example.crm.dynamics.com"]
    },
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

function graph(): TraversalGraph {
  return {
    entities: {
      contact: {
        logicalName: "contact",
        entitySetName: "contacts",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: ["contactid"],
        outboundRelationships: [{
          fromEntity: "contact",
          toEntity: "careplan",
          navigationPropertyName: "contact_careplans",
          schemaName: "contact_careplan_patient",
          referencingAttribute: "patientid",
          relationshipType: "OneToMany",
          direction: "oneToMany"
        }]
      },
      careplan: {
        logicalName: "careplan",
        entitySetName: "careplans",
        primaryIdAttribute: "careplanid",
        primaryNameAttribute: "name",
        fieldLogicalNames: ["careplanid"],
        outboundRelationships: [{
          fromEntity: "careplan",
          toEntity: "task",
          navigationPropertyName: "careplan_tasks",
          schemaName: "careplan_tasks",
          referencingAttribute: "regardingid",
          relationshipType: "OneToMany",
          direction: "oneToMany"
        }]
      },
      task: {
        logicalName: "task",
        entitySetName: "tasks",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        fieldLogicalNames: ["activityid"],
        outboundRelationships: []
      }
    }
  };
}

function discoveredRoute(): TraversalRoute {
  const g=graph();
  return {
    routeId:"discovered-careplan-route",
    sourceEntity:"contact",
    targetEntity:"task",
    entities:["contact","careplan","task"],
    edges:[
      g.entities.contact!.outboundRelationships[0]!,
      g.entities.careplan!.outboundRelationships[0]!
    ],
    hopCount:2,
    confidence:"high"
  };
}

class MemoryRepository implements BusinessPathRepository {
  public constructor(private readonly values: readonly BusinessPathArtifact[]) {}
  public list(): readonly BusinessPathArtifact[] { return this.values; }
  public findById(id:string): BusinessPathArtifact|undefined { return this.values.find((item)=>item.id===id); }
  public findMatching(source:string,target:string): readonly BusinessPathArtifact[] {
    return this.values.filter((item)=>
      item.sourceTable.toLowerCase()===source.toLowerCase()
      && item.targetTable.toLowerCase()===target.toLowerCase()
    );
  }
  public save():void { throw new Error("not used"); }
  public delete():boolean { return false; }
}

suite("Guided Traversal Managed Business Path overlay",()=>{
  test("recognizes an exact discovered duplicate by relationship identity, not only table sequence",()=>{
    assert.strictEqual(isExactBusinessPathRoute(artifact(),discoveredRoute()),true);

    const different=discoveredRoute();
    different.edges[0]={...different.edges[0],schemaName:"contact_careplan_author"};
    assert.strictEqual(isExactBusinessPathRoute(artifact(),different),false);
  });

  test("pins a valid preferred path and merges its exact discovered duplicate",async()=>{
    const saved=artifact({priority:1});
    const discovered=discoveredRoute();
    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([saved]),
      graph(),
      "contact",
      "task",
      [discovered],
      "example.crm.dynamics.com"
    );

    assert.strictEqual(overlay.preferredPaths.length,1);
    assert.strictEqual(overlay.preferredPaths[0]?.state,"valid");
    assert.strictEqual(overlay.preferredPaths[0]?.route?.routeId,discovered.routeId);
    assert.strictEqual(overlay.preferredPaths[0]?.duplicateDiscoveredRouteId,discovered.routeId);
    assert.strictEqual(
      overlay.preferredPaths[0]?.validation.historicallyVerifiedInActiveEnvironment,
      true
    );
  });

  test("projects a valid saved path even when ordinary discovery did not return it",async()=>{
    const saved=artifact();
    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([saved]),
      graph(),
      "contact",
      "task",
      [],
      "example.crm.dynamics.com"
    );

    assert.strictEqual(overlay.preferredPaths.length,1);
    assert.strictEqual(overlay.preferredPaths[0]?.state,"valid");
    assert.strictEqual(overlay.preferredPaths[0]?.route?.routeId,`business-path:${saved.id}`);
    assert.deepStrictEqual(overlay.preferredPaths[0]?.route?.entities,["contact","careplan","task"]);
  });

  test("keeps a stale preferred path visible but does not project it as executable",async()=>{
    const staleHops=[
      {...hops[0],navigationProperty:"old_navigation"},
      hops[1]
    ];
    const saved=artifact({hops:staleHops});
    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([saved]),
      graph(),
      "contact",
      "task",
      [discoveredRoute()],
      "example.crm.dynamics.com"
    );

    assert.strictEqual(overlay.preferredPaths[0]?.state,"stale");
    assert.strictEqual(overlay.preferredPaths[0]?.route,undefined);
    assert.ok(
      overlay.preferredPaths[0]?.validation.issues.some(
        (item)=>item.code==="navigation-property-changed"
      )
    );
  });

  test("disabled saved paths are not pinned",async()=>{
    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([artifact({state:"disabled"})]),
      graph(),
      "contact",
      "task",
      [discoveredRoute()],
      "example.crm.dynamics.com"
    );
    assert.deepStrictEqual(overlay.preferredPaths,[]);
  });

  test("multiple preferred paths order by explicit priority then verification recency then stable id",async()=>{
    const directHop:BusinessPathHop={
      ordinal:1,
      fromTable:"contact",
      toTable:"task",
      relationshipSchemaName:"contact_tasks",
      relationshipType:"OneToMany",
      direction:"forward",
      navigationProperty:"contact_tasks",
      lookupAttribute:"regardingid"
    };
    const g=graph();
    g.entities.contact!.outboundRelationships.push({
      fromEntity:"contact",
      toEntity:"task",
      navigationPropertyName:"contact_tasks",
      schemaName:"contact_tasks",
      referencingAttribute:"regardingid",
      relationshipType:"OneToMany",
      direction:"oneToMany"
    });

    const laterPriority=artifact({priority:20,verifiedAt:"2026-08-18T03:00:00.000Z"});
    const firstPriority=artifact({
      priority:1,
      hops:[directHop],
      verifiedAt:"2026-08-18T01:00:00.000Z"
    });
    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([laterPriority,firstPriority]),
      g,
      "contact",
      "task",
      [],
      "example.crm.dynamics.com"
    );

    assert.deepStrictEqual(
      overlay.preferredPaths.map((item)=>item.artifact.id),
      [firstPriority.id,laterPriority.id]
    );
  });


  test("for equal priority, current metadata-valid preference sorts above stale preference",async()=>{
    const valid=artifact({priority:1,verifiedAt:"2026-08-18T01:00:00.000Z"});
    const staleHop:BusinessPathHop={
      ordinal:1,
      fromTable:"contact",
      toTable:"task",
      relationshipSchemaName:"old_contact_tasks",
      relationshipType:"OneToMany",
      direction:"forward",
      navigationProperty:"old_contact_tasks",
      lookupAttribute:"regardingid"
    };
    const stale=artifact({
      priority:1,
      hops:[staleHop],
      verifiedAt:"2026-08-18T04:00:00.000Z"
    });

    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([stale,valid]),
      graph(),
      "contact",
      "task",
      [],
      "example.crm.dynamics.com"
    );

    assert.strictEqual(overlay.preferredPaths[0]?.artifact.id,valid.id);
    assert.strictEqual(overlay.preferredPaths[0]?.state,"valid");
    assert.strictEqual(overlay.preferredPaths[1]?.state,"stale");
  });

  test("no matching saved path leaves discovery unchanged",async()=>{
    const discovered=discoveredRoute();
    const overlay=await buildGuidedTraversalBusinessPathOverlay(
      new MemoryRepository([]),
      graph(),
      "contact",
      "task",
      [discovered],
      "example.crm.dynamics.com"
    );
    assert.deepStrictEqual(overlay.preferredPaths,[]);
    assert.strictEqual(overlay.discoveredRoutes[0],discovered);
  });
});
