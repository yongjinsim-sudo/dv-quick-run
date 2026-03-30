import type { ExpandCandidate, ExpandPlan, SelectedExpandFieldSet } from "./expandTypes.js";

export const MAX_SIBLING_EXPANDS = 3;

export function validateCandidateForSiblingExpand(candidate: ExpandCandidate): string | undefined {
  if (!candidate.navigationPropertyName.trim()) {
    return "Navigation property is required.";
  }
  if (!candidate.targetEntityLogicalName.trim()) {
    return "Target entity is required.";
  }
  if (candidate.isCollection) {
    return "Collection expansions are not supported for sibling expand.";
  }
  return undefined;
}

export function validateSelectedExpandFields(fieldSet: SelectedExpandFieldSet): string | undefined {
  if (!fieldSet.navigationPropertyName.trim()) {
    return "Navigation property is required.";
  }
  if (!fieldSet.selectedFieldLogicalNames.length) {
    return "At least one field must be selected.";
  }
  return undefined;
}

export function validateExpandPlan(plan: ExpandPlan): string | undefined {
  if (plan.kind === "sibling" && plan.entries.length > MAX_SIBLING_EXPANDS) {
    return `A maximum of ${MAX_SIBLING_EXPANDS} sibling expands are allowed per step.`;
  }
  for (const entry of plan.entries) {
    if (!entry.selectedFieldLogicalNames.length) {
      return `Expand ${entry.navigationPropertyName} requires at least one selected field.`;
    }
    if (plan.kind === "sibling" && entry.depth > 0) {
      return "Sibling expand only supports one expand level.";
    }
  }
  return undefined;
}
