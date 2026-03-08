export interface ParsedEditorQuery {
  raw: string;
  leadingSlash: boolean;
  entityPath: string;
  queryString: string;
  queryOptions: URLSearchParams;
}

export function parseEditorQuery(raw: string): ParsedEditorQuery {
  const trimmed = raw.trim();
  const leadingSlash = trimmed.startsWith("/");
  const normalized = trimmed.replace(/^\/+/, "");

  const qIndex = normalized.indexOf("?");
  const entityPath = qIndex >= 0 ? normalized.slice(0, qIndex).trim() : normalized.trim();
  const queryString = qIndex >= 0 ? normalized.slice(qIndex + 1).trim() : "";

  return {
    raw: trimmed,
    leadingSlash,
    entityPath,
    queryString,
    queryOptions: new URLSearchParams(queryString)
  };
}

export function buildEditorQuery(parsed: ParsedEditorQuery): string {
  const prefix = parsed.leadingSlash ? "/" : "";

  const pairs: string[] = [];
  for (const [key, value] of parsed.queryOptions.entries()) {
    if (!key) {continue;}
    if (value === "") {
      pairs.push(key);
    } else {
      pairs.push(`${key}=${value}`);
    }
  }

  const query = pairs.join("&");

  if (!query) {
    return `${prefix}${parsed.entityPath}`;
  }

  return `${prefix}${parsed.entityPath}?${query}`;
}

export function getEntitySetNameFromEditorQuery(entityPath: string): string | undefined {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\(|\/|$)/.exec(entityPath.trim());
  return match?.[1];
}