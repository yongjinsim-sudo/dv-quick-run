export type ResultViewerColumnKind = "system" | "primaryId" | "lookupGuid" | "guid" | "value";

export interface ResultViewerColumnAnalysis {
    kind: ResultViewerColumnKind;
    isSystem: boolean;
    isPrimaryId: boolean;
    isLookupGuid: boolean;
    isGuidLike: boolean;
    hasUsableValue: boolean;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function analyzeResultViewerColumn(input: {
    columnName?: string;
    rawValue?: string;
    primaryIdField?: string;
    guid?: string;
}): ResultViewerColumnAnalysis {
    const columnName = String(input.columnName ?? "").trim();
    const rawValue = String(input.rawValue ?? "").trim();
    const primaryIdField = String(input.primaryIdField ?? "").trim();
    const guid = String(input.guid ?? "").trim();

    const isSystem = isSystemColumn(columnName);
    const hasUsableValue = !isSystem && !!columnName && !!rawValue;
    const isGuidLike = isGuidValue(rawValue);
    const isPrimaryId = hasUsableValue && !!primaryIdField && columnName === primaryIdField && !!guid;
    const isLookupGuid = hasUsableValue && isLookupColumn(columnName) && isGuidLike;

    let kind: ResultViewerColumnKind = "value";

    if (isSystem) {
        kind = "system";
    } else if (isPrimaryId) {
        kind = "primaryId";
    } else if (isLookupGuid) {
        kind = "lookupGuid";
    } else if (isGuidLike) {
        kind = "guid";
    }

    return {
        kind,
        isSystem,
        isPrimaryId,
        isLookupGuid,
        isGuidLike,
        hasUsableValue
    };
}

export function isSystemColumn(columnName: string): boolean {
    return columnName.startsWith("@odata.");
}

export function isLookupColumn(columnName: string): boolean {
    return columnName.startsWith("_") && columnName.endsWith("_value");
}

export function isGuidValue(rawValue: string): boolean {
    return GUID_PATTERN.test(rawValue.trim());
}
