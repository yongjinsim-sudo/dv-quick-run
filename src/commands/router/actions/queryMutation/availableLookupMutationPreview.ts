import { applyExpand } from "../shared/expand/expandComposer.js";
import { buildEditorQuery, type ParsedEditorQuery } from "../shared/queryMutation/parsedEditorQuery.js";
import { setQueryOption, upsertCsvQueryOption } from "../shared/queryMutation/queryOptionMutator.js";
import type {
  MutationPreviewDetails,
  MutationPreviewFlowOptions,
  MutationResult
} from "../../../../refinement/queryPreview.js";

export type AvailableLookupTarget = {
  logicalName: string;
  displayName?: string;
  navigationPropertyName?: string;
};

export type AvailableLookup = {
  logicalName: string;
  displayName: string;
  attributeType: string;
  selectToken: string;
  targets: AvailableLookupTarget[];
  isPolymorphic: boolean;
};

export type LookupAction = "insertValue" | "insertExpand" | "insertBoth" | "copyReference";

export type AvailableLookupMutationPreview = {
  result: MutationResult;
  details: MutationPreviewDetails;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function targetLabel(target: AvailableLookupTarget): string {
  return target.displayName && normalize(target.displayName) !== normalize(target.logicalName)
    ? `${target.displayName} (${target.logicalName})`
    : target.logicalName;
}

export function buildAvailableLookupMutationPreview(
  originalQuery: string,
  parsed: ParsedEditorQuery,
  lookup: AvailableLookup,
  action: Exclude<LookupAction, "copyReference">,
  lookupTarget?: AvailableLookupTarget
): AvailableLookupMutationPreview | undefined {
  if (action === "insertValue" || action === "insertBoth") {
    upsertCsvQueryOption(parsed, "$select", [lookup.selectToken], "appendCsv");
  }

  if (action === "insertExpand" || action === "insertBoth") {
    if (!lookupTarget?.navigationPropertyName) {
      return undefined;
    }
    const existingExpand = parsed.queryOptions.get("$expand");
    const expanded = applyExpand(existingExpand ?? undefined, {
      relationship: lookupTarget.navigationPropertyName
    });
    setQueryOption(parsed, "$expand", expanded);
  }

  const updatedQuery = buildEditorQuery(parsed);
  const actionSummary = action === "insertValue"
    ? `Add ${lookup.selectToken} to $select.`
    : action === "insertExpand"
      ? `Add the metadata-valid navigation property ${lookupTarget?.navigationPropertyName ?? ""} to $expand.`
      : `Add ${lookup.selectToken} to $select and ${lookupTarget?.navigationPropertyName ?? ""} to $expand.`;

  return {
    result: {
      originalQuery,
      updatedQuery,
      summary: actionSummary
    },
    details: {
      heading: "Available lookup query rewrite",
      title: `Use ${lookup.displayName}`,
      summary: actionSummary,
      sections: [
        { label: "Lookup", value: `${lookup.displayName} (${lookup.logicalName})` },
        { label: "Lookup type", value: lookup.isPolymorphic ? "Polymorphic" : "Standard" },
        { label: "Value property", value: lookup.selectToken },
        ...(lookupTarget?.navigationPropertyName
          ? [{ label: "Target navigation", value: `${targetLabel(lookupTarget)} — ${lookupTarget.navigationPropertyName}` }]
          : [])
      ]
    }
  };
}

export function buildAvailableLookupPreviewFlowOptions(canApply: boolean): MutationPreviewFlowOptions {
  return {
    mode: canApply ? "applyOrCopy" : "copy",
    applyButtonLabel: "Apply Suggested Query",
    copyButtonLabel: "Copy Suggested Query",
    cancelledMessage: "DV Quick Run: Lookup preview cancelled. The query was not changed."
  };
}
