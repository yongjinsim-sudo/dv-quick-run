export type {
  ParsedDataverseQuery,
  ParsedExpand,
  ParsedOrderBy,
  QueryParam,
  QueryParseDiagnostic,
  QueryParseDiagnosticCode
} from "../../../../core/query/queryParseTypes.js";

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
