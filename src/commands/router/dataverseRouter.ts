import { CommandContext } from "../context/commandContext.js";
import { runGetAction } from "./actions/execution/getAction.js";
import { runWhoAmIAction } from "./actions/execution/whoAmIAction.js";
import { runClearHistoryAction } from "./actions/execution/clearHistoryAction.js";
import { runGetMetadataAction } from "./actions/metadata/metadataAction.js";
import { runSmartGetAction, runSmartGetEditLastAction, runSmartGetRerunLastAction, runSmartGetFromGuidPickFieldsAction, runSmartGetFromGuidRawAction } from "./actions/smartGet/smartGetAction.js";
import { runSmartPatchAction, runSmartPatchEditLastAction, runSmartPatchRerunLastAction} from "./actions/smartPatch/smartPatchAction.js";
import { runGenerateQueryFromJsonAction } from "./actions/generation/generateQueryFromJsonAction.js";
import { runQueryUnderCursorAction } from "./actions/execution/runQueryUnderCursorAction.js";
import { runAddFieldsSelectAction } from "./actions/queryMutation/addFieldsSelectAction.js";
import { runAddFilterAction } from "./actions/queryMutation/addFilterAction.js";
import { runAddExpandAction } from "./actions/queryMutation/addExpandAction.js";
import { runAddOrderByAction } from "./actions/queryMutation/addOrderByAction.js";
import { runExplainQueryAction } from "./actions/explain/explainQueryAction.js";
import { runRelationshipExplorerAction } from "./actions/relationships/relationshipExplorerAction.js";
import { runRelationshipGraphViewAction } from "./actions/relationships/relationshipGraphViewAction.js";
import { investigateRecordAction } from "./actions/investigateRecord/investigateRecordAction.js";
import { runTrySampleQueryAction } from "./actions/onboarding/trySampleQueryAction.js";
import { runTryFetchXmlSampleAction } from "./actions/onboarding/tryFetchXmlSampleAction.js";
import { runFindPathToTableAction } from "./actions/traversal/findPathToTableAction.js";
import { runContinueTraversalAction } from "./actions/traversal/continueTraversalAction.js";
import { runBatchQueriesAction } from "./actions/execution/runBatchQueriesAction.js";

export type DvQuickRunAction = "get" 
  | "whoAmI" 
  | "clearHistory" 
  | "getMetadata" 
  | "smartGet" 
  | "smartGetEditLast" 
  | "smartGetRerunLast" 
  | "smartPatch" 
  | "smartPatchRerunLast" 
  | "smartPatchEditLast" 
  | "smartGetFromGuidPickFields" 
  | "smartGetFromGuidRaw" 
  | "generateQueryFromJson" 
  | "runQueryUnderCursor"
  | "addFieldsSelect"
  | "addFilter"
  | "addExpand"
  | "addOrderBy"
  | "explainQuery"
  | "relationshipExplorer"
  | "relationshipGraphView"
  | "investigateRecord"
  | "trySampleQuery"
  | "tryFetchXmlSample"
  | "findPathToTable"
  | "continueTraversal"
  | "runBatchQueries";

export async function runDvQuickRunAction(action: DvQuickRunAction, ctx: CommandContext): Promise<void> {
  switch (action) {
    case "get":
      return await runGetAction(ctx);

    case "getMetadata":
      return await runGetMetadataAction(ctx);

    case "whoAmI":
      return await runWhoAmIAction(ctx);

    case "clearHistory":
      return await runClearHistoryAction(ctx);

    case "smartGet":
      return await runSmartGetAction(ctx);

    case "smartGetEditLast":
      return await runSmartGetEditLastAction(ctx);

    case "smartGetRerunLast":
      return await runSmartGetRerunLastAction(ctx);

    case "smartPatch":
      return await runSmartPatchAction(ctx);

    case "smartPatchRerunLast":
      return await runSmartPatchRerunLastAction(ctx);

    case "smartPatchEditLast":
      return await runSmartPatchEditLastAction(ctx);

    case "smartGetFromGuidPickFields":
      return await runSmartGetFromGuidPickFieldsAction(ctx);      
    
    case "smartGetFromGuidRaw":
      return await runSmartGetFromGuidRawAction(ctx);      
    
    case "generateQueryFromJson":
      return await runGenerateQueryFromJsonAction(ctx);

    case "runQueryUnderCursor":
      return await runQueryUnderCursorAction(ctx);

    case "addFieldsSelect":
      return await runAddFieldsSelectAction(ctx);

    case "addFilter":
      return await runAddFilterAction(ctx);

    case "addExpand":
      return await runAddExpandAction(ctx);

    case "addOrderBy":
      return await runAddOrderByAction(ctx);

    case "explainQuery":
      return await runExplainQueryAction(ctx);

    case "relationshipExplorer":
      return await runRelationshipExplorerAction(ctx);

    case "relationshipGraphView":
      return await runRelationshipGraphViewAction(ctx);

    case "investigateRecord":
      return investigateRecordAction(ctx);

    case "trySampleQuery":
      return await runTrySampleQueryAction(ctx);

    case "tryFetchXmlSample":
      return await runTryFetchXmlSampleAction(ctx);

    case "findPathToTable":
      return await runFindPathToTableAction(ctx);
    
    case "continueTraversal":
      return await runContinueTraversalAction(ctx);

    case "runBatchQueries":
      return await runBatchQueriesAction(ctx);

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}