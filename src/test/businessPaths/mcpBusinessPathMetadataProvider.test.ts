import * as assert from "node:assert";
import {
  McpBusinessPathMetadataProvider,
  businessPathEnvironmentIdentity
} from "../../mcp/mcpBusinessPathMetadataProvider.js";

suite("MCP Business Path metadata provider",()=>{
  test("normalizes environment identity to hostname",()=>{
    assert.strictEqual(
      businessPathEnvironmentIdentity("https://Example.crm.dynamics.com/"),
      "example.crm.dynamics.com"
    );
  });

  test("reuses entity catalogue and per-table relationship metadata within one revalidation scope",async()=>{
    let catalogueCalls=0;
    let relationshipCalls=0;
    const metadata={
      async fetchEntityCatalogue(){
        catalogueCalls+=1;
        return [
          {LogicalName:"contact"},
          {LogicalName:"account"}
        ];
      },
      async fetchRelationships(_base:string,_token:string,logicalName:string){
        relationshipCalls+=1;
        return [{
          fromTable:logicalName,
          toTable:"account",
          navigationProperty:"parentcustomerid_account",
          relationshipSchemaName:"contact_customer_accounts",
          referencingAttribute:"parentcustomerid",
          relationshipType:"ManyToOne" as const,
          direction:"manyToOne" as const,
          collectionValued:false,
          polymorphicTargetQualified:true
        }];
      }
    };

    const provider=new McpBusinessPathMetadataProvider(metadata as never,{
      baseEnvironmentUrl:"https://example.crm.dynamics.com",
      token:"token"
    });

    assert.strictEqual(await provider.tableExists("CONTACT"),true);
    assert.strictEqual(await provider.tableExists("account"),true);
    assert.strictEqual(catalogueCalls,1);

    const first=await provider.relationshipsFrom("contact");
    const second=await provider.relationshipsFrom("CONTACT");
    assert.strictEqual(relationshipCalls,1);
    assert.deepStrictEqual(first,second);
    assert.strictEqual(first[0]?.relationshipSchemaName,"contact_customer_accounts");
    assert.strictEqual(first[0]?.relationshipType,"ManyToOne");
    assert.strictEqual(first[0]?.lookupAttribute,"parentcustomerid");
  });

  test("ignores relationships without exact schema identity",async()=>{
    const metadata={
      async fetchEntityCatalogue(){return [{LogicalName:"contact"},{LogicalName:"account"}];},
      async fetchRelationships(){
        return [{
          fromTable:"contact",
          toTable:"account",
          navigationProperty:"parentcustomerid_account",
          relationshipSchemaName:undefined,
          referencingAttribute:"parentcustomerid",
          relationshipType:"ManyToOne" as const,
          direction:"manyToOne" as const,
          collectionValued:false
        }];
      }
    };
    const provider=new McpBusinessPathMetadataProvider(metadata as never,{
      baseEnvironmentUrl:"https://example.crm.dynamics.com",
      token:"token"
    });
    assert.deepStrictEqual(await provider.relationshipsFrom("contact"),[]);
  });
});
