export type ShapeInput = {
  hasSelect: boolean;
  hasFilter: boolean;
  hasOrderBy: boolean;
  hasTop: boolean;
  hasExpand: boolean;
  expandHasNestedSelect: boolean;
  isSingleRecord: boolean;
  unknownParamKeys: string[];
};

export function buildQueryShapeAdvice(input: ShapeInput): string[] {
  const notes: string[] = [];

  if (input.isSingleRecord) {
    notes.push("Direct single-record retrieval by ID. This is a precise query shape.");
  } else {
    notes.push("Collection query shape detected.");
  }

  if (input.hasSelect) {
    notes.push("Uses $select to reduce payload size rather than returning full rows.");
  } else {
    notes.push("No $select detected, so Dataverse may return more columns than needed.");
  }

  if (input.hasFilter) {
    notes.push("Uses server-side filtering, which is generally better than filtering after retrieval.");
  }

  if (input.hasOrderBy) {
    notes.push("Applies explicit sorting, so the result order is controlled rather than implicit.");
  } else if (!input.isSingleRecord) {
    notes.push("No $orderby detected, so collection ordering may be implicit.");
  }

  if (input.hasTop) {
    notes.push("Uses $top to cap result size.");
  } else if (!input.isSingleRecord) {
    notes.push("No $top detected, so result size may be larger than expected.");
  }

  if (input.hasExpand) {
    notes.push("Uses $expand to load related data in the same response.");
  }

  if (input.expandHasNestedSelect) {
    notes.push("Nested $select inside $expand keeps related payloads tighter.");
  } else if (input.hasExpand) {
    notes.push("Expand detected without nested $select, so related payloads may be larger than needed.");
  }

  if (input.unknownParamKeys.length) {
    notes.push(`Additional query options detected: ${input.unknownParamKeys.join(", ")}.`);
  }

  return notes;
}