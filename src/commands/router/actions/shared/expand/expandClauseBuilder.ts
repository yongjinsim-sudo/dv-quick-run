import type { ExpandPlan } from "./expandTypes.js";

export function buildExpandClause(plan: ExpandPlan): string {
  return plan.entries
    .map((entry) => `${entry.navigationPropertyName}($select=${entry.selectedFieldLogicalNames.join(",")})`)
    .join(",");
}
