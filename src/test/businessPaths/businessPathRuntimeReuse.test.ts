import * as assert from "node:assert";
import {
  DVQR_BUSINESS_PATH_SCHEMA_VERSION,
  businessPathId,
  type BusinessPathArtifact,
  type BusinessPathHop,
  type BusinessPathRevalidationResult
} from "../../core/businessPaths/index.js";
import {
  buildPreferredBusinessPathRuntimeArgs,
  businessPathRelationshipSchemas,
  businessPathTables,
  candidateMatchesPreferredBusinessPath
} from "../../mcp/mcpBusinessPathRuntimeReuse.js";
import { McpPreferredBusinessPathRuntimeValidationService } from "../../mcp/mcpPreferredBusinessPathRuntimeValidationService.js";

const hops: readonly BusinessPathHop[] = [
  {
    ordinal: 1,
    fromTable: "contact",
    toTable: "msemr_careplan",
    relationshipSchemaName: "patient_role",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "contact_careplans",
    lookupAttribute: "patientid"
  },
  {
    ordinal: 2,
    fromTable: "msemr_careplan",
    toTable: "bu_task",
    relationshipSchemaName: "careplan_tasks",
    relationshipType: "OneToMany",
    direction: "forward",
    navigationProperty: "careplan_tasks",
    lookupAttribute: "regardingid"
  }
];

function artifact(state:"preferred"|"disabled"="preferred"):BusinessPathArtifact{
  const sourceTable="contact";
  const targetTable="bu_task";
  return {
    schemaVersion:DVQR_BUSINESS_PATH_SCHEMA_VERSION,
    id:businessPathId(sourceTable,targetTable,hops),
    name:"Contact to Task via Care Plan",
    sourceTable,
    targetTable,
    state,
    hops,
    provenance:{
      promotedFrom:"runtime-validation",
      promotedAt:"2026-08-18T00:00:00.000Z",
      promotedBy:"user"
    },
    verification:{
      status:"verified",
      environment:{identity:"example.crm.dynamics.com"},
      verifiedAt:"2026-08-18T00:00:00.000Z",
      bounded:true
    },
    applicability:{scope:"workspace",verifiedEnvironmentIds:["example.crm.dynamics.com"]},
    createdAt:"2026-08-18T00:00:00.000Z",
    updatedAt:"2026-08-18T00:00:00.000Z"
  };
}

function revalidation(state:"valid"|"stale"|"unknown"="valid"):BusinessPathRevalidationResult{
  return {
    pathId:artifact().id,
    state,
    activeEnvironmentId:"example.crm.dynamics.com",
    historicallyVerifiedInActiveEnvironment:true,
    checkedTables:["contact","msemr_careplan","bu_task"],
    checkedHops:state==="valid"?2:1,
    issues:[]
  };
}

suite("Preferred Business Path runtime reuse",()=>{
  test("derives exact table and relationship-schema sequences from the saved artifact",()=>{
    assert.deepStrictEqual(businessPathTables(artifact()),["contact","msemr_careplan","bu_task"]);
    assert.deepStrictEqual(businessPathRelationshipSchemas(artifact()),["patient_role","careplan_tasks"]);
  });

  test("matches exact saved relationship variant and rejects another role with same tables",()=>{
    const exact:any={
      pathId:"exact",
      tables:["contact","msemr_careplan","bu_task"],
      bridgeTables:["msemr_careplan"],
      hops:[
        {fromTable:"contact",toTable:"msemr_careplan",relationshipSchemaName:"patient_role"},
        {fromTable:"msemr_careplan",toTable:"bu_task",relationshipSchemaName:"careplan_tasks"}
      ]
    };
    const author:any={
      ...exact,
      pathId:"author",
      hops:[
        {...exact.hops[0],relationshipSchemaName:"author_role"},
        exact.hops[1]
      ]
    };
    assert.strictEqual(
      candidateMatchesPreferredBusinessPath(exact,businessPathTables(artifact()),businessPathRelationshipSchemas(artifact())),
      true
    );
    assert.strictEqual(
      candidateMatchesPreferredBusinessPath(author,businessPathTables(artifact()),businessPathRelationshipSchemas(artifact())),
      false
    );
  });

  test("builds args for the existing validator without treating historical verification as current evidence",()=>{
    const args=buildPreferredBusinessPathRuntimeArgs({
      artifact:artifact(),
      revalidation:revalidation(),
      sourceRecordId:"record-1",
      runtimeArguments:{environmentName:"BUPA"},
      maxCandidates:4
    });

    assert.strictEqual(args.environmentName,"BUPA");
    assert.strictEqual(args.sourceTable,"contact");
    assert.strictEqual(args.targetTable,"bu_task");
    assert.strictEqual(args.sourceRecordId,"record-1");
    assert.deepStrictEqual(args.assertedBusinessPathTables,["contact","msemr_careplan","bu_task"]);
    assert.deepStrictEqual(args.assertedBusinessPathRelationshipSchemaNames,["patient_role","careplan_tasks"]);
    assert.strictEqual(args.preferredBusinessPathId,artifact().id);
    assert.strictEqual(args.preferredBusinessPathHistoricalVerification,"verified");
    assert.strictEqual(args.preferredBusinessPathHistoricallyVerifiedInActiveEnvironment,true);
  });

  test("refuses stale, unknown, disabled, mismatched, or unvalidated saved paths",()=>{
    assert.throws(()=>buildPreferredBusinessPathRuntimeArgs({
      artifact:artifact(),revalidation:revalidation("stale"),sourceRecordId:"record-1"
    }),/metadata-valid/i);
    assert.throws(()=>buildPreferredBusinessPathRuntimeArgs({
      artifact:artifact(),revalidation:revalidation("unknown"),sourceRecordId:"record-1"
    }),/metadata-valid/i);
    assert.throws(()=>buildPreferredBusinessPathRuntimeArgs({
      artifact:artifact("disabled"),revalidation:revalidation(),sourceRecordId:"record-1"
    }),/enabled Preferred/i);
    assert.throws(()=>buildPreferredBusinessPathRuntimeArgs({
      artifact:artifact(),
      revalidation:{...revalidation(),pathId:"bp_deadbeef"},
      sourceRecordId:"record-1"
    }),/does not belong/i);
  });

  test("delegates to the existing runtime validator rather than implementing another executor",async()=>{
    const calls:Record<string,unknown>[]=[];
    const runtimeValidator={
      validateBusinessPaths:async(args:Record<string,unknown>)=>{
        calls.push(args);
        return {ok:true,summary:"existing validator used",structuredContent:{validatedPaths:[]}} as any;
      }
    };
    const service=new McpPreferredBusinessPathRuntimeValidationService(runtimeValidator as any);
    const result=await service.validatePreferredPath({
      artifact:artifact(),
      revalidation:revalidation(),
      sourceRecordId:"record-1"
    });

    assert.strictEqual(result.ok,true);
    assert.strictEqual(calls.length,1);
    assert.deepStrictEqual(calls[0]?.assertedBusinessPathRelationshipSchemaNames,["patient_role","careplan_tasks"]);
  });
});
