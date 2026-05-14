export type CustomApiExecutionSupportLevel = "preview-ready" | "inspect-only";

export interface CustomApiTypeMetadata {
  rawType: string;
  label: string;
  category: string;
  description: string;
  executionSupport: CustomApiExecutionSupportLevel;
  supportLabel: string;
  supportReason: string;
}

const TYPE_METADATA_BY_CODE: Record<string, Omit<CustomApiTypeMetadata, "rawType">> = {
  "0": {
    label: "Boolean",
    category: "Simple",
    description: "True/false value.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "Boolean values can be represented safely in a preview payload."
  },
  "1": {
    label: "DateTime",
    category: "Simple",
    description: "Date/time value.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "Date/time values can be represented safely once supplied explicitly."
  },
  "2": {
    label: "Decimal",
    category: "Simple",
    description: "Decimal number.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "Decimal values can be represented safely in a preview payload."
  },
  "3": {
    label: "Entity",
    category: "Complex",
    description: "Dataverse entity payload.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Entity payloads need explicit payload-shaping support before execution preview."
  },
  "4": {
    label: "EntityCollection",
    category: "Complex",
    description: "Collection of Dataverse entity payloads.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Entity collections need explicit payload-shaping support before execution preview."
  },
  "5": {
    label: "EntityReference",
    category: "Reference",
    description: "Reference to a Dataverse record.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Entity references need record-binding semantics before execution preview."
  },
  "6": {
    label: "Float",
    category: "Simple",
    description: "Floating point number.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "Float values can be represented safely in a preview payload."
  },
  "7": {
    label: "Integer",
    category: "Simple",
    description: "Whole number.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "Integer values can be represented safely in a preview payload."
  },
  "8": {
    label: "Money",
    category: "Complex",
    description: "Dataverse money value.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Money values need currency-aware payload support before execution preview."
  },
  "9": {
    label: "Picklist",
    category: "Choice",
    description: "Dataverse choice value.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Choice values need option metadata awareness before execution preview."
  },
  "10": {
    label: "String",
    category: "Simple",
    description: "Text value.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "String values can be represented safely in a preview payload."
  },
  "11": {
    label: "StringArray",
    category: "Collection",
    description: "Collection of text values.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Array payloads need explicit collection editing support before execution preview."
  },
  "12": {
    label: "Guid",
    category: "Simple",
    description: "Globally unique identifier.",
    executionSupport: "preview-ready",
    supportLabel: "Preview-ready",
    supportReason: "GUID values can be represented safely once supplied explicitly."
  }
};

const TYPE_METADATA_BY_LABEL: Record<string, Omit<CustomApiTypeMetadata, "rawType">> = Object.values(TYPE_METADATA_BY_CODE).reduce<Record<string, Omit<CustomApiTypeMetadata, "rawType">>>((accumulator, metadata) => {
  accumulator[metadata.label.toLowerCase()] = metadata;
  return accumulator;
}, {});

export function getCustomApiTypeMetadata(type: string | undefined): CustomApiTypeMetadata {
  const rawType = type?.trim() ?? "";
  const normalized = rawType.toLowerCase();
  const metadata = TYPE_METADATA_BY_CODE[rawType] ?? TYPE_METADATA_BY_LABEL[normalized];

  if (metadata) {
    return {
      rawType,
      ...metadata
    };
  }

  return {
    rawType,
    label: rawType || "Unknown",
    category: "Unknown",
    description: "Custom API parameter type was not recognized by DV Quick Run.",
    executionSupport: "inspect-only",
    supportLabel: "Inspect only",
    supportReason: "Unknown parameter types need manual inspection before execution preview."
  };
}

export function isCustomApiTypePreviewReady(type: string | undefined): boolean {
  return getCustomApiTypeMetadata(type).executionSupport === "preview-ready";
}
