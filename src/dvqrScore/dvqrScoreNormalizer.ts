export function normaliseDvqrPrimitive(rawValue: number, softCap: number, maxContribution: number): number {
  if (!Number.isFinite(rawValue) || rawValue <= 0 || softCap <= 0 || maxContribution <= 0) {
    return 0;
  }

  const clampedRawValue = Math.max(0, rawValue);
  const compressed = Math.log(clampedRawValue + 1) / Math.log(softCap + 1);
  return Math.min(maxContribution, maxContribution * compressed);
}

function applyLowEndDamping(score: number): number {
  if (score <= 25) {
    return score * 0.65;
  }

  if (score <= 45) {
    const dampingProgress = (score - 25) / 20;
    const dampingStrength = 0.35 * (1 - dampingProgress);
    return score * (1 - dampingStrength);
  }

  return score;
}

export function normaliseDvqrDisplayScore(rawDensityIndex: number): number {
  if (!Number.isFinite(rawDensityIndex) || rawDensityIndex <= 0) {
    return 0;
  }

  // v0.11.1 calibration: use the weighted primitive ceiling as the public
  // display baseline. Vanilla Dataverse core tables should sit around the
  // High-entry orientation range when multiple visible evidence rows are high,
  // leaving Very High for exceptional operational investigation gravity.
  //
  // A small low-end damping pass keeps near-empty entities visually quiet
  // without flattening the mid/high operational-density range.
  const weightedCeiling = 80;
  const linearScore = (100 * rawDensityIndex) / weightedCeiling;
  const dampedScore = applyLowEndDamping(linearScore);
  return Math.max(0, Math.min(100, Math.round(dampedScore)));
}
