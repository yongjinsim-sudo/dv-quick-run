import { InvestigationInput, RecordContext, ResolvedInvestigationContext } from "./types.js";

export function buildResolvedInvestigationContext(args: {
  environmentName: string;
  input: InvestigationInput;
  activeRecordContext: RecordContext;
  primaryNameValue?: string;
  wasFallbackUsed: boolean;
}): ResolvedInvestigationContext {
  return {
    environmentName: args.environmentName,
    recordId: args.input.recordId ?? "",
    entityLogicalName: args.activeRecordContext.entityLogicalName,
    entitySetName: args.activeRecordContext.entitySetName,
    primaryIdField: args.activeRecordContext.primaryIdField,
    primaryNameField: args.activeRecordContext.primaryNameField,
    primaryNameValue: args.primaryNameValue,
    inferenceSource: args.activeRecordContext.inferenceSource,
    inputType: args.input.type,
    wasFallbackUsed: args.wasFallbackUsed
  };
}
