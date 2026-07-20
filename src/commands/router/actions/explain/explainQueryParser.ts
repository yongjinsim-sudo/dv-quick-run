import { ParsedDataverseQuery, ParsedExpand, ParsedOrderBy, QueryParam, QueryParseDiagnostic } from "./explainQueryTypes.js";

function stripHttpMethod(input: string): string {
  return input.trim().replace(/^(?:GET|HEAD)\s+/i, "");
}

function stripWebApiPrefix(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/^api\/data\/v\d+(?:\.\d+)?\//i, "");
}

function normalizeInput(input: string): { normalized: string; sourceKind: "relative" | "absolute-url" } {
  const withoutMethod = stripHttpMethod(input);
  const withoutFragment = withoutMethod.split("#", 1)[0]?.trim() ?? "";

  if (/^https?:\/\//i.test(withoutFragment)) {
    try {
      const url = new URL(withoutFragment);
      const path = stripWebApiPrefix(url.pathname);
      return {
        normalized: `${path}${url.search}`,
        sourceKind: "absolute-url"
      };
    } catch {
      // Preserve the text for bounded parser diagnostics below.
    }
  }

  const queryIndex = withoutFragment.indexOf("?");
  const rawPath = queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
  const rawQuery = queryIndex >= 0 ? withoutFragment.slice(queryIndex) : "";
  return {
    normalized: `${stripWebApiPrefix(rawPath)}${rawQuery}`,
    sourceKind: "relative"
  };
}

function splitPathAndQuery(input: string): { pathPart: string; queryPart: string } {
  const text = input.trim();
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

  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  return splitTopLevel(queryPart, "&").map((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) {
      return { key: decode(part.trim()), value: "" };
    }

    return {
      key: decode(part.slice(0, idx).trim()),
      value: decode(part.slice(idx + 1).trim())
    };
  });
}

function buildParseDiagnostics(pathPart: string, params: QueryParam[]): QueryParseDiagnostic[] {
  const diagnostics: QueryParseDiagnostic[] = [];
  const counts = new Map<string, number>();

  for (const param of params) {
    const normalizedKey = param.key.trim().toLowerCase();
    if (!normalizedKey || !param.key.startsWith("$")) {
      diagnostics.push({
        code: "MalformedQueryOption",
        optionName: param.key || undefined,
        message: param.key
          ? `Query option \`${param.key}\` is malformed or missing the Dataverse \`$\` prefix.`
          : "A query option has no name."
      });
    }
    counts.set(normalizedKey, (counts.get(normalizedKey) ?? 0) + 1);
  }

  for (const [key, count] of counts) {
    if (key && count > 1) {
      diagnostics.push({
        code: "DuplicateQueryOption",
        optionName: key,
        message: `Query option \`${key}\` appears ${count} times; DVQR preserves the text but uses the first value for explanation.`
      });
    }
  }

  if (pathPart && !parseEntityPath(pathPart).entitySetName) {
    diagnostics.push({
      code: "UnsupportedQueryPath",
      message: `The query path \`${pathPart}\` is not a supported Dataverse entity-set path.`
    });
  }

  return diagnostics;
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
  const innerParams = splitTopLevel(inner, ";").map((part) => {
    const index = part.indexOf("=");
    return index < 0
      ? { key: part.trim(), value: "" }
      : { key: part.slice(0, index).trim(), value: part.slice(index + 1).trim() };
  });
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
  const normalizedInput = normalizeInput(input);
  const normalized = normalizedInput.normalized;
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
  const duplicateKeys = new Set(
    params
      .map((param) => param.key.toLowerCase())
      .filter((key, index, values) => values.indexOf(key) !== index)
  );

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
    unknownParams,
    duplicateParams: params.filter((param) => duplicateKeys.has(param.key.toLowerCase())),
    parseDiagnostics: buildParseDiagnostics(pathPart, params),
    sourceKind: normalizedInput.sourceKind
  };
}
