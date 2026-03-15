import {
  InvestigationCandidate
} from "./investigationCandidateTypes.js";

const GUID_REGEX =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

export function extractInvestigationCandidatesFromJson(
  root: Record<string, unknown>,
  entitySetHint?: string
): InvestigationCandidate[] {
  const candidates: InvestigationCandidate[] = [];

  // Root-level candidates
  candidates.push(...extractCandidatesFromObject(root, {
    sourceType: "rootField",
    entitySetHint
  }));

  // Collection-response candidates
  const value = root["value"];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return;
      }

      candidates.push(
        ...extractCandidatesFromObject(item as Record<string, unknown>, {
          sourceType: "collectionField",
          sourceIndex: index,
          entitySetHint
        })
      );
    });
  }

  return dedupeCandidates(candidates);
}

function extractCandidatesFromObject(
  obj: Record<string, unknown>,
  options: {
    sourceType: "rootField" | "collectionField";
    sourceIndex?: number;
    entitySetHint?: string;
  }
): InvestigationCandidate[] {
  const result: InvestigationCandidate[] = [];

  for (const [fieldName, value] of Object.entries(obj)) {
    if (typeof value !== "string") {
      continue;
    }

    if (!GUID_REGEX.test(value)) {
      continue;
    }

    result.push({
      recordId: value,
      fieldName,
      sourceType: fieldName.endsWith("_value") ? "lookup" : options.sourceType,
      sourceIndex: options.sourceIndex,
      entitySetHint: options.entitySetHint
    });
  }

  return result;
}

function dedupeCandidates(
  candidates: InvestigationCandidate[]
): InvestigationCandidate[] {
  const seen = new Set<string>();
  const result: InvestigationCandidate[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.recordId,
      candidate.fieldName ?? "",
      candidate.sourceType,
      candidate.sourceIndex ?? ""
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}