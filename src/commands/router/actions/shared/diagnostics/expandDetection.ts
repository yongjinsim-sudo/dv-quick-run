export function hasExpandClause(query: string): boolean {
  return /\$expand\s*=/.test(query);
}