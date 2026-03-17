export type ResultViewerActionPlacement = "primary" | "overflow";

export interface ResultViewerActionPayload {
    guid?: string;
    entitySetName?: string;
    entityLogicalName?: string;
    columnName?: string;
    rawValue?: string;
}

export interface ResultViewerResolvedAction {
    id: string;
    title: string;
    icon: string;
    placement: ResultViewerActionPlacement;
    payload: ResultViewerActionPayload;
}

export interface ResultViewerActionContext {
    guid?: string;
    entitySetName?: string;
    entityLogicalName?: string;
    primaryIdField?: string;
    columnName: string;
    rawValue: string;
}
