import type { FieldDef } from "../../../../../services/entityFieldMetadataService.js";
import { isChoiceAttributeType, isLookupLikeAttributeType } from "../../../../../metadata/metadataModel.js";
import type { DiagnosticFinding, DiagnosticNarrowingSuggestion } from "./diagnosticTypes.js";
import type { ExecutionEvidence, ExecutionFieldObservation } from "./executionEvidence.js";

const MAX_CANDIDATES = 6;
const MAX_RECOMMENDED = 3;

type SuggestionTier = DiagnosticNarrowingSuggestion["tier"];

function toMetadataLookupToken(fieldLogicalName: string): string {
  return `_${fieldLogicalName}_value`;
}

function getBaseFieldLogicalName(observationField: string): string {
  const trimmed = observationField.trim();
  const lookupMatch = /^_(.+)_value$/i.exec(trimmed);
  return lookupMatch?.[1] ?? trimmed;
}

function buildFieldMetadataMap(fields: FieldDef[]): Map<string, FieldDef> {
  const map = new Map<string, FieldDef>();

  for (const field of fields) {
    const logicalName = field.logicalName?.trim();
    if (!logicalName) {
      continue;
    }

    map.set(logicalName, field);

    if (isLookupLikeAttributeType(field.attributeType)) {
      map.set(toMetadataLookupToken(logicalName), field);
    }
  }

  return map;
}

function looksLikeLookupBackingField(fieldName: string): boolean {
  return /^_.+_value$/i.test(fieldName.trim());
}

function semanticBoost(fieldName: string): number {
  const normalized = getBaseFieldLogicalName(fieldName).toLowerCase();
  let score = 0;

  const primaryBusinessTokens = ["status", "state"];
  const highValueTokens = ["intent", "priority", "category", "reason", "type", "kind", "channel", "source", "outcome"];
  const mediumValueTokens = ["stage", "classification", "result", "mode"];

  if (primaryBusinessTokens.some((token) => normalized.includes(token))) {
    score += 3.2;
  }

  if (highValueTokens.some((token) => normalized.includes(token))) {
    score += 2.2;
  }

  if (mediumValueTokens.some((token) => normalized.includes(token))) {
    score += 1.0;
  }

  if (normalized.endsWith("code")) {
    score += 0.4;
  }

  return score;
}

function isMeaningfulCandidate(
  observation: ExecutionFieldObservation,
  totalRows: number,
  filterFieldNames: string[],
  field?: FieldDef
): boolean {
  const baseFieldName = getBaseFieldLogicalName(observation.field);
  if (filterFieldNames.includes(observation.field) || filterFieldNames.includes(baseFieldName)) {
    return false;
  }

  const nonNullRatio = observation.nonNullCount / totalRows;
  const dominanceRatio = observation.nonNullCount > 0 ? observation.mostCommonCount / observation.nonNullCount : 1;
  const hasMeaningfulPresenceSplit = observation.nullCount >= 3 && observation.nonNullCount >= 3 && nonNullRatio <= 0.98;
  const hasMeaningfulCategoricalSplit = observation.kind === "categorical"
    && observation.distinctCount >= 2
    && observation.distinctCount <= Math.min(12, Math.max(2, totalRows - 1))
    && dominanceRatio < 0.97
    && observation.topValues.some((item) => item.count >= 2);

  const isBusinessChoiceField = Boolean(field && isChoiceAttributeType(field.attributeType))
    || semanticBoost(observation.field) >= 2.2;
  const hasUsefulChoiceSignal = observation.kind === "categorical"
    && isBusinessChoiceField
    && observation.distinctCount >= 2
    && observation.topValues.some((item) => item.count >= 2);

  return hasMeaningfulPresenceSplit || hasMeaningfulCategoricalSplit || hasUsefulChoiceSignal;
}

function fieldTypeScore(field?: FieldDef): number {
  if (!field?.attributeType) {
    return 0;
  }

  const attributeType = field.attributeType.trim().toLowerCase();

  if (attributeType === "status" || attributeType === "state") {
    return 4.0;
  }

  if (attributeType === "picklist" || attributeType === "multipicklist" || attributeType === "multiselectpicklist") {
    return 3.4;
  }

  if (attributeType === "boolean") {
    return 2.0;
  }

  if (attributeType === "lookup" || attributeType === "customer" || attributeType === "owner") {
    return -0.6;
  }

  if (attributeType === "string") {
    return 0.4;
  }

  return 0;
}

function choiceCardinalityScore(observation: ExecutionFieldObservation, field?: FieldDef): number {
  if (!field || !isChoiceAttributeType(field.attributeType) || observation.kind !== "categorical") {
    return 0;
  }

  if (observation.distinctCount >= 2 && observation.distinctCount <= 8) {
    return 1.8;
  }

  if (observation.distinctCount <= 12) {
    return 0.9;
  }

  return -0.5;
}

function sparsityPenalty(observation: ExecutionFieldObservation, totalRows: number): number {
  if (observation.kind === "categorical" && observation.distinctCount >= 2) {
    return 0;
  }

  const nonNullRatio = observation.nonNullCount / totalRows;

  if (nonNullRatio <= 0.01 || nonNullRatio >= 0.99) {
    return 3.5;
  }

  if (nonNullRatio <= 0.03 || nonNullRatio >= 0.97) {
    return 2.4;
  }

  if (nonNullRatio <= 0.08 || nonNullRatio >= 0.92) {
    return 1.2;
  }

  return 0;
}

