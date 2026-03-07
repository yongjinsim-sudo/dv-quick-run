export const CLAUSE_FACTS: Record<string, string> = {
  "$select": "Limits the returned columns to only the requested fields.",
  "$filter": "Applies server-side filtering before rows are returned.",
  "$orderby": "Sorts the returned rows in the requested order.",
  "$top": "Caps the maximum number of rows returned.",
  "$expand": "Includes related records in the same response via navigation properties."
};

export const FILTER_OPERATOR_FACTS: Array<{ token: string; meaning: string }> = [
  { token: " eq ", meaning: "equals" },
  { token: " ne ", meaning: "does not equal" },
  { token: " gt ", meaning: "is greater than" },
  { token: " ge ", meaning: "is greater than or equal to" },
  { token: " lt ", meaning: "is less than" },
  { token: " le ", meaning: "is less than or equal to" },
  { token: " and ", meaning: "AND" },
  { token: " or ", meaning: "OR" },
  { token: "contains(", meaning: "contains text" },
  { token: "startswith(", meaning: "starts with" },
  { token: "endswith(", meaning: "ends with" },
  { token: "not ", meaning: "negates the following expression" }
];

export function clauseFact(key: string): string | undefined {
  return CLAUSE_FACTS[key];
}