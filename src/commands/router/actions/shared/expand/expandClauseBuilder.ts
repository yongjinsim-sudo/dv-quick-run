import type { ExpandPlan } from "./expandTypes.js";
import { serializeExpandNodes, type ExpandNode } from "./expandComposer.js";

function toExpandNode(entry: ExpandPlan["entries"][number]): ExpandNode {
  return {
    relationship: entry.navigationPropertyName,
    select: entry.selectedFieldLogicalNames,
    expand: (entry.nestedChildren ?? []).map((child) => toExpandNode(child))
  };
}

export function buildExpandClause(plan: ExpandPlan): string {
  return serializeExpandNodes(plan.entries.map((entry) => toExpandNode(entry)));
}
