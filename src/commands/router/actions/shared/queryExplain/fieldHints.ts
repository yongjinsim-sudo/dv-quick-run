export function getFieldHint(fieldName: string): string | undefined {
  const key = fieldName.trim().toLowerCase();

  if (!key) {return undefined;}

  if (key === "statecode") {
    return "Common Dataverse state field, often used for active/inactive-style state.";
  }

  if (key === "statuscode") {
    return "Common Dataverse status reason field.";
  }

  if (key === "createdon") {
    return "Record creation timestamp.";
  }

  if (key === "modifiedon") {
    return "Record last modified timestamp.";
  }

  if (key === "ownerid") {
    return "Owner lookup for the record.";
  }

  if (key === "createdby") {
    return "Lookup to the user or process that created the record.";
  }

  if (key === "modifiedby") {
    return "Lookup to the user or process that last updated the record.";
  }

  if (key.startsWith("_") && key.endsWith("_value")) {
    return "Dataverse lookup backing column storing the related record ID.";
  }

  if (key.endsWith("id")) {
    return "Likely an identifier or relationship-linked field.";
  }

  return undefined;
}