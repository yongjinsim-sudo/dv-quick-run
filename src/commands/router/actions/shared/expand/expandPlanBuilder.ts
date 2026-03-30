import { validateExpandPlan, validateSelectedExpandFields } from "./expandPolicy.js";
import type { ExpandCandidate, ExpandPlan, ExpandPlanEntry, SelectedExpandFieldSet } from "./expandTypes.js";

export function buildSiblingExpandPlan(
  sourceEntityLogicalName: string,
  candidates: ExpandCandidate[],
  selectedFields: SelectedExpandFieldSet[]
): ExpandPlan {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.navigationPropertyName.toLowerCase(), candidate]));
  const mergedEntries = new Map<string, ExpandPlanEntry>();

  for (const fieldSet of selectedFields) {
    const error = validateSelectedExpandFields(fieldSet);
    if (error) {
      throw new Error(error);
    }

    const candidate = candidateMap.get(fieldSet.navigationPropertyName.toLowerCase());
    if (!candidate) {
      throw new Error(`Unknown expand candidate: ${fieldSet.navigationPropertyName}`);
    }

    const key = candidate.navigationPropertyName.toLowerCase();
    const existing = mergedEntries.get(key);
    const mergedFields = new Set<string>(existing?.selectedFieldLogicalNames ?? []);
    for (const field of fieldSet.selectedFieldLogicalNames) {
      const trimmed = field.trim();
      if (trimmed) {
        mergedFields.add(trimmed);
      }
    }

    mergedEntries.set(key, {
      navigationPropertyName: candidate.navigationPropertyName,
      targetEntityLogicalName: candidate.targetEntityLogicalName,
      selectedFieldLogicalNames: Array.from(mergedFields.values()).sort((a, b) => a.localeCompare(b)),
      depth: 0
    });
  }

  const plan: ExpandPlan = {
    kind: "sibling",
    sourceEntityLogicalName,
    entries: Array.from(mergedEntries.values()).sort((a, b) => a.navigationPropertyName.localeCompare(b.navigationPropertyName))
  };

  const validationError = validateExpandPlan(plan);
  if (validationError) {
    throw new Error(validationError);
  }

  return plan;
}
