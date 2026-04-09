import type { FieldDef } from "../../../../../../services/entityFieldMetadataService.js";
import type { DiagnosticFinding, DiagnosticNarrowingSuggestion } from "../diagnosticTypes.js";
import type { ExecutionEvidence, ExecutionFieldObservation } from "../executionEvidence.js";
import type { RankedResultInsightCandidate } from "./resultInsightTypes.js";

function formatFieldDescriptor(observation: ExecutionFieldObservation, field?: FieldDef): string {
  const label = field?.displayName?.trim();
  return label && label.toLowerCase() !== observation.field.toLowerCase()
    ? `${label} (${observation.field})`
    : observation.field;
}

function quoteODataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderODataLiteral(value: string | number | boolean | null | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return quoteODataString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function buildSuggestedQuery(field: string, operator: "eq" | "ne" | undefined, value: string | number | boolean | null | undefined, parsedFilter?: string): string | undefined {
  if (!operator) {
    return undefined;
  }

  const renderedLiteral = renderODataLiteral(value);
  if (renderedLiteral === undefined) {
    return undefined;
  }

  const renderedPredicate = `${field} ${operator} ${renderedLiteral}`;

  if (!parsedFilter?.trim()) {
    return `$filter=${renderedPredicate}`;
  }

  return `$filter=(${parsedFilter.trim()}) and (${renderedPredicate})`;
}

function buildCandidateRationale(
  observation: ExecutionFieldObservation,
  totalRows: number,
  tier: DiagnosticNarrowingSuggestion["tier"],
  field?: FieldDef
): Omit<DiagnosticNarrowingSuggestion, "field"> {
  const fieldDescriptor = formatFieldDescriptor(observation, field);

  if (observation.kind === "presence" || observation.nullCount >= Math.ceil(totalRows * 0.25)) {
    return {
      kind: "presence",
      tier,
      rationale: tier === "recommended"
        ? "clear presence split observed on the current result page"
        : "secondary presence split observed on the current result page",
      reasons: [
        `present in ${observation.nonNullCount} of ${totalRows} rows`,
        `null in ${observation.nullCount} of ${totalRows} rows`,
        tier === "recommended"
          ? `${fieldDescriptor} looks like a practical next filter for narrowing this page`
          : `${fieldDescriptor} can narrow the page further, but is a weaker next step`
      ],
      suggestedOperator: "ne",
      suggestedValue: null
    };
  }

  const topRepeated = observation.topValues.filter((item) => item.count >= 2);
  const primaryValue = topRepeated[0];
  const primaryDisplayValue = primaryValue?.value;
  const primaryRawValue = primaryValue?.rawValue;

  return {
    kind: "categorical",
    tier,
    rationale: tier === "recommended"
      ? "strong repeated value pattern observed on the current result page"
      : "secondary repeated value pattern observed on the current result page",
    reasons: [
      ...topRepeated.slice(0, 3).map((item) => `value ${item.value} appears ${item.count} times`),
      tier === "recommended"
        ? `${fieldDescriptor} is a strong first narrowing dimension for this result page`
        : `${fieldDescriptor} is a possible follow-up narrowing dimension`
    ],
    suggestedOperator: primaryValue ? "eq" : undefined,
    suggestedValue: primaryRawValue,
    suggestedValueLabel: primaryDisplayValue
  };
}

function buildObservedDetail(candidate: RankedResultInsightCandidate, totalRows: number): string {
  const { observation, field, tier } = candidate.item;
  const renderedField = `\`${formatFieldDescriptor(observation, field)}\``;

  return observation.kind === "presence" || observation.nullCount >= Math.ceil(totalRows * 0.25)
    ? `${renderedField} is present in ${observation.nonNullCount} of ${totalRows} rows and null in ${observation.nullCount}${tier === "secondary" ? " (secondary option)" : ""}`
    : `${renderedField} shows repeated values on this page: ${observation.topValues.filter((item) => item.count >= 2).slice(0, 3).map((item) => `\`${item.value}\` × ${item.count}`).join(", ")}${tier === "secondary" ? " (secondary option)" : ""}`;
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

  const primaryCandidate = selectedCandidates[0];
  const additionalCandidates = selectedCandidates.slice(1);
  const primaryRationale = buildCandidateRationale(
    primaryCandidate.item.observation,
    evidence.returnedRowCount,
    primaryCandidate.item.tier,
    primaryCandidate.item.field
  );

  const primaryFieldDescriptor = formatFieldDescriptor(primaryCandidate.item.observation, primaryCandidate.item.field);
  const scopeMessage = evidence.returnedFullPage && typeof evidence.requestedTop === "number" && evidence.requestedTop > 0
    ? `Based on ${evidence.returnedRowCount} returned rows (full page for $top=${evidence.requestedTop}), the clearest next narrowing step is \`${primaryFieldDescriptor}\`.`
    : parsedFilter && parsedFilter.trim()
      ? `Based on ${evidence.returnedRowCount} returned rows, \`${primaryFieldDescriptor}\` is the clearest next narrowing dimension after the current filter.`
      : `Based on ${evidence.returnedRowCount} returned rows, \`${primaryFieldDescriptor}\` is the clearest first server-side filter for this result page.`;

  const suggestion = primaryRationale.suggestedOperator
    ? `Narrow on \`${primaryFieldDescriptor}\`${primaryRationale.suggestedValue === null ? " with a null/presence split" : ` using ${primaryRationale.suggestedOperator} ${String(primaryRationale.suggestedValueLabel ?? primaryRationale.suggestedValue)}`}.`
    : `Use \`${primaryFieldDescriptor}\` as the next narrowing dimension.`;

  const suggestedQuery = buildSuggestedQuery(
    primaryCandidate.item.observation.field,
    primaryRationale.suggestedOperator,
    primaryRationale.suggestedValue,
    parsedFilter
  );

  return {
    severity: "info",
    message: scopeMessage,
    suggestion,
    suggestedQuery: suggestedQuery ? {
      query: suggestedQuery,
      label: `Preview narrowing on ${primaryCandidate.item.observation.field}`
    } : undefined,
    observedDetails: [
      buildObservedDetail(primaryCandidate, evidence.returnedRowCount),
      ...additionalCandidates.map((candidate) => buildObservedDetail(candidate, evidence.returnedRowCount))
    ],
    narrowingSuggestions: [
      {
        field: primaryCandidate.item.observation.field,
        ...primaryRationale
      },
      ...additionalCandidates.map((candidate) => ({
        field: candidate.item.observation.field,
        ...buildCandidateRationale(candidate.item.observation, evidence.returnedRowCount, "secondary", candidate.item.field)
      }))
    ],
    confidence: evidence.returnedFullPage ? 0.92 : 0.82
  };
}
