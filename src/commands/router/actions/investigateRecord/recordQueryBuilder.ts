import { BuiltRecordQueries, RecordContext } from "./types.js";

const DEFAULT_MINIMAL_FIELDS = [
  "statecode",
  "statuscode",
  "createdon",
  "modifiedon",
  "_ownerid_value"
];

export function buildRecordQueries(
  context: RecordContext,
  recordId: string
): BuiltRecordQueries {
  const minimalFields = buildMinimalFieldList(context);

  return {
    minimalQuery: `${context.entitySetName}(${recordId})?$select=${minimalFields.join(",")}`,
    rawQuery: `${context.entitySetName}(${recordId})`
  };
}

function buildMinimalFieldList(context: RecordContext): string[] {
  const fields = new Set<string>();

  if (context.primaryIdField) {
    fields.add(context.primaryIdField);
  }

  if (context.primaryNameField) {
    fields.add(context.primaryNameField);
  }

  for (const field of DEFAULT_MINIMAL_FIELDS) {
    fields.add(field);
  }

  return [...fields];
}