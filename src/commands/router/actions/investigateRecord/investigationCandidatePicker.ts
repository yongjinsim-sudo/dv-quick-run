import * as vscode from "vscode";
import { ScoredInvestigationCandidate } from "./investigationCandidateTypes.js";

export async function pickInvestigationCandidate(
  candidates: ScoredInvestigationCandidate[]
): Promise<ScoredInvestigationCandidate | undefined> {
  if (!candidates.length) {
    return undefined;
  }

  const groupedByRow = groupCandidatesByRow(candidates);

  if (groupedByRow.length > 1) {
    const selectedRow = await pickCandidateRow(groupedByRow);
    if (!selectedRow) {
      return undefined;
    }

    return pickBestCandidateWithinRow(selectedRow.candidates);
  }

  return pickBestCandidateWithinRow(candidates);
}

function groupCandidatesByRow(
  candidates: ScoredInvestigationCandidate[]
): Array<{
  sourceIndex?: number;
  candidates: ScoredInvestigationCandidate[];
}> {
  const map = new Map<string, ScoredInvestigationCandidate[]>();

  for (const candidate of candidates) {
    const key =
      candidate.sourceIndex !== undefined
        ? `row:${candidate.sourceIndex}`
        : "row:root";

    const existing = map.get(key);
    if (existing) {
      existing.push(candidate);
    } else {
      map.set(key, [candidate]);
    }
  }

  return [...map.entries()]
    .map(([key, grouped]) => ({
      sourceIndex: key === "row:root" ? undefined : Number(key.replace("row:", "")),
      candidates: [...grouped].sort(compareCandidates)
    }))
    .sort((a, b) => {
      const aIndex = a.sourceIndex ?? -1;
      const bIndex = b.sourceIndex ?? -1;
      return aIndex - bIndex;
    });
}

async function pickCandidateRow(
  rows: Array<{
    sourceIndex?: number;
    candidates: ScoredInvestigationCandidate[];
  }>
): Promise<{
  sourceIndex?: number;
  candidates: ScoredInvestigationCandidate[];
} | undefined> {
  const picked = await vscode.window.showQuickPick(
    rows.map((row) => {
      const best = row.candidates[0];
      const rowLabel =
        row.sourceIndex !== undefined
          ? `Record ${row.sourceIndex + 1}`
          : "Root Record";

      return {
        label: rowLabel,
        description: `${best.fieldName ?? "candidate"} = ${best.recordId}`,
        detail: `tier ${best.precedenceTier} | ${best.candidateType} | confidence ${best.confidence} | ${best.reason}`,
        row
      };
    }),
    {
      placeHolder: "Select a record to investigate"
    }
  );

  return picked?.row;
}

async function pickBestCandidateWithinRow(
  candidates: ScoredInvestigationCandidate[]
): Promise<ScoredInvestigationCandidate | undefined> {
  if (!candidates.length) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const sorted = [...candidates].sort(compareCandidates);
  const strongest = sorted[0];
  const second = sorted[1];

  if (!second) {
    return strongest;
  }

  if (shouldAutoSelect(strongest, second)) {
    return strongest;
  }

  const picked = await vscode.window.showQuickPick(
    sorted.map((candidate) => ({
      label: `${candidate.fieldName ?? "unknown"} = ${candidate.recordId}`,
      description: `tier ${candidate.precedenceTier} | ${candidate.candidateType} | confidence ${candidate.confidence}`,
      detail: candidate.reason,
      candidate
    })),
    {
      placeHolder: "Multiple record id candidates found. Select which one to investigate"
    }
  );

  return picked?.candidate;
}

function shouldAutoSelect(
  strongest: ScoredInvestigationCandidate,
  second: ScoredInvestigationCandidate
): boolean {
  if (strongest.precedenceTier < second.precedenceTier) {
    return strongest.autoSelectEligible || strongest.candidateType === "primary";
  }

  const confidenceGap = strongest.confidence - second.confidence;

  if (
    strongest.autoSelectEligible &&
    second.precedenceTier === strongest.precedenceTier &&
    confidenceGap >= 10
  ) {
    return true;
  }

  if (
    strongest.confidence >= 70 &&
    strongest.candidateType === "primary" &&
    second.candidateType !== "primary" &&
    confidenceGap >= 15
  ) {
    return true;
  }

  return false;
}

function compareCandidates(
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
