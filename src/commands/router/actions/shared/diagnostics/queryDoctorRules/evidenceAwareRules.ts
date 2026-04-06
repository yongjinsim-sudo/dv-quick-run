import type { DiagnosticRule } from "../diagnosticRule.js";
import type { ExecutionFieldObservation } from "../executionEvidence.js";

const MIN_ANALYSABLE_ROWS = 12;

function hasSimpleDeterministicFilter(filter: string | undefined): boolean {
  if (!filter) {
    return false;
  }

  const trimmed = filter.trim();
  if (!trimmed) {
    return false;
  }

  if (/\b(and|or|not)\b/i.test(trimmed) || /\(|\)/.test(trimmed)) {
    return false;
  }

  return /^([A-Za-z_][A-Za-z0-9_]*)\s+(eq|ne|gt|ge|lt|le)\s+((?:true|false|null|-?\d+(?:\.\d+)?)|'(?:[^']|'')*')$/i.test(trimmed);
}

function isMeaningfulCandidate(
  observation: ExecutionFieldObservation,
  totalRows: number,
  filterFieldNames: string[]
): boolean {
  if (filterFieldNames.includes(observation.field)) {
    return false;
  }

  const nonNullRatio = observation.nonNullCount / totalRows;
  const dominanceRatio = observation.nonNullCount > 0 ? observation.mostCommonCount / observation.nonNullCount : 1;
  const hasMeaningfulPresenceSplit = observation.nullCount >= 3 && observation.nonNullCount >= 3 && nonNullRatio <= 0.85;
  const hasMeaningfulCategoricalSplit = observation.kind === "categorical"
    && observation.distinctCount >= 2
    && observation.distinctCount <= Math.min(8, Math.max(2, totalRows - 1))
    && dominanceRatio < 0.95
    && observation.topValues.some((item) => item.count >= 2);

  return hasMeaningfulPresenceSplit || hasMeaningfulCategoricalSplit;
}

function rankCandidate(observation: ExecutionFieldObservation, totalRows: number): number {
  const nonNullRatio = observation.nonNullCount / totalRows;
  const dominanceRatio = observation.nonNullCount > 0 ? observation.mostCommonCount / observation.nonNullCount : 1;
  const distinctPenalty = observation.distinctCount > 8 ? 0.5 : 1;
  const categoricalBonus = observation.kind === "categorical" ? 1.4 : 0.8;
  const presenceBalance = observation.nullCount > 0 ? 1 - Math.abs(nonNullRatio - 0.5) : 0;

  return ((1 - dominanceRatio) * 2 + presenceBalance + categoricalBonus) * distinctPenalty;
}

function buildCandidateRationale(observation: ExecutionFieldObservation, totalRows: number): { rationale: string; reasons: string[]; kind: "categorical" | "presence"; suggestedOperator?: "eq" | "ne"; suggestedValue?: string | null; } {
  if (observation.kind === "presence" || observation.nullCount >= Math.ceil(totalRows * 0.25)) {
    return {
      kind: "presence",
      rationale: "meaningful null/non-null split observed on this page",
      reasons: [
        `populated in ${observation.nonNullCount} of ${totalRows} rows`,
        `null in ${observation.nullCount} of ${totalRows} rows`,
        "filtering to non-null may narrow results"
      ],
      suggestedOperator: "ne",
      suggestedValue: null
    };
  }

  const topRepeated = observation.topValues.filter((item) => item.count >= 2);
  return {
    kind: "categorical",
    rationale: topRepeated.length <= 3
      ? "low-cardinality split observed on this page"
      : "repeated values observed across this result page",
    reasons: topRepeated.map((item) => `\`${item.value}\` × ${item.count}`),
    suggestedOperator: topRepeated[0] ? "eq" : undefined,
    suggestedValue: topRepeated[0]?.value
  };
}

export const evidenceAwareRules: DiagnosticRule[] = [
  (context) => {
    const evidence = context.executionEvidence;
    const parsed = context.parsed;

    if (!evidence || !parsed.isCollection || evidence.returnedRowCount < MIN_ANALYSABLE_ROWS) {
      return [];
    }

    const candidates = evidence.fieldObservations
      .filter((observation) => isMeaningfulCandidate(observation, evidence.returnedRowCount, evidence.filterFieldNames))
      .sort((left, right) => rankCandidate(right, evidence.returnedRowCount) - rankCandidate(left, evidence.returnedRowCount))
      .slice(0, 3);

    if (!candidates.length) {
      return [];
    }

    const scopeMessage = evidence.returnedFullPage && typeof evidence.requestedTop === "number" && evidence.requestedTop > 0
      ? `This query returned the full requested page size (${evidence.returnedRowCount} rows for $top=${evidence.requestedTop}), so the result set may still be broad.`
      : parsed.filter && hasSimpleDeterministicFilter(parsed.filter)
        ? `This query returned ${evidence.returnedRowCount} rows and still shows meaningful variation across the current result page.`
        : `This query returned ${evidence.returnedRowCount} rows and does not currently narrow results with a server-side filter.`;

    const suggestion = parsed.filter
      ? "Use the observed patterns below to decide which additional filter might narrow the current result page more meaningfully."
      : "Use the observed patterns below to decide which field might be a good first server-side filter for this result page.";

    return [{
      severity: "info",
      message: scopeMessage,
      suggestion,
      observedDetails: candidates.map((candidate) => candidate.kind === "presence" || candidate.nullCount >= Math.ceil(evidence.returnedRowCount * 0.25)
        ? `\`${candidate.field}\` is populated in ${candidate.nonNullCount} of ${evidence.returnedRowCount} rows and null in ${candidate.nullCount}`
        : `\`${candidate.field}\` shows repeated values on this page: ${candidate.topValues.filter((item) => item.count >= 2).map((item) => `\`${item.value}\` × ${item.count}`).join(", ")}`),
      narrowingSuggestions: candidates.map((candidate) => ({
        field: candidate.field,
        ...buildCandidateRationale(candidate, evidence.returnedRowCount)
      })),
      confidence: evidence.returnedFullPage ? 0.9 : 0.78
    }];
  }
];
