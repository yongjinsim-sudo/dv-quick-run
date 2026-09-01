import * as assert from "node:assert";
import {
  BusinessPathRevalidationService,
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop,
  type BusinessPathMetadataProvider,
  type BusinessPathMetadataRelationship
} from "../../core/businessPaths/index.js";

const hops: readonly BusinessPathHop[] = [
  {
    ordinal: 1,
    fromTable: "contact",
    toTable: "msemr_careplan",
    relationshipSchemaName: "msemr_contact_msemr_careplan_PatientIdentifier",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "contact_careplans",
    lookupAttribute: "msemr_patientidentifier"
  },
  {
    ordinal: 2,
    fromTable: "msemr_careplan",
    toTable: "msemr_careplanactivity",
    relationshipSchemaName: "msemr_msemr_careplan_msemr_careplanactivity_CarePlan",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "careplan_activities",
    lookupAttribute: "msemr_careplan"
  },
  {
    ordinal: 3,
    fromTable: "msemr_careplanactivity",
    toTable: "sample_task",
    relationshipSchemaName: "sample_task_msemr_careplanactivity",
    relationshipType: "ManyToOne",
    direction: "forward",
    navigationProperty: "sample_Task",
    lookupAttribute: "sample_task"
  }
];

function artifact(): BusinessPathArtifact {
  const sourceTable = "contact";
  const targetTable = "sample_task";
  return {
    schemaVersion: DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id: businessPathId(sourceTable,targetTable,hops),
    name: "Contact to Task via Care Plan",
    sourceTable,
    targetTable,
    state: "preferred",
    hops,
    provenance: {
      promotedFrom: "runtime-validation",
      promotedAt: "2026-08-18T00:00:00.000Z",
      promotedBy: "user"
    },
    verification: {
      status: "verified",
      environment: { identity: "example.crm.dynamics.com" },
      verifiedAt: "2026-08-18T00:00:00.000Z",
      testedSourceCount: 1,
      reachedTargetCount: 1,
      observedTargetRows: 3,
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

const relationships: readonly BusinessPathMetadataRelationship[] = hops.map((hop)=>({
  fromTable: hop.fromTable,
  toTable: hop.toTable,
  relationshipSchemaName: hop.relationshipSchemaName,
  relationshipType: hop.relationshipType,
  navigationProperty: hop.navigationProperty,
  lookupAttribute: hop.lookupAttribute
}));

function provider(options: {
  missingTable?: string;
  mutate?: (items: BusinessPathMetadataRelationship[])=>void;
  failTable?: string;
  failRelationshipsFrom?: string;
} = {}): BusinessPathMetadataProvider {
  const tables=new Set(["contact","msemr_careplan","msemr_careplanactivity","sample_task"]);
  if(options.missingTable) tables.delete(options.missingTable.toLowerCase());
  const items=relationships.map((item)=>({...item}));
  options.mutate?.(items);
  return {
    async tableExists(name:string):Promise<boolean>{
      if(options.failTable?.toLowerCase()===name.toLowerCase()) throw new Error("table metadata unavailable");
      return tables.has(name.toLowerCase());
    },
    async relationshipsFrom(name:string):Promise<readonly BusinessPathMetadataRelationship[]>{
      if(options.failRelationshipsFrom?.toLowerCase()===name.toLowerCase()) throw new Error("relationship metadata unavailable");
      return items.filter((item)=>item.fromTable.toLowerCase()===name.toLowerCase());
    }
  };
}

suite("Managed Business Path metadata revalidation",()=>{
  test("returns valid only when every saved table and exact relationship identity still resolves",async()=>{
    const result=await new BusinessPathRevalidationService(provider()).revalidate(
      artifact(),
      "example.crm.dynamics.com"
    );
    assert.strictEqual(result.state,"valid");
    assert.strictEqual(result.checkedHops,3);
    assert.deepStrictEqual(result.issues,[]);
    assert.strictEqual(result.historicallyVerifiedInActiveEnvironment,true);
  });

  test("environment mismatch does not make a structurally valid path stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider()).revalidate(
      artifact(),
      "other.crm.dynamics.com"
    );
    assert.strictEqual(result.state,"valid");
    assert.strictEqual(result.historicallyVerifiedInActiveEnvironment,false);
  });

  test("reports unknown historical environment match when verification provenance has no environment",async()=>{
    const value={...artifact(),verification:{status:"not-runtime-verified" as const,bounded:true},applicability:{scope:"workspace" as const}};
    const result=await new BusinessPathRevalidationService(provider()).revalidate(value,"example.crm.dynamics.com");
    assert.strictEqual(result.state,"valid");
    assert.strictEqual(result.historicallyVerifiedInActiveEnvironment,null);
  });

  test("missing source table makes the path stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider({missingTable:"contact"})).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="source-table-missing"));
    assert.strictEqual(result.checkedHops,0);
  });

  test("missing intermediate table makes the path stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider({missingTable:"msemr_careplanactivity"})).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="intermediate-table-missing"));
  });

  test("missing target table makes the path stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider({missingTable:"sample_task"})).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="target-table-missing"));
  });

  test("missing relationship reports the exact broken hop",async()=>{
    const result=await new BusinessPathRevalidationService(provider({
      mutate:(items)=>items.splice(1,1)
    })).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    const broken=result.issues.find((item)=>item.code==="relationship-missing");
    assert.strictEqual(broken?.hopOrdinal,2);
    assert.strictEqual(broken?.fromTable,"msemr_careplan");
    assert.strictEqual(broken?.toTable,"msemr_careplanactivity");
  });

  test("same schema on a different endpoint is stale rather than silently accepted",async()=>{
    const result=await new BusinessPathRevalidationService(provider({
      mutate:(items)=>{ items[0]={...items[0],toTable:"account"}; }
    })).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="relationship-endpoint-changed"&&item.hopOrdinal===1));
  });

  test("relationship type drift is stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider({
      mutate:(items)=>{ items[2]={...items[2],relationshipType:"OneToMany"}; }
    })).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="relationship-type-changed"&&item.hopOrdinal===3));
  });

  test("navigation property drift is stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider({
      mutate:(items)=>{ items[0]={...items[0],navigationProperty:"renamed_navigation"}; }
    })).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="navigation-property-changed"&&item.hopOrdinal===1));
  });

  test("lookup drift is stale",async()=>{
    const result=await new BusinessPathRevalidationService(provider({
      mutate:(items)=>{ items[1]={...items[1],lookupAttribute:"new_parent"}; }
    })).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="lookup-attribute-changed"&&item.hopOrdinal===2));
  });

  test("metadata retrieval failure is unknown and never treated as stale or empty",async()=>{
    const result=await new BusinessPathRevalidationService(provider({
      failRelationshipsFrom:"msemr_careplan"
    })).revalidate(artifact());
    assert.strictEqual(result.state,"unknown");
    assert.ok(result.issues.some((item)=>item.code==="metadata-unavailable"));
    assert.ok(!result.issues.some((item)=>item.code==="relationship-missing"));
  });

  test("proven stale evidence remains stale if later metadata retrieval also fails",async()=>{
    const custom:BusinessPathMetadataProvider={
      async tableExists(){return true;},
      async relationshipsFrom(name:string){
        if(name==="contact") return [];
        throw new Error("later metadata outage");
      }
    };
    const result=await new BusinessPathRevalidationService(custom).revalidate(artifact());
    assert.strictEqual(result.state,"stale");
    assert.ok(result.issues.some((item)=>item.code==="relationship-missing"&&item.hopOrdinal===1));
    assert.ok(result.issues.some((item)=>item.code==="metadata-unavailable"));
  });

  test("revalidation never changes historical runtime verification",async()=>{
    const value=artifact();
    const before=JSON.stringify(value);
    const result=await new BusinessPathRevalidationService(provider({missingTable:"sample_task"})).revalidate(value);
    assert.strictEqual(result.state,"stale");
    assert.strictEqual(JSON.stringify(value),before);
    assert.strictEqual(value.verification?.status,"verified");
    assert.strictEqual(value.verification?.observedTargetRows,3);
  });
});
