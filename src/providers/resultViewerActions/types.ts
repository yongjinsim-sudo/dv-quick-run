export type ResultViewerActionPlacement = "primary" | "overflow";
export type ResultViewerActionGroup = "refine" | "slice" | "dice" | "investigate" | "traversal" | "copy" | "metadata";
export type ResultViewerQueryMode = "odata" | "fetchxml";

export interface ResultViewerActionPayload {
  sliceOperation?: string;
  guid?: string;
  entitySetName?: string;
  entityLogicalName?: string;
  primaryIdField?: string;
  fieldLogicalName?: string;
  fieldAttributeType?: string;
  columnName?: string;
  rawValue?: string;
  traversalSessionId?: string;
  traversalLegIndex?: number;
  carryField?: string;
  carryValue?: string;
  sourceDocumentUri?: string;
  sourceRangeStartLine?: number;
  sourceRangeStartCharacter?: number;
  sourceRangeEndLine?: number;
  sourceRangeEndCharacter?: number;
}

export interface ResultViewerResolvedAction {
  id: string;
  title: string;
  icon: string;
  placement: ResultViewerActionPlacement;
  group: ResultViewerActionGroup;
  payload: ResultViewerActionPayload;
  isEnabled?: boolean;
  disabledReason?: string;
  kind?: "preview" | "execute" | "copy" | "open";
}

export interface ResultViewerTraversalActionContext {
  traversalSessionId: string;
  legIndex: number;
  hasNextLeg: boolean;
  nextLegLabel?: string;
  nextLegEntityName?: string;
  requiredCarryField?: string;
  isFinalLeg: boolean;
  canSiblingExpand?: boolean;
}

export interface ResultViewerActionContext {
  guid?: string;
  entitySetName?: string;
  entityLogicalName?: string;
  primaryIdField?: string;
  fieldLogicalName?: string;
  fieldAttributeType?: string;
  queryMode?: ResultViewerQueryMode;
  columnName: string;
  rawValue: string;
  sourceDocumentUri?: string;
  sourceRangeStartLine?: number;
  sourceRangeStartCharacter?: number;
  sourceRangeEndLine?: number;
  sourceRangeEndCharacter?: number;
  traversal?: ResultViewerTraversalActionContext;
}
