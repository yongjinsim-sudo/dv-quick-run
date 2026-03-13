import { ParsedDataverseQuery, ParsedExpand, ParsedOrderBy, QueryParam } from "./explainQueryTypes.js";

function normalizeInput(input: string): string {
  return input.trim().replace(/^\/+/, "");
}

function splitPathAndQuery(input: string): { pathPart: string; queryPart: string } {
  const text = normalizeInput(input);
  const idx = text.indexOf("?");

  if (idx < 0) {
    return { pathPart: text, queryPart: "" };
  }

  return {
    pathPart: text.slice(0, idx),
    queryPart: text.slice(idx + 1)
  };
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === "'") {
      if (inSingleQuote && input[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote) {
      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth = Math.max(0, depth - 1);
      } else if (ch === delimiter && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = "";
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseQueryParams(queryPart: string): QueryParam[] {
  if (!queryPart.trim()) {
    return [];
  }

  return splitTopLevel(queryPart, "&").map((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) {
      return { key: part.trim(), value: "" };
    }

    return {
      key: part.slice(0, idx).trim(),
      value: part.slice(idx + 1).trim()
    };
  });
}

function firstParamValue(params: QueryParam[], key: string): string | undefined {
  return params.find((p) => p.key.toLowerCase() === key.toLowerCase())?.value;
}

function parseEntityPath(pathPart: string): {
  entitySetName?: string;
  recordId?: string;
  isSingleRecord: boolean;
  isCollection: boolean;
} {
  const clean = pathPart.trim();
  const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]+)\))?$/.exec(clean);

  if (!match) {
    return {
      entitySetName: undefined,
      recordId: undefined,
      isSingleRecord: false,
      isCollection: false
    };
  }

  const entitySetName = match[1];
  const recordId = match[2]?.trim();

  return {
    entitySetName,
    recordId,
    isSingleRecord: !!recordId,
    isCollection: !recordId
  };
}

function parseSelect(value?: string): string[] {
  if (!value) {
    return [];
  }

  return splitTopLevel(value, ",").map((x) => x.trim()).filter(Boolean);
}

function parseOrderBy(value?: string): ParsedOrderBy[] {
  if (!value) {
    return [];
  }

  return splitTopLevel(value, ",")
    .map((part) => {
      const bits = part.trim().split(/\s+/).filter(Boolean);
      if (!bits.length) {
        return undefined;
      }

      return {
        field: bits[0],
        direction: bits[1]?.toLowerCase() === "desc" ? "desc" : "asc"
      } as ParsedOrderBy;
    })
    .filter((x): x is ParsedOrderBy => !!x);
}

function parseTop(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseSingleExpand(expandPart: string): ParsedExpand {
  const trimmed = expandPart.trim();
  const openIdx = trimmed.indexOf("(");

  if (openIdx < 0 || !trimmed.endsWith(")")) {
    return {
      navigationProperty: trimmed,
      nestedSelect: [],
      raw: trimmed
    };
  }

  const navigationProperty = trimmed.slice(0, openIdx).trim();
  const inner = trimmed.slice(openIdx + 1, -1).trim();
  const innerParams = parseQueryParams(inner);
  const nestedSelect = parseSelect(firstParamValue(innerParams, "$select"));

  return {
    navigationProperty,
    nestedSelect,
    raw: trimmed
  };
}

function parseExpand(value?: string): ParsedExpand[] {
  if (!value) {
    return [];
  }

  return splitTopLevel(value, ",")
    .map((part) => parseSingleExpand(part))
    .filter((x) => !!x.navigationProperty);
}

export function parseDataverseQuery(input: string): ParsedDataverseQuery {
  const normalized = normalizeInput(input);
  const { pathPart, queryPart } = splitPathAndQuery(normalized);
  const path = parseEntityPath(pathPart);
  const params = parseQueryParams(queryPart);

  const select = parseSelect(firstParamValue(params, "$select"));
  const filter = firstParamValue(params, "$filter");
  const orderBy = parseOrderBy(firstParamValue(params, "$orderby"));
  const top = parseTop(firstParamValue(params, "$top"));
  const expand = parseExpand(firstParamValue(params, "$expand"));

  const known = new Set(["$select", "$filter", "$orderby", "$top", "$expand"]);
  const unknownParams = params.filter((p) => !known.has(p.key.toLowerCase()));

  return {
    raw: input,
    normalized,
    pathPart,
    queryPart,
    entitySetName: path.entitySetName,
    recordId: path.recordId,
    isSingleRecord: path.isSingleRecord,
    isCollection: path.isCollection,
    params,
    select,
    filter,
    orderBy,
    top,
    expand,
    unknownParams
  };
}
