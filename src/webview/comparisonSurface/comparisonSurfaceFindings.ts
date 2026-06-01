import type { ComparisonDifference, ComparisonOperationalSignificance, ComparisonViewModel } from "../../core/comparison/index.js";
import { escapeHtml, significanceRank, slug } from "./comparisonSurfacePrimitives.js";

interface TopOperationalSignal {
  readonly groupTitle: string;
  readonly groupId: string;
  readonly title: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly kind: string;
  readonly impact: string;
  readonly priority: number;
}

interface ComparisonSurfaceFindingsHelpers {
  readonly shortGroupTitle: (title: string) => string;
  readonly simplifyDifferenceTitle: (difference: ComparisonDifference, sourceLabel: string, targetLabel: string) => string;
  readonly getParticipationDensitySignalTitle: (difference: ComparisonDifference, sourceLabel: string, targetLabel: string) => string | undefined;
  readonly getOperationalImpactSummary: (difference: ComparisonDifference, sourceLabel: string, targetLabel: string) => string;
  readonly getSignalPriority: (difference: ComparisonDifference) => number;
}

function normalizeSignalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gu, "guid")
    .replace(/(dev|sit|uat|test|tst|perf|preprod|pre-prod|prod|production|sandbox|sbx)/gu, "env")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function getTopOperationalSignals(
  model: ComparisonViewModel,
  helpers: ComparisonSurfaceFindingsHelpers
): readonly TopOperationalSignal[] {
  const sorted = model.groups
    .flatMap((group) => group.differences.map((difference) => ({
      groupTitle: helpers.shortGroupTitle(group.title),
      groupId: group.id,
      title: helpers.getParticipationDensitySignalTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)
        ?? helpers.simplifyDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel),
      significance: difference.significance,
      kind: difference.kind,
      impact: helpers.getOperationalImpactSummary(difference, model.summary.sourceLabel, model.summary.targetLabel),
      priority: helpers.getSignalPriority(difference)
    })))
    .sort((left, right) => {
      const priority = right.priority - left.priority;
      if (priority !== 0) {
        return priority;
      }

      const rank = significanceRank(right.significance) - significanceRank(left.significance);
      if (rank !== 0) {
        return rank;
      }

      const groupRank = helpers.shortGroupTitle(left.groupTitle).localeCompare(helpers.shortGroupTitle(right.groupTitle));
      if (groupRank !== 0) {
        return groupRank;
      }

      return left.title.localeCompare(right.title);
    });

  const selected: TopOperationalSignal[] = [];
  const seen = new Set<string>();
  const perGroup = new Map<string, number>();

  for (const signal of sorted) {
    const key = `${signal.groupId}:${normalizeSignalKey(signal.title)}`;
    if (seen.has(key)) {
      continue;
    }

    const groupCount = perGroup.get(signal.groupId) ?? 0;
    if (groupCount >= 3 && selected.length < 4) {
      continue;
    }

    seen.add(key);
    perGroup.set(signal.groupId, groupCount + 1);
    selected.push(signal);

    if (selected.length >= 5) {
      break;
    }
  }

  return selected;
}

export function renderTopOperationalSignals(
  model: ComparisonViewModel,
  helpers: ComparisonSurfaceFindingsHelpers
): string {
  const signals = getTopOperationalSignals(model, helpers);
  if (signals.length === 0) {
    return "";
  }

  const items = signals.map((signal) => `<li data-significance="${escapeHtml(signal.significance)}">
    <a href="#${escapeHtml(slug(signal.groupId))}">
      <span class="dvqr-top-signal-title">${escapeHtml(signal.title)}</span>
      <span class="dvqr-top-signal-impact">${escapeHtml(signal.impact)}</span>
      <span class="dvqr-top-signal-meta">${escapeHtml(signal.groupTitle)} · ${escapeHtml(signal.significance)} · ${escapeHtml(signal.kind)}</span>
    </a>
  </li>`);

  const totalSignals = model.summary.differenceCount;
  const highSignals = model.groups.reduce((count, group) => count + group.differences.filter((difference) => difference.significance === "High").length, 0);
  const curationNote = highSignals > signals.length
    ? `<p class="dvqr-top-signal-note">Showing ${signals.length} of ${highSignals} high-significance drift signals. Additional signals remain available in provider sections.</p>`
    : totalSignals > signals.length
      ? `<p class="dvqr-top-signal-note">Showing the strongest ${signals.length} of ${totalSignals} drift signals. Provider sections keep the full evidence available.</p>`
      : "";

  return `<section class="dvqr-card dvqr-top-signals dvqr-workspace-mode-section" aria-label="Top operational drift signals" data-workspace-section="investigation findings" data-workspace-section="investigation findings verification handoff">
    <div class="dvqr-section-heading-row">
      <div>
        <h2>Top Operational Drift Signals</h2>
        <p class="dvqr-muted">Fast orientation across the strongest evidence-backed drift signals. These are investigation cues, not remediation instructions.</p>
        ${curationNote}
      </div>
    </div>
    <ol>${items.join("")}</ol>
  </section>`;
}

export function renderGroupNavigation(
  model: ComparisonViewModel,
  helpers: Pick<ComparisonSurfaceFindingsHelpers, "shortGroupTitle">
): string {
  if (model.groups.length <= 1) {
    return "";
  }

  const links = model.groups.map((group) => {
    const highCount = group.differences.filter((difference) => difference.significance === "High").length;
    const mediumCount = group.differences.filter((difference) => difference.significance === "Medium").length;
    const significanceLabel = highCount > 0
      ? `${highCount} high`
      : mediumCount > 0
        ? `${mediumCount} medium`
        : `${group.differences.length} low`;
    return `<a class="dvqr-group-nav-link" href="#${escapeHtml(slug(group.id))}">
      <span>${escapeHtml(helpers.shortGroupTitle(group.title))} <em>(${escapeHtml(significanceLabel)})</em></span>
      <strong>${group.differences.length}</strong>
    </a>`;
  });

  return `<nav class="dvqr-group-nav" aria-label="Provider group navigation">
    <span class="dvqr-group-nav-label">Jump to</span>
    ${links.join("")}
  </nav>`;
}
