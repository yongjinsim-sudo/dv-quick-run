export type ParsedRecord = {
  entitySetName: string;
  id: string;
  selectFields: string[];
  primaryIdField?: string;
  source: "odataId" | "context+pk" | "arrayRecord";
};

export type ReadJsonResult = {
  json: any;
  used: "selection" | "document";
};