import type { FieldDef } from "../../../../../../services/entityFieldMetadataService.js";
import type { DiagnosticFinding, DiagnosticNarrowingSuggestion } from "../diagnosticTypes.js";
import type { ExecutionEvidence, ExecutionFieldObservation } from "../executionEvidence.js";
import type { RankedResultInsightCandidate } from "./resultInsightTypes.js";

function buildCandidateRationale(
  observation: ExecutionFieldObservation,
  totalRows: number,
  tier: DiagnosticNarrowingSuggestion["tier"],
  field?: FieldDef
): Omit<DiagnosticNarrowingSuggestion, "field"> {
  const label = field?.displayName?.trim();
  const fieldDescriptor = label && label.toLowerCase() !== observation.field.toLowerCase()
    ? `${label} (${observation.field})`
    : observation.field;

  if (observation.kind === "presence" || observation.nullCount >= Math.ceil(totalRows * 0.25)) {
    return {
      kind: "presence",
      tier,
      rationale: tier === "recommended"
        ? "business-meaningful presence split observed on this page"
        : "technical presence split observed on this page",
      reasons: [
        `populated in ${observation.nonNullCount} of ${totalRows} rows`,
        `null in ${observation.nullCount} of ${totalRows} rows`,
        tier === "recommended"
          ? `this may be a useful first filter if ${fieldDescriptor} reflects a meaningful business state`
          : "this can narrow the current page, but may be less intuitive as a first investigation filter"
      ],
      suggestedOperator: "ne",
      suggestedValue: null
    };
  }

  const topRepeated = observation.topValues.filter((item) => item.count >= 2);
  return {
    kind: "categorical",
    tier,
    rationale: tier === "recommended"
      ? "business-friendly categorical split observed on this page"
      : "repeated values observed on this page",
    reasons: topRepeated.map((item) => `\`${item.value}\` × ${item.count}`),
    suggestedOperator: topRepeated[0] ? "eq" : undefined,
    suggestedValue: topRepeated[0]?.value
  };
}

function buildObservedDetail(candidate: RankedResultInsightCandidate, totalRows: number): string {
  const { observation, field, tier } = candidate.item;
  const fieldLabel = field?.displayName?.trim();
  const renderedField = fieldLabel && fieldLabel.toLowerCase() !== observation.field.toLowerCase()
    ? `${fieldLabel} (\`${observation.field}\`)`
    : `\`${observation.field}\``;

  return observation.kind === "presence" || observation.nullCount >= Math.ceil(totalRows * 0.25)
    ? `${renderedField} is populated in ${observation.nonNullCount} of ${totalRows} rows and null in ${observation.nullCount}${tier === "secondary" ? " (more technical / secondary narrowing option)" : ""}`
    : `${renderedField} shows repeated values on this page: ${observation.topValues.filter((item) => item.count >= 2).map((item) => `\`${item.value}\` × ${item.count}`).join(", ")}${tier === "secondary" ? " (more technical / secondary narrowing option)" : ""}`;
}

export function buildResultInsightFindingFromCandidates(input: {
  evidence: ExecutionEvidence;
  parsedFilter?: string;
  selectedCandidates: RankedResultInsightCandidate[];
}): DiagnosticFinding | undefined {
  const { evidence, parsedFilter, selectedCandidates } = input;

  if (!selectedCandidates.length) {
    return undefined;
  }

  const scopeMessage = evidence.returnedFullPage && typeof evidence.requestedTop === "number" && evidence.requestedTop > 0
    ? `This query returned the full requested page size (${evidence.returnedRowCount} rows for $top=${evidence.requestedTop}), so the result set may still be broad.`
    : parsedFilter && parsedFilter.trim()
      ? `This query returned ${evidence.returnedRowCount} rows and still shows meaningful variation across the current result page.`
      : `This query returned ${evidence.returnedRowCount} rows and does not currently narrow results with a server-side filter.`;

  const suggestion = parsedFilter && parsedFilter.trim()
    ? "Use the observed patterns below to decide which additional filter might narrow the current result page more meaningfully."
    : "Use the observed patterns below to decide which field might be a good first server-side filter for this result page.";

  return {
    severity: "info",
    message: scopeMessage,
    suggestion,
    observedDetails: selectedCandidates.map((candidate) => buildObservedDetail(candidate, evidence.returnedRowCount)),
    narrowingSuggestions: selectedCandidates.map((candidate) => ({
      field: candidate.item.observation.field,
      ...buildCandidateRationale(candidate.item.observation, evidence.returnedRowCount, candidate.item.tier, candidate.item.field)
    })),
    confidence: evidence.returnedFullPage ? 0.9 : 0.78
  };
}
