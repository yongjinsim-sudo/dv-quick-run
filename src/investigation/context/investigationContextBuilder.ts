import type { InvestigationContextPatch } from "./investigationContextTypes.js";

function detectQueryType(queryText?: string): "odata" | "fetchxml" | "batch" | "unknown" {
  const value = queryText?.trim();

  if (!value) {
    return "unknown";
  }

  if (value.includes("$batch") || value.split(/\r?\n/).filter((line) => line.trim().length > 0).length > 1) {
    return "batch";
  }

  if (
    value.startsWith("<fetch")
    || value.includes("<fetch")
    || /[?&]fetchXml=/i.test(value)
    || /[?&]fetchxml=/i.test(value)
  ) {
    return "fetchxml";
  }

  return "odata";
}

export function buildQueryInvestigationContext(queryText?: string): InvestigationContextPatch {
  return {
    source: "resultViewer",
    currentQuery: {
      queryText,
      queryType: detectQueryType(queryText)
    }
  };
}

export function buildEntityInvestigationContext(logicalName?: string, displayName?: string, primaryIdAttribute?: string): InvestigationContextPatch {
  return {
    currentEntity: {
      logicalName,
      displayName,
      primaryIdAttribute
    }
  };
}
