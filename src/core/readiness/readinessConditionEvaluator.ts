import type { InvestigationInputContractViewV1, ReadonlyJsonObject } from "./readinessContracts.js";
import type {
  DeterministicConditionV1,
  InvestigationFindingFamilyV1
} from "./readinessProfile.js";
import { isJsonObject, readBoolean, readString, readStringArray } from "./readinessValueAccess.js";

const FINDING_FAMILIES: readonly InvestigationFindingFamilyV1[] = [
  "relationship", "metadata", "configuration", "identity"
];

function addFindingFamily(value: string | undefined, families: Set<InvestigationFindingFamilyV1>): void {
  if (value && FINDING_FAMILIES.includes(value as InvestigationFindingFamilyV1)) {
    families.add(value as InvestigationFindingFamilyV1);
  }
}

export function collectStructuredFindingFamilies(
  input: InvestigationInputContractViewV1
): ReadonlySet<InvestigationFindingFamilyV1> {
  const families = new Set<InvestigationFindingFamilyV1>();
  for (const family of readStringArray(input.findingFamilies)) {
    addFindingFamily(family, families);
  }
  for (const evidence of input.evidence) {
    if (!isJsonObject(evidence)) {
      continue;
    }
    addFindingFamily(readString(evidence.findingFamily), families);
    for (const family of readStringArray(evidence.findingFamilies)) {
      addFindingFamily(family, families);
    }
  }
  return families;
}

export interface ReadinessConditionContextV1 {
  readonly intent: ReadonlyJsonObject;
  readonly findingFamilies: ReadonlySet<InvestigationFindingFamilyV1>;
}

export function buildReadinessConditionContext(
  input: InvestigationInputContractViewV1
): ReadinessConditionContextV1 {
  return {
    intent: isJsonObject(input.intent) ? input.intent : {},
    findingFamilies: collectStructuredFindingFamilies(input)
  };
}

export function evaluateReadinessCondition(
  condition: DeterministicConditionV1,
  context: ReadinessConditionContextV1
): boolean {
  switch (condition.kind) {
    case "always":
      return true;
    case "intent-flag":
      return readBoolean(context.intent[condition.flag]) === condition.equals;
    case "finding-family":
      return condition.families.some((family) => context.findingFamilies.has(family));
    case "any":
      return condition.conditions.some((item) => evaluateReadinessCondition(item, context));
    case "all":
      return condition.conditions.every((item) => evaluateReadinessCondition(item, context));
  }
}
