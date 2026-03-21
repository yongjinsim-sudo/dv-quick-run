export type FetchXmlOperatorPresentationMode = "polished" | "raw" | "grouped";

export type FetchXmlOperatorSupportTier = "official" | "candidate" | "seeded";

export type FetchXmlOperatorValueCount = "none" | "single" | "multiple";

export type FetchXmlOperatorClassification =
    | "comparison"
    | "nullability"
    | "pattern"
    | "set"
    | "range"
    | "relativeDate"
    | "hierarchy"
    | "ownership";

export type FetchXmlOperatorCategory =
    | "string"
    | "number"
    | "date"
    | "datetime"
    | "lookup"
    | "choice"
    | "boolean"
    | "guid";

export interface FetchXmlOperatorDiagnostics {
    summary: string;
    notes?: string[];
}

export interface FetchXmlOperatorLabels {
    raw: string;
    polished: string;
    grouped: string;
}

export interface FetchXmlOperatorDef {
    key: string;
    labels: FetchXmlOperatorLabels;
    classification: FetchXmlOperatorClassification;
    supportTier: FetchXmlOperatorSupportTier;
    visibleInFetchXmlUi: boolean;
    requiresValue: boolean;
    valueCount: FetchXmlOperatorValueCount;
    supportedCategories: FetchXmlOperatorCategory[];
    description: string;
    diagnostics: FetchXmlOperatorDiagnostics;
    order: number;
}

export interface FetchXmlOperatorCatalog {
    version: number;
    presentationModes: FetchXmlOperatorPresentationMode[];
    supportTiers: FetchXmlOperatorSupportTier[];
    operators: FetchXmlOperatorDef[];
}