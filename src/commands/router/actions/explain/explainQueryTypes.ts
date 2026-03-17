export type QueryParam = {
  key: string;
  value: string;
};

export type ParsedOrderBy = {
  field: string;
  direction: "asc" | "desc";
};

export type ParsedExpand = {
  navigationProperty: string;
  nestedSelect: string[];
  raw: string;
};

export type ParsedDataverseQuery = {
  raw: string;
  normalized: string;
  pathPart: string;
  queryPart: string;
  entitySetName?: string;
  recordId?: string;
  isSingleRecord: boolean;
  isCollection: boolean;
  params: QueryParam[];
  select: string[];
  filter?: string;
  orderBy: ParsedOrderBy[];
  top?: number;
  expand: ParsedExpand[];
  unknownParams: QueryParam[];
};

export type ExplanationSection = {
  heading: string;
  lines: string[];
};

export type ExplainRelationshipReasoningNote = {
  clause: "$select" | "$orderby";
  field: string;
  baseEntity: string;
  relatedEntity: string;
  summary: string;
  suggestion?: string;
};
