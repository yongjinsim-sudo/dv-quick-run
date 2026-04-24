export type SmartField = {
  logicalName: string;
  attributeType: string;
  isValidForRead?: boolean;
};

export type PatchFieldValue = {
  logicalName: string;
  attributeType: string;
  rawValue: string; // what user typed
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
