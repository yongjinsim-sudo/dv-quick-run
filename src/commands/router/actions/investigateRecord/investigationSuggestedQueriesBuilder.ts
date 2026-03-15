// src/commands/router/actions/investigateRecord/investigationSuggestedQueriesBuilder.ts
import { InvestigationLookupSuggestion, RecordContext } from "./types.js";

export function buildSuggestedQueries(args: {
  recordContext: RecordContext;
  recordId: string;
  rawQuery: string;
  minimalQuery: string;
  relatedRecords: InvestigationLookupSuggestion[];
}): string[] {
  const { recordContext, recordId, rawQuery, minimalQuery, relatedRecords } = args;
  const queries: string[] = [];

  queries.push(rawQuery);
  queries.push(minimalQuery);
  queries.push(buildAuditStyleQuery(recordContext, recordId));

  for (const related of relatedRecords.slice(0, 3)) {
    queries.push(...buildRelatedRecordQueries(related));
  }

  return dedupeQueries(queries);
}

function buildAuditStyleQuery(context: RecordContext, recordId: string): string {
  const fields = [
    context.primaryIdField,
    context.primaryNameField,
    "statecode",
    "statuscode",
    "createdon",
    "modifiedon",
    "_createdby_value",
    "_modifiedby_value",
    "_ownerid_value"
  ].filter((value): value is string => !!value?.trim());

  return `${context.entitySetName}(${recordId})?$select=${dedupeQueries(fields).join(",")}`;
}

function buildRelatedRecordQueries(related: InvestigationLookupSuggestion): string[] {
  if (!related.recordId) {
    return [];
  }

  const entitySets = new Set<string>();

  if (related.targetEntitySetName?.trim()) {
    entitySets.add(related.targetEntitySetName.trim());
  }

  for (const option of related.targetOptions ?? []) {
    if (option.entitySetName?.trim()) {
      entitySets.add(option.entitySetName.trim());
    }
  }

  return [...entitySets].map(entitySetName => `${entitySetName}(${related.recordId})`);
}

function dedupeQueries(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    output.push(trimmed);
  }

  return output;
}