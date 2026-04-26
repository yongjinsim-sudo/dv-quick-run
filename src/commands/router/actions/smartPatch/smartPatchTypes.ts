export type SmartChoiceOption = {
  value: number | boolean;
  label: string;
};

export type SmartField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
  choiceOptions?: SmartChoiceOption[];
};

export type PatchFieldValue = {
  logicalName: string;
  attributeType: string;
  rawValue: string; // raw Dataverse value as text; empty when setNull is true
  displayValue?: string; // human-readable preview value, e.g. Married (2) or Allow (false)
  setNull?: boolean;
};

export type SmartPatchRefreshSourceTarget = {
  sourceDocumentUri: string;
  sourceRangeStartLine: number;
  sourceRangeStartCharacter: number;
  sourceRangeEndLine: number;
  sourceRangeEndCharacter: number;
};

export type SmartPatchState = {
  entityLogicalName: string;
  entitySetName: string;
  id: string; // guid
  fields: PatchFieldValue[];
  ifMatch: string; // default "*"
  refreshSourceTarget?: SmartPatchRefreshSourceTarget;
};
