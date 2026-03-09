import { SmartField, SmartGetState } from "./smartGetTypes.js";

export function normalizePath(input: string): string {
  const t = input.trim();
  if (!t) {return "";}
  return t.replace(/^\/+/, "");
}

export function buildResultTitle(path: string): string {
  let title = path.replace(/^\//, "");
  title = title.replace(/\?/g, "_").replace(/\$/g, "").replace(/=/g, "").replace(/&/g, "_");
  title = title.replace(/[<>:"/\\|?*\s]+/g, "_");
  return `DVQR_${title}`;
}

export function describeState(state: SmartGetState, stringifyExpr: (expr: any) => string): string {
  const filter = state.filter
    ? `${state.filter.fieldLogicalName} ${stringifyExpr(state.filter.expr)} ${state.filter.rawValue}`
    : "(none)";

  const orderBy = state.orderBy ? `${state.orderBy.fieldLogicalName} ${state.orderBy.direction}` : "(none)";

  return `entity=${state.entitySetName} fields=${state.selectedFieldLogicalNames.length} filter=${filter} orderBy=${orderBy} top=${state.top}`;
}

export function buildQueryFromState(
  state: SmartGetState,
  fields: SmartField[],
  buildFilterClause: (field: SmartField, expr: any, rawValue: string) => string
): { path: string; filterClause?: string } {
  const fieldMap = new Map(fields.map((f) => [f.logicalName.toLowerCase(), f]));
  const selectedFields = state.selectedFieldLogicalNames
    .map((ln) => fieldMap.get(ln.toLowerCase()))
    .filter((x): x is SmartField => !!x);

  const selectTokens = selectedFields.map((f) => f.selectToken).filter((x): x is string => !!x);

  if (selectTokens.length === 0) {
    throw new Error("None of the selected fields are selectable via $select.");
  }

  let filterClause: string | undefined;
  if (state.filter) {
    const ff = fieldMap.get(state.filter.fieldLogicalName.toLowerCase());
    if (ff) {
      filterClause = buildFilterClause(ff, state.filter.expr, state.filter.rawValue);
    }
  }

  const select = selectTokens.join(",");
  const qs: string[] = [`$select=${select}`, `$top=${state.top}`];

  if (filterClause) {qs.unshift(`$filter=${encodeURIComponent(filterClause)}`);}

  if (state.orderBy) {
    const ob = `${state.orderBy.fieldLogicalName} ${state.orderBy.direction}`;
    qs.push(`$orderby=${encodeURIComponent(ob)}`);
  }

  const path = normalizePath(`${state.entitySetName}?${qs.join("&")}`);
  return { path, filterClause };
}

export function buildGetCurl(url: string): string {
  return [
    "curl -X GET \\",
    `  "${url}" \\`,
    '  -H "Authorization: Bearer <<token>>" \\',
    '  -H "Accept: application/json"'
  ].join("\n");
}