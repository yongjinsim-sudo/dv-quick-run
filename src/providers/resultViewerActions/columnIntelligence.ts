import { isLookupLikeAttributeType } from "../../metadata/metadataModel.js";

export type ResultViewerColumnKind = "system" | "primaryId" | "lookupGuid" | "businessGuid" | "businessIdentifier" | "guid" | "value";

export interface ResultViewerColumnAnalysis {
    kind: ResultViewerColumnKind;
    isSystem: boolean;
    isPrimaryId: boolean;
    isLookupGuid: boolean;
    isBusinessGuid: boolean;
    isBusinessIdentifier: boolean;
    isGuidLike: boolean;
    hasUsableValue: boolean;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function analyzeResultViewerColumn(input: {
    columnName?: string;
    rawValue?: string;
    primaryIdField?: string;
    guid?: string;
    fieldLogicalName?: string;
    fieldAttributeType?: string;
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
    const isBusinessGuid = hasUsableValue
        && isGuidLike
        && !isPrimaryId
        && !isLookupGuid
        && isBusinessGuidColumn({
            columnName,
            fieldLogicalName: input.fieldLogicalName,
            fieldAttributeType: input.fieldAttributeType
        });
    const isBusinessIdentifier = hasUsableValue
        && !isGuidLike
        && !isPrimaryId
        && !isLookupGuid
        && isBusinessIdentifierColumn({
            columnName,
            rawValue,
            fieldLogicalName: input.fieldLogicalName,
            fieldAttributeType: input.fieldAttributeType
        });

    let kind: ResultViewerColumnKind = "value";

    if (isSystem) {
        kind = "system";
    } else if (isPrimaryId) {
        kind = "primaryId";
    } else if (isLookupGuid) {
        kind = "lookupGuid";
    } else if (isBusinessGuid) {
        kind = "businessGuid";
    } else if (isBusinessIdentifier) {
        kind = "businessIdentifier";
    } else if (isGuidLike) {
        kind = "guid";
    }

    return {
        kind,
        isSystem,
        isPrimaryId,
        isLookupGuid,
        isBusinessGuid,
        isBusinessIdentifier,
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

function isBusinessGuidColumn(input: {
    columnName: string;
    fieldLogicalName?: string;
    fieldAttributeType?: string;
}): boolean {
    const candidateNames = [input.fieldLogicalName, input.columnName]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value) => !!value);

    if (!candidateNames.length) {
        return false;
    }

    if (input.fieldAttributeType && isLookupLikeAttributeType(input.fieldAttributeType)) {
        return true;
    }

    return candidateNames.some((name) => looksBusinessLikeIdentifierName(name));
}

function looksBusinessLikeIdentifierName(name: string): boolean {
    if (!name || name.includes("@") || name.includes(".")) {
        return false;
    }

    if (isLookupColumn(name)) {
        return false;
    }

    const normalized = name.replace(/[^a-z0-9_]/g, "");

    if (!normalized || normalized === "activityid" || normalized === "versionnumber") {
        return false;
    }

    if (normalized.endsWith("name") || normalized.endsWith("type") || normalized.endsWith("typename")) {
        return false;
    }

    return normalized.endsWith("id")
        || normalized.includes("_id")
        || normalized.includes("identifier")
        || normalized.includes("reference")
        || normalized.includes("external")
        || normalized.includes("source")
        || normalized.includes("legacy")
        || normalized.includes("unique")
        || normalized.includes("token")
        || normalized.includes("code")
        || normalized.includes("key")
        || normalized.includes("number")
        || normalized.includes("azurefhirid");
}


function isBusinessIdentifierColumn(input: {
    columnName: string;
    rawValue: string;
    fieldLogicalName?: string;
    fieldAttributeType?: string;
}): boolean {
    const attributeType = String(input.fieldAttributeType ?? "").trim().toLowerCase();
    if (attributeType && attributeType !== "string" && attributeType !== "memo") {
        return false;
    }

    const rawValue = input.rawValue.trim();
    if (rawValue.length < 6 || /\s{2,}/.test(rawValue)) {
        return false;
    }

    const candidateNames = [input.fieldLogicalName, input.columnName]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value) => !!value);

    return candidateNames.some((name) => looksBusinessLikeIdentifierName(name));
}
