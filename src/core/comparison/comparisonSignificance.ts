import type { ComparisonDifference, ComparisonOperationalSignificance } from "./comparisonTypes.js";

const significanceRank: Record<ComparisonOperationalSignificance, number> = {
  Low: 1,
  Medium: 2,
  High: 3
};

export function maxComparisonSignificance(
  left: ComparisonOperationalSignificance,
  right: ComparisonOperationalSignificance
): ComparisonOperationalSignificance {
  return significanceRank[left] >= significanceRank[right] ? left : right;
}

export function calibrateComparisonDifference(difference: ComparisonDifference): ComparisonDifference {
  const calibrated = calibrateSignificance(difference);
  return calibrated === difference.significance
    ? difference
    : { ...difference, significance: calibrated };
}

export function calibrateSignificance(difference: ComparisonDifference): ComparisonOperationalSignificance {
  const title = difference.title.toLowerCase();
  const evidenceText = difference.evidence.map((item) => `${item.label} ${item.value ?? ""}`).join(" ").toLowerCase();

  if (title.includes("managed state") || evidenceText.includes("managed state drift")) {
    return "High";
  }

  if (title.includes("dvqr score")) {
    const delta = extractSignedNumber(evidenceText, /observed delta\s*[—-]\s*([+-]?\d+)/);
    if (delta !== undefined && Math.abs(delta) >= 20) {
      return "High";
    }
  }

  if (title.includes("real-time workflow") && appeared(difference)) {
    return "High";
  }

  if ((title.includes("plugin") || title.includes("automation")) && appeared(difference)) {
    return "High";
  }

  if (difference.kind === "OnlyInSource" || difference.kind === "OnlyInTarget") {
    return maxComparisonSignificance(difference.significance, "Medium");
  }

  return difference.significance;
}

function appeared(difference: ComparisonDifference): boolean {
  return (difference.sourceValue ?? "").toLowerCase().includes("no evidence")
    && !(difference.targetValue ?? "").toLowerCase().includes("no evidence");
}

function extractSignedNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
