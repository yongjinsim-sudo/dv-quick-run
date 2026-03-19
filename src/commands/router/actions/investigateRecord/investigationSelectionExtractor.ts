import { InvestigationCandidate } from "./investigationCandidateTypes.js";

const GUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const SELECTION_PATTERNS: RegExp[] = [
  new RegExp(`"([^"]+)"\\s*:\\s*"?\\{?(${GUID_PATTERN})\\}?"?`, "g"),
  new RegExp(`'([^']+)'\\s*:\\s*'?\\{?(${GUID_PATTERN})\\}?'?`, "g"),
  new RegExp(`\\b([A-Za-z_][A-Za-z0-9_]*)\\b\\s*[:=]\\s*"?\\{?(${GUID_PATTERN})\\}?"?`, "g")
];

export function extractInvestigationCandidatesFromSelection(
  selectionText: string,
  entitySetHint?: string
): InvestigationCandidate[] {
  const results: InvestigationCandidate[] = [];
  const seen = new Set<string>();

  for (const pattern of SELECTION_PATTERNS) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(selectionText)) !== null) {
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
  }

  return results;
}