import { InvestigationCandidate } from "./investigationCandidateTypes.js";

const FIELD_GUID_REGEX =
  /"([^"]+)"\s*:\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"/g;

export function extractInvestigationCandidatesFromSelection(
  selectionText: string,
  entitySetHint?: string
): InvestigationCandidate[] {
  const results: InvestigationCandidate[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = FIELD_GUID_REGEX.exec(selectionText)) !== null) {
    const fieldName = match[1];
    const recordId = match[2];

    const sourceType = fieldName.endsWith("_value")
      ? "lookup"
      : "rootField";

    const key = `${fieldName}|${recordId}|${sourceType}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    results.push({
      fieldName,
      recordId,
      sourceType,
      entitySetHint
    });
  }

  return results;
}