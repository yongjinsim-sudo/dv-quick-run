import {
  InvestigationCandidate,
  ScoredInvestigationCandidate
} from "./investigationCandidateTypes.js";

const COMMON_RELATED_LOOKUP_FIELDS = new Set([
  "_ownerid_value",
  "_createdby_value",
  "_modifiedby_value",
  "_owninguser_value",
  "_transactioncurrencyid_value",
  "_owningbusinessunit_value"
]);

export function scoreInvestigationCandidates(
  candidates: InvestigationCandidate[],
  options: {
    entityLogicalName?: string;
    primaryIdField?: string;
    entitySetName?: string;
  }
): ScoredInvestigationCandidate[] {
  return candidates
    .map(candidate => scoreCandidate(candidate, options))
    .sort(compareScoredCandidates);
}

export function rescoreSelectedInvestigationCandidate(
  candidate: Pick<InvestigationCandidate, "recordId" | "fieldName" | "sourceType">,
  options: {
    entityLogicalName?: string;
    primaryIdField?: string;
    entitySetName?: string;
  }
): ScoredInvestigationCandidate {
  return scoreCandidate(candidate, options);
}

function scoreCandidate(
  candidate: InvestigationCandidate,
  options: {
    entityLogicalName?: string;
    primaryIdField?: string;
    entitySetName?: string;
  }
): ScoredInvestigationCandidate {
  const fieldName = candidate.fieldName?.toLowerCase() ?? "";
  const primaryIdField = options.primaryIdField?.toLowerCase();
  const entityLogicalName =
    options.entityLogicalName?.toLowerCase() ??
    deriveLogicalNameHint(primaryIdField, options.entitySetName);
  const contextPrimaryIdField = entityLogicalName ? `${entityLogicalName}id` : undefined;

  let confidence = 25;
  let precedenceTier = 5;
  let candidateType: ScoredInvestigationCandidate["candidateType"] = "unknown";
  let reason = "Generic guid candidate";

  if (primaryIdField && fieldName === primaryIdField) {
    confidence = 96;
    precedenceTier = 1;
    candidateType = "primary";
    reason = "Matches table primary id attribute";
  } else if (contextPrimaryIdField && fieldName === contextPrimaryIdField) {
    confidence = 92;
    precedenceTier = 2;
    candidateType = "primary";
    reason = "Matches OData-context primary id pattern";
  } else if (candidate.sourceType === "lookup") {
    confidence = 45;
    precedenceTier = 4;
    candidateType = "related";
    reason = "Lookup reference field";
  } else if (fieldName === "id") {
    confidence = 55;
    precedenceTier = 5;
    candidateType = "unknown";
    reason = "Generic id field";
  } else if (fieldName.endsWith("id")) {
    confidence = 50;
    precedenceTier = 5;
    candidateType = "unknown";
    reason = "Guid field with id suffix";
  } else if (candidate.sourceType === "collectionField") {
    confidence = 35;
    precedenceTier = 5;
    candidateType = "unknown";
    reason = "Collection row guid candidate";
  }

  if (COMMON_RELATED_LOOKUP_FIELDS.has(fieldName)) {
    confidence = Math.min(confidence, 20);
    precedenceTier = Math.max(precedenceTier, 4);
    candidateType = "related";
    reason = "Common related/system lookup field";
  }

  return {
    ...candidate,
    confidence,
    candidateType,
    reason,
    precedenceTier,
    autoSelectEligible: confidence >= 85
  };
}

function compareScoredCandidates(
  a: ScoredInvestigationCandidate,
  b: ScoredInvestigationCandidate
): number {
  if (a.precedenceTier !== b.precedenceTier) {
    return a.precedenceTier - b.precedenceTier;
  }

  if (b.confidence !== a.confidence) {
    return b.confidence - a.confidence;
  }

  const aPrimary = a.candidateType === "primary" ? 1 : 0;
  const bPrimary = b.candidateType === "primary" ? 1 : 0;
  if (bPrimary !== aPrimary) {
    return bPrimary - aPrimary;
  }

  return (a.fieldName ?? "").localeCompare(b.fieldName ?? "");
}

function deriveLogicalNameHint(
  primaryIdField?: string,
  entitySetName?: string
): string | undefined {
  if (primaryIdField?.endsWith("id") && primaryIdField.length > 2) {
    return primaryIdField.slice(0, -2);
  }

  const normalizedEntitySet = entitySetName?.trim().toLowerCase();
  if (!normalizedEntitySet) {
    return undefined;
  }

  if (normalizedEntitySet.endsWith("ies") && normalizedEntitySet.length > 3) {
    return `${normalizedEntitySet.slice(0, -3)}y`;
  }

  if (normalizedEntitySet.endsWith("ses") && normalizedEntitySet.length > 3) {
    return normalizedEntitySet.slice(0, -2);
  }

  if (normalizedEntitySet.endsWith("s") && normalizedEntitySet.length > 1) {
    return normalizedEntitySet.slice(0, -1);
  }

  return normalizedEntitySet;
}
