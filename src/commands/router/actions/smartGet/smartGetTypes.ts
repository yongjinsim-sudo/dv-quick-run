import * as vscode from "vscode";

export type SmartChoiceOption = {
  value: number | boolean;
  label: string;
};

export type SmartField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
  selectToken?: string; // undefined => not selectable
  choiceOptions?: SmartChoiceOption[];
};

export type SmartGetOrderByState = {
  fieldLogicalName: string;
  direction: "asc" | "desc";
};

export type FilterExpr =
  | { kind: "binary"; op: "eq" | "ne" | "gt" | "ge" | "lt" | "le" }
  | { kind: "func"; fn: "contains" | "startswith" | "endswith" };

export type SmartGetFilterState = {
  fieldLogicalName: string;
  expr: FilterExpr;
  rawValue: string;
};

export type SmartGetState = {
  entityLogicalName: string;
  entitySetName: string;
  selectedFieldLogicalNames: string[];
  top: number;
  filter?: SmartGetFilterState;
  orderBy?: SmartGetOrderByState;
};

export type OrderByPickItem = vscode.QuickPickItem & {
  action: "pick" | "none" | "chooseOther";
  value?: SmartGetOrderByState;
};