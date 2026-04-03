export type FilterBuilderFieldType = "text" | "choice" | "boolean" | "numeric" | "datetime";

export type FilterBuilderOperator =
  | "eq"
  | "ne"
  | "contains"
  | "startswith"
  | "endswith"
  | "gt"
  | "ge"
  | "lt"
  | "le"
  | "null"
  | "notNull";

export interface FilterClauseModel {
  fieldLogicalName: string;
  fieldType: FilterBuilderFieldType;
  operator: FilterBuilderOperator;
  valueKind: "none" | "single";
  value?: string;
  selectToken?: string;
}

export interface FilterExpressionModel {
  combinator: "and"; // v0.7.6 constraint (future: "or", grouped logic)
  clauses: FilterClauseModel[];
}

export interface BuildFilterInsight {
  kind: "query.mutate.filterExpression";
  expression: FilterExpressionModel;
  mergeStrategy: "replace" | "appendAnd";
}
