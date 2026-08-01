import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { describeRelationshipPurpose } from "./mcpRelationshipExplainability.js";
import { presentRelationshipPurpose } from "./mcpRelationshipPresentation.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { McpRelationshipMetadataRepository } from "./mcpRelationshipMetadataRepository.js";

export class McpLookupNavigationApplicationService {
  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly metadata: McpRelationshipMetadataRepository
  ) {}

  public async resolveNavigationProperty(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable and targetTable are required." };
    }
    try {
      const context = await this.metadata.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const edges = await this.metadata.fetchRelationships(context.baseEnvironmentUrl, context.token, sourceTable);
      const direct = edges.filter((edge) => edge.toTable.toLowerCase() === targetTable.toLowerCase());
      const guessed = stringArg(args, "guessedProperty");
      const guessedPropertyMatched = guessed ? direct.some((edge) => edge.navigationProperty.toLowerCase() === guessed.toLowerCase()) : undefined;
      const structuredContent = {
        contractVersion: "dvqr-mcp-navigation-resolution-v2", sourceTable, targetTable, guessedProperty: guessed,
        guessedPropertyMatched,
        directMatches: direct.map((edge) => ({ ...edge, lookupValueProperty: edge.referencingAttribute ? `_${edge.referencingAttribute}_value` : undefined, expandFragment: `$expand=${edge.navigationProperty}` })),
        directExpansionAvailable: direct.length > 0,
        queryGenerated: false,
        placeholderQueryAllowed: false,
        evidenceBoundary: guessed && !guessedPropertyMatched
          ? `No metadata-verified navigation property named ${guessed} was found. Do not generate or present a query using this unverified name.`
          : undefined,
        suggestedNextActions: guessed && !guessedPropertyMatched
          ? ["Do not generate a placeholder query.", "Use one of the returned directMatches only when it matches the intended business relationship.", "Run dvqr_find_relationship_paths with relationshipHint to discover verified alternatives."]
          : direct.length ? ["Use the exact target-qualified navigation property.", "Validate selected nested fields before execution."] : ["Run dvqr_find_relationship_paths to discover a bridge-table path."]
      };
      if (guessed && !guessedPropertyMatched) {
        return { ok: false, code: "UnknownNavigationProperty", message: `No metadata-verified navigation property named ${guessed} connects ${sourceTable} to ${targetTable}. No query was generated.`, structuredContent };
      }
      return { ok: true, summary: direct.length ? `Resolved ${direct.length} direct navigation propert${direct.length === 1 ? "y" : "ies"} from ${sourceTable} to ${targetTable}.` : `No direct navigation property connects ${sourceTable} to ${targetTable}.`, structuredContent };
    } catch (error) { const structuredError = mapStructuredExecutionError(error); return { ok:false, code:"ExecutionFailed", message:structuredError.summary, structuredError }; }
  }

  public async explainLookup(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable=stringArg(args,"sourceTable"); const lookup=stringArg(args,"lookup");
    if(!sourceTable||!lookup) {
      return {ok:false,code:"InvalidArguments",message:"sourceTable and lookup are required."};
    }
    try {
      const context=await this.metadata.metadataContext(args);
      if("ok" in context) {
        return context;
      }
      const safe=sourceTable.replace(/'/g,"''");
      const baseUrl=`${context.baseEnvironmentUrl}/api/data/v9.2`;
      const [attrs, edges]=await Promise.all([
        mcpDataverseGet<any>({baseUrl,path:`/EntityDefinitions(LogicalName='${safe}')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,SchemaName,DisplayName,AttributeType,Targets`,token:context.token,timeoutMs:this.config.requestTimeoutMs}),
        this.metadata.fetchRelationships(context.baseEnvironmentUrl,context.token,sourceTable)
      ]);
      const rows=Array.isArray((attrs.data as any)?.value)?(attrs.data as any).value:[];
      const attr=rows.find((row:any)=>String(row.LogicalName??"").toLowerCase()===lookup.toLowerCase()||`_${String(row.LogicalName??"").toLowerCase()}_value`===lookup.toLowerCase());
      if(!attr) {
        return {ok:false,code:"InvalidArguments",message:`Lookup ${lookup} was not found on ${sourceTable}.`};
      }
      const logicalName=String(attr.LogicalName); const targets=Array.isArray(attr.Targets)?attr.Targets.map(String):[];
      const targetDetails=targets.map((target:string)=>({targetTable:target,navigationProperties:edges.filter((edge)=>edge.referencingAttribute?.toLowerCase()===logicalName.toLowerCase()&&edge.toTable.toLowerCase()===target.toLowerCase()).map((edge)=>({name:edge.navigationProperty,relationshipSchemaName:edge.relationshipSchemaName,expandFragment:`$expand=${edge.navigationProperty}`}))}));
      return {ok:true,summary:`${sourceTable}.${logicalName} targets ${targets.length || targetDetails.length} table${(targets.length||targetDetails.length)===1?"":"s"}.`,structuredContent:{contractVersion:"dvqr-mcp-lookup-explanation-v2",sourceTable,logicalName,displayName:attr.DisplayName,attributeType:attr.AttributeType,valueProperty:`_${logicalName}_value`,targets:targetDetails,relationshipPurpose:edges.find((edge)=>edge.referencingAttribute?.toLowerCase()===logicalName.toLowerCase())?presentRelationshipPurpose(describeRelationshipPurpose(edges.find((edge)=>edge.referencingAttribute?.toLowerCase()===logicalName.toLowerCase())!)):undefined,runtimeTargetAnnotation:`_${logicalName}_value@Microsoft.Dynamics.CRM.lookuplogicalname`,formattedValueAnnotation:`_${logicalName}_value@OData.Community.Display.V1.FormattedValue`,selectExample:`$select=_${logicalName}_value`,limitations:["Supported targets describe schema validity; the runtime annotation identifies the target used by a particular row."]}};
    } catch(error){const structuredError=mapStructuredExecutionError(error);return{ok:false,code:"ExecutionFailed",message:structuredError.summary,structuredError};}
  }

}
