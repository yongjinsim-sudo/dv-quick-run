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

export type SmartPatchState = {
  entityLogicalName: string;
  entitySetName: string;
  id: string; // guid
  fields: PatchFieldValue[];
  ifMatch: string; // default "*"
};