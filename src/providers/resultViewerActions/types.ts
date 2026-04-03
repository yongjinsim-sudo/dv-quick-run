export type ResultViewerActionPlacement = "primary" | "overflow";
export type ResultViewerActionGroup = "navigation" | "inspection" | "query";
export type ResultViewerQueryMode = "odata" | "fetchxml";

export interface ResultViewerActionPayload {
  guid?: string;
  entitySetName?: string;
  entityLogicalName?: string;
  columnName?: string;
  rawValue?: string;
  traversalSessionId?: string;
  traversalLegIndex?: number;
  carryField?: string;
  carryValue?: string;
}

export interface ResultViewerResolvedAction {
  id: string;
  title: string;
  icon: string;
  placement: ResultViewerActionPlacement;
  group: ResultViewerActionGroup;
  payload: ResultViewerActionPayload;
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
  queryMode?: ResultViewerQueryMode;
  columnName: string;
  rawValue: string;
  traversal?: ResultViewerTraversalActionContext;
}