function distributionScore(observation: ExecutionFieldObservation, totalRows: number): number {
  const nonNullRatio = observation.nonNullCount / totalRows;
  const dominanceRatio = observation.nonNullCount > 0 ? observation.mostCommonCount / observation.nonNullCount : 1;
  const presenceBalance = observation.nullCount > 0 ? 1 - Math.abs(nonNullRatio - 0.5) * 2 : 0;
  const categoricalBalance = observation.kind === "categorical" ? 1 - dominanceRatio : 0;
  return (presenceBalance * 2.2) + (categoricalBalance * 2.4);
}

function lookupBackingPenalty(observation: ExecutionFieldObservation, field?: FieldDef): number {
  if (looksLikeLookupBackingField(observation.field)) {
    return 3.2;
  }

  if (field && isLookupLikeAttributeType(field.attributeType)) {
    return 1.4;
  }

  return 0;
}

function rankCandidate(observation: ExecutionFieldObservation, totalRows: number, field?: FieldDef): number {
  const rawScore = distributionScore(observation, totalRows)
    + fieldTypeScore(field)
    + semanticBoost(observation.field)
    + choiceCardinalityScore(observation, field)
    - lookupBackingPenalty(observation, field)
    - sparsityPenalty(observation, totalRows);

  if (field && isChoiceAttributeType(field.attributeType) && observation.kind === "categorical" && observation.distinctCount >= 2) {
    return rawScore + 1.8;
  }

  return rawScore;
}

function determineTier(observation: ExecutionFieldObservation, field: FieldDef | undefined, score: number): SuggestionTier {
  if (score < 1.2) {
    return "secondary";
  }

  if (looksLikeLookupBackingField(observation.field)) {
    return "secondary";
  }

  if (field && isLookupLikeAttributeType(field.attributeType)) {
    return score >= 3 ? "recommended" : "secondary";
  }

  if (field && isChoiceAttributeType(field.attributeType) && observation.kind === "categorical" && observation.distinctCount >= 2) {
    return "recommended";
  }

  return "recommended";
}

function buildCandidateRationale(
  observation: ExecutionFieldObservation,
  totalRows: number,
  tier: SuggestionTier,
  field?: FieldDef
): { rationale: string; reasons: string[]; kind: "categorical" | "presence"; suggestedOperator?: "eq" | "ne"; suggestedValue?: string | null; tier: SuggestionTier; } {
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

export function buildResultInsightFinding(input: {
  evidence: ExecutionEvidence;
  parsedFilter?: string;
  fields?: FieldDef[];
}): DiagnosticFinding | undefined {
  const { evidence, parsedFilter, fields = [] } = input;
  const fieldMap = buildFieldMetadataMap(fields);

  const scoredCandidates = evidence.fieldObservations
    .map((observation) => {
      const field = fieldMap.get(observation.field) ?? fieldMap.get(getBaseFieldLogicalName(observation.field));
      return { observation, field };
    })
    .filter(({ observation, field }) => isMeaningfulCandidate(observation, evidence.returnedRowCount, evidence.filterFieldNames, field))
    .map(({ observation, field }) => {
      const score = rankCandidate(observation, evidence.returnedRowCount, field);
      const tier = determineTier(observation, field, score);
      return { observation, field, score, tier };
    })
    .sort((left, right) => right.score - left.score || left.observation.field.localeCompare(right.observation.field));

  const recommended = scoredCandidates.filter((item) => item.tier === "recommended").slice(0, MAX_RECOMMENDED);
  const secondary = scoredCandidates.filter((item) => item.tier === "secondary").slice(0, MAX_CANDIDATES - recommended.length);
  const selectedCandidates = [...recommended, ...secondary].slice(0, MAX_CANDIDATES);

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
    observedDetails: selectedCandidates.map(({ observation, field, tier }) => {
      const fieldLabel = field?.displayName?.trim();
      const renderedField = fieldLabel && fieldLabel.toLowerCase() !== observation.field.toLowerCase()
        ? `${fieldLabel} (\`${observation.field}\`)`
        : `\`${observation.field}\``;

      return observation.kind === "presence" || observation.nullCount >= Math.ceil(evidence.returnedRowCount * 0.25)
        ? `${renderedField} is populated in ${observation.nonNullCount} of ${evidence.returnedRowCount} rows and null in ${observation.nullCount}${tier === "secondary" ? " (more technical / secondary narrowing option)" : ""}`
        : `${renderedField} shows repeated values on this page: ${observation.topValues.filter((item) => item.count >= 2).map((item) => `\`${item.value}\` × ${item.count}`).join(", ")}${tier === "secondary" ? " (more technical / secondary narrowing option)" : ""}`;
    }),
    narrowingSuggestions: selectedCandidates.map(({ observation, field, tier }) => ({
      field: observation.field,
      ...buildCandidateRationale(observation, evidence.returnedRowCount, tier, field)
    })),
    confidence: evidence.returnedFullPage ? 0.9 : 0.78
  };
}
