import { CommandContext } from "../context/commandContext.js";
import { runGetAction } from "./actions/getAction.js";
import { runWhoAmIAction } from "./actions/whoAmIAction.js";
import { runClearHistoryAction } from "./actions/clearHistoryAction.js";
import { runGetMetadataAction } from "./actions/metadataAction.js";
import { runSmartGetAction, runSmartGetEditLastAction, runSmartGetRerunLastAction, runSmartGetFromGuidPickFieldsAction, runSmartGetFromGuidRawAction } from "./actions/smartGetAction.js";
import { runSmartPatchAction, runSmartPatchEditLastAction, runSmartPatchRerunLastAction} from "./actions/smartPatchAction.js";
import { runGenerateQueryFromJsonAction } from "./actions/generateQueryFromJsonAction.js";
import { runQueryUnderCursorAction } from "./actions/runQueryUnderCursorAction.js";
import { runAddFieldsSelectAction } from "./actions/addFieldsSelectAction.js";
import { runAddFilterAction } from "./actions/addFilterAction.js";
import { runAddExpandAction } from "./actions/addExpandAction.js";
import { runAddOrderByAction } from "./actions/addOrderByAction.js";
import { runExplainQueryAction } from "./actions/explainQueryAction.js";
import { runRelationshipExplorerAction } from "./actions/relationshipExplorerAction.js";
import { runRelationshipGraphViewAction } from "./actions/relationshipGraphViewAction.js";

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
  | "relationshipGraphView";

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

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}