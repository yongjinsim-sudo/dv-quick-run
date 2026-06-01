import type { ComparisonDifference, ComparisonDriftGroup, ComparisonViewModel } from "../../core/comparison/index.js";
import { escapeHtml, significanceRank, slug } from "./comparisonSurfacePrimitives.js";
import { renderDifference, renderInvestigationContinuations as renderDifferenceInvestigationContinuations, simplifyDifferenceSummary, simplifyDifferenceTitle, simplifyGroupSummary } from "./comparisonSurfaceDifferences.js";
import { renderNearbyVerificationChecklistPivot } from "./comparisonSurfaceVerification.js";

export function shortGroupTitle(title: string): string {
  return title
    .replace("Operational Profile Drift", "Operational Profile")
    .replace("Plugin Step Runtime Behaviour Drift", "Plugin Runtime")
    .replace("Solution Participation Drift", "Solution Participation")
    .replace("Workflow / Automation Participation Drift", "Workflow / Automation")
    .replace("Identity Participation Drift", "Identity Participation");
}


function getGroupById(model: ComparisonViewModel, id: string): ComparisonDriftGroup | undefined {
  return model.groups.find((group) => group.id === id);
}

function getStrongestDifferenceTitle(group: ComparisonDriftGroup | undefined, sourceLabel: string, targetLabel: string): string | undefined {
  const strongest = group?.differences
    .slice()
    .sort((left, right) => {
      const priority = getSignalPriority(right) - getSignalPriority(left);
      if (priority !== 0) {
        return priority;
      }

      const significance = significanceRank(right.significance) - significanceRank(left.significance);
      if (significance !== 0) {
        return significance;
      }

      return left.title.localeCompare(right.title);
    })[0];

  return strongest
    ? getParticipationDensitySignalTitle(strongest, sourceLabel, targetLabel) ?? simplifyDifferenceTitle(strongest, sourceLabel, targetLabel)
    : undefined;
}

function buildConsiderationItem(label: string, detail: string): string {
  return `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></li>`;
}

export function renderObservedOperationalStoryline(model: ComparisonViewModel): string {
  if (!model.groups.length) {
    return "";
  }

  const sourceLabel = model.summary.sourceLabel;
  const targetLabel = model.summary.targetLabel;
  const runtime = getGroupById(model, "plugin-step-runtime-behaviour-drift");
  const workflow = getGroupById(model, "workflow-automation-participation-drift");
  const solution = getGroupById(model, "solution-participation-drift");
  const profile = getGroupById(model, "operational-profile-drift");
  const identity = getGroupById(model, "identity-participation-drift");

  const reviewedContexts = [
    runtime ? "runtime behaviour" : undefined,
    workflow ? "workflow / orchestration" : undefined,
    solution ? "solution / package participation" : undefined,
    profile ? "operational density" : undefined,
    identity ? "identity participation" : undefined
  ].filter((item): item is string => Boolean(item));

  const considerations = [
    runtime ? buildConsiderationItem(
      "Runtime behaviour",
      getStrongestDifferenceTitle(runtime, sourceLabel, targetLabel) ?? "Plugin step registration drift was observed."
    ) : undefined,
    workflow ? buildConsiderationItem(
      "Workflow / orchestration",
      getStrongestDifferenceTitle(workflow, sourceLabel, targetLabel) ?? "Workflow or automation participation drift was observed."
    ) : undefined,
    solution ? buildConsiderationItem(
      "Package / solution context",
      getStrongestDifferenceTitle(solution, sourceLabel, targetLabel) ?? "Solution participation or managed-state drift was observed."
    ) : undefined,
    profile ? buildConsiderationItem(
      "Operational density",
      getStrongestDifferenceTitle(profile, sourceLabel, targetLabel) ?? "Operational profile density changed between snapshots."
    ) : undefined,
    identity ? buildConsiderationItem(
      "Identity participation",
      getStrongestDifferenceTitle(identity, sourceLabel, targetLabel) ?? "Identity participation drift was observed with confidence-based matching."
    ) : undefined
  ].filter((item): item is string => Boolean(item));

  const reviewed = reviewedContexts.length
    ? reviewedContexts.join(", ")
    : "available provider evidence";

  return `<section class="dvqr-card dvqr-operational-storyline dvqr-workspace-mode-section" id="dvqr-operational-storyline" data-workspace-section="investigation" aria-label="Observed operational storyline">
    <div class="dvqr-section-heading-row">
      <div>
        <h2>Observed Operational Storyline</h2>
        <p class="dvqr-muted">Bounded synthesis of what this comparison collectively observed. This is investigation guidance, not RCA certainty or remediation instruction.</p>
      </div>
    </div>
    <div class="dvqr-storyline-panel">
      <strong>Operational comparison narrative</strong>
      <p>Observed operational differences were found between ${escapeHtml(sourceLabel)} and ${escapeHtml(targetLabel)} across ${escapeHtml(reviewed)}.</p>
      <p>These observations may warrant external verification before treating the environments as operationally equivalent. DVQR preserves evidence-backed context; humans retain operational authority and corrective-action ownership.</p>
    </div>
    <div class="dvqr-consideration-grid">
      <article class="dvqr-consideration-card">
        <h3>Potential operational considerations</h3>
        <p>Use these as verification-oriented prompts. They are not root-cause findings, blame statements, or corrective instructions.</p>
        <ul>${considerations.join("")}</ul>
        <div class="dvqr-storyline-actions">
          <a class="dvqr-inline-investigation-action" href="#plugin-step-runtime-behaviour-drift" data-continuation-target="runtime">Investigate runtime context</a>
          <a class="dvqr-inline-investigation-action" href="#workflow-automation-participation-drift" data-continuation-target="orchestration">Review orchestration drift</a>
          <a class="dvqr-inline-investigation-action" href="#operational-profile-drift" data-continuation-target="density">Inspect operational density</a>
        </div>
      </article>
      <article class="dvqr-consideration-card">
        <h3>Investigation handoff posture</h3>
        <p>The checklist below converts representative drift signals into handoff-ready validation prompts for people or teams outside DVQR.</p>
        <ul>
          <li><strong>External verification recommended</strong><span>Confirm expectations in Dataverse, Power Platform admin surfaces, ALM pipelines, or owner/team channels as appropriate.</span></li>
          <li><strong>Authority remains human</strong><span>DVQR narrows the operational problem space; it does not determine corrective action.</span></li>
        </ul>
      </article>
    </div>
  </section>`;
}




function renderNearbyOperationalDrift(group: ComparisonDriftGroup): string {
  const nearby = group.nearbyOperationalDrift ?? [];
  if (!nearby.length) {
    return "";
  }

  const items = nearby.map((item) => `<li data-significance="${escapeHtml(item.significance)}">
      <div class="dvqr-nearby-drift-cue">${escapeHtml(item.orientationCue)}</div>
      <a href="#${escapeHtml(slug(item.relatedGroupId))}">${escapeHtml(item.relatedGroupTitle)}</a>
      <span>${escapeHtml(item.summary)}</span>
      <div class="dvqr-nearby-drift-meta">
        <em>${escapeHtml(item.significance)} · ${item.differenceCount} drift signal${item.differenceCount === 1 ? "" : "s"}</em>
      </div>
      ${renderNearbyVerificationChecklistPivot(item)}
    </li>`);

  return `<details class="dvqr-nearby-drift">
    <summary>Other observed drift surfaces <span>${nearby.length}</span></summary>
    <p>Use these cues to decide which neighbouring evidence may deserve external verification. They indicate adjacency only, not chronology, causality, remediation, or root-cause certainty.</p>
    <ol>${items.join("")}</ol>
  </details>`;
}

function getProviderInsight(group: ComparisonDriftGroup): string {
  const highCount = group.differences.filter((difference) => difference.significance === "High").length;
  const mediumCount = group.differences.filter((difference) => difference.significance === "Medium").length;
  const lowCount = group.differences.filter((difference) => difference.significance === "Low").length;
  const parts = [
    highCount > 0 ? `${highCount} high` : undefined,
    mediumCount > 0 ? `${mediumCount} medium` : undefined,
    lowCount > 0 ? `${lowCount} low` : undefined
  ].filter((part): part is string => Boolean(part));

  if (group.id === "operational-profile-drift") {
    return `${group.differences.length} operational density change${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
  }

  if (group.id === "solution-participation-drift") {
    return `${group.differences.length} solution package drift${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
  }

  if (group.id === "workflow-automation-participation-drift") {
    return `${group.differences.length} orchestration participation drift${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
  }

  return `${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
}



function getIdentitySubjectFromDifference(difference: ComparisonDifference): string | undefined {
  const subjectEvidence = difference.evidence.find((item) => item.label === "Identity subject")?.value?.toLowerCase();
  if (subjectEvidence?.includes("applicationuser") || subjectEvidence?.includes("application user")) {
    return "Application users";
  }
  if (subjectEvidence?.includes("businessunit") || subjectEvidence?.includes("business unit")) {
    return "Business units";
  }
  if (subjectEvidence?.includes("team")) {
    return "Teams";
  }
  if (subjectEvidence?.includes("role")) {
    return "Roles";
  }
  if (subjectEvidence?.includes("user")) {
    return "Users";
  }

  const title = difference.title.toLowerCase();
  if (title.includes("application user")) {
    return "Application users";
  }
  if (title.includes("business unit")) {
    return "Business units";
  }
  if (title.includes("team participation")) {
    return "Teams";
  }
  if (title.includes("role participation")) {
    return "Roles";
  }
  if (title.includes("user participation")) {
    return "Users";
  }

  return undefined;
}

function renderCountBreakdown(counts: ReadonlyMap<string, number>): string {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
}

function getIdentityTypeBreakdown(group: ComparisonDriftGroup): string | undefined {
  if (group.id !== "identity-participation-drift") {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const difference of group.differences) {
    const subject = getIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }

  return counts.size > 0 ? renderCountBreakdown(counts) : undefined;
}

function getParticipationDensityHighlights(group: ComparisonDriftGroup): readonly string[] {
  if (group.id !== "identity-participation-drift") {
    return [];
  }

  return group.differences
    .flatMap((difference) => difference.evidence
      .filter((item) => item.label === "Participation density")
      .map((item) => `${simplifyDifferenceTitle(difference, "source", "target")} — ${item.value}`))
    .slice(0, 3);
}

function getSolutionClassification(difference: ComparisonDifference): string {
  const classification = difference.evidence.find((item) => item.label === "Solution classification")?.value;
  if (classification) {
    return classification.includes("→") ? "Mixed solution classification" : classification;
  }

  const value = `${difference.title} ${difference.sourceValue ?? ""} ${difference.targetValue ?? ""}`.toLowerCase();
  if (/\b(bkp|backup|archived?|archive)\b/u.test(value)) {
    return "Backup / archived solution";
  }
  if (/\b(patch|cumulative|hotfix)\b/u.test(value)) {
    return "Platform patch layer";
  }
  if (value.includes("msdyn") || value.includes("microsoftdynamics") || value.includes("powerpages") || value.includes("power pages") || value.includes("dynamics 365") || value.includes("system solution") || value.includes("default solution")) {
    return "Microsoft platform solution";
  }
  if (value.includes("syncagent") || value.includes("sync admin")) {
    return "Infrastructure solution";
  }

  return "Custom solution";
}

function getSolutionClassificationBreakdown(group: ComparisonDriftGroup): string | undefined {
  if (group.id !== "solution-participation-drift") {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const difference of group.differences) {
    const classification = getSolutionClassification(difference);
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
  }

  return counts.size > 0 ? renderCountBreakdown(counts) : undefined;
}

export function renderGroupErgonomicsSummary(group: ComparisonDriftGroup): string {
  const identityBreakdown = getIdentityTypeBreakdown(group);
  const densityHighlights = getParticipationDensityHighlights(group);
  const solutionBreakdown = getSolutionClassificationBreakdown(group);

  if (!identityBreakdown && densityHighlights.length === 0 && !solutionBreakdown) {
    return "";
  }

  const items = [
    identityBreakdown ? `<li><strong>Identity drift by type</strong> — ${escapeHtml(identityBreakdown)}</li>` : undefined,
    ...densityHighlights.map((item) => `<li><strong>Participation density</strong> — ${escapeHtml(item)}</li>`),
    solutionBreakdown ? `<li><strong>Solution classification</strong> — ${escapeHtml(solutionBreakdown)}</li>` : undefined
  ].filter((item): item is string => Boolean(item));

  return `<div class="dvqr-ergonomics-summary"><p>Density-first orientation keeps evidence visible while reducing scan noise.</p><ul>${items.join("")}</ul></div>`;
}

function getGroupDensityLevel(group: ComparisonDriftGroup): "normal" | "dense" | "very-dense" {
  if (group.differences.length >= 30) {
    return "very-dense";
  }

  if (group.differences.length >= 12) {
    return "dense";
  }

  return "normal";
}

export function renderGroupDensityNote(group: ComparisonDriftGroup): string {
  const level = getGroupDensityLevel(group);
  if (level === "normal") {
    return "";
  }

  const mediumCount = group.differences.filter((difference) => difference.significance === "Medium").length;
  const lowCount = group.differences.filter((difference) => difference.significance === "Low").length;
  const highCount = group.differences.filter((difference) => difference.significance === "High").length;
  const countParts = [
    highCount > 0 ? `${highCount} high` : undefined,
    mediumCount > 0 ? `${mediumCount} medium` : undefined,
    lowCount > 0 ? `${lowCount} low` : undefined
  ].filter((part): part is string => Boolean(part));
  const label = level === "very-dense" ? "Large drift surface" : "Dense drift surface";

  return `<div class="dvqr-density-note">
    <strong>${escapeHtml(label)}</strong>
    <span>${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}${countParts.length > 0 ? ` · ${escapeHtml(countParts.join(", "))}` : ""}. Summary-first rendering is intentional; expand individual evidence only where it helps the investigation.</span>
  </div>`;
}

function getGroupNarrative(group: ComparisonDriftGroup, sourceLabel: string, targetLabel: string): string {
  const strongest = [...group.differences].sort((left, right) => {
    const priority = getSignalPriority(right) - getSignalPriority(left);
    if (priority !== 0) {
      return priority;
    }
    const significance = significanceRank(right.significance) - significanceRank(left.significance);
    if (significance !== 0) {
      return significance;
    }
    return left.title.localeCompare(right.title);
  });
  const highlights = strongest
    .slice(0, 3)
    .map((difference) => getParticipationDensitySignalTitle(difference, sourceLabel, targetLabel) ?? simplifyDifferenceTitle(difference, sourceLabel, targetLabel));

  if (group.id === "operational-profile-drift") {
    return buildNarrativeBlock(
      `Operational profile density shifted between ${sourceLabel} and ${targetLabel}. Review the strongest contributor changes before treating the environments as operationally equivalent.`,
      highlights
    );
  }

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return buildNarrativeBlock(
      `Plugin runtime behaviour differs between ${sourceLabel} and ${targetLabel}. Review changed step state, pipeline placement, and environment-specific registrations before comparing runtime outcomes.`,
      highlights
    );
  }

  if (group.id === "solution-participation-drift") {
    return buildNarrativeBlock(
      `Solution layering differs between ${sourceLabel} and ${targetLabel}. Review package presence, version, and managed-state drift as operational context, not deployment validation.`,
      highlights
    );
  }

  if (group.id === "identity-participation-drift") {
    return buildNarrativeBlock(
      `Identity participation differs between ${sourceLabel} and ${targetLabel}. Matching is confidence-based and should be treated as participation orientation, not authority certainty.`,
      highlights
    );
  }

  if (group.id === "workflow-automation-participation-drift") {
    return buildNarrativeBlock(
      `Workflow and flow participation differs between ${sourceLabel} and ${targetLabel}. Review added, removed, or changed orchestration before comparing environment behaviour.`,
      highlights
    );
  }

  return buildNarrativeBlock(`${group.title} contains ${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}.`, highlights);
}

function buildNarrativeBlock(summary: string, highlights: readonly string[]): string {
  if (!highlights.length) {
    return `<div class="dvqr-group-narrative"><p>${escapeHtml(summary)}</p></div>`;
  }

  return `<div class="dvqr-group-narrative"><p>${escapeHtml(summary)}</p><ul>${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
}

function parseParticipationDensity(value: string | undefined): { readonly source: number; readonly target: number } | undefined {
  const match = value?.match(/(\d+)\s*→\s*(\d+)/u);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return { source: Number.parseInt(match[1], 10), target: Number.parseInt(match[2], 10) };
}

export function getParticipationDensitySignalTitle(difference: ComparisonDifference, sourceLabel: string, targetLabel: string): string | undefined {
  const density = difference.evidence.find((item) => item.label === "Participation density")?.value;
  const parsed = parseParticipationDensity(density);
  if (!parsed) {
    return undefined;
  }

  const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
  const direction = parsed.target > parsed.source ? "expanded" : parsed.target < parsed.source ? "reduced" : "changed";
  return `${title} participation footprint ${direction}: ${parsed.source} → ${parsed.target}`;
}

export function getSignalPriority(difference: ComparisonDifference): number {
  const hasDensity = difference.evidence.some((item) => item.label === "Participation density");
  if (hasDensity) {
    return 100;
  }

  const classification = difference.evidence.find((item) => item.label === "Solution classification")?.value;
  if (classification === "Custom solution" || classification === "Infrastructure solution") {
    return 80;
  }

  if (difference.kind === "Assignment Drift" || difference.kind === "Inheritance Drift") {
    return 70;
  }

  if (classification === "Backup / archived solution") {
    return 45;
  }

  if (classification === "Platform patch layer" || classification === "Microsoft platform solution") {
    return 20;
  }

  return 50;
}

export function getOperationalImpactSummary(difference: ComparisonDifference, sourceLabel: string, targetLabel: string): string {
  const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
  const normalizedTitle = title.toLowerCase();
  const normalizedKind = difference.kind.toLowerCase();

  if (normalizedTitle.includes("dvqr score")) {
    return "Operational density changed between snapshots.";
  }

  if (normalizedTitle.includes("plugin") && normalizedTitle.includes("state changed")) {
    return "Plugin execution availability differs between environments.";
  }

  if (normalizedTitle.includes("execution pipeline")) {
    return "Request-time plugin sequencing or stage placement differs.";
  }

  if (normalizedTitle.includes("added in") || normalizedKind.includes("added") || difference.kind === "OnlyInTarget") {
    return `Additional operational participation is visible in ${targetLabel}.`;
  }

  if (normalizedTitle.includes("removed in") || normalizedKind.includes("removed") || difference.kind === "OnlyInSource") {
    return `Operational participation is only visible in ${sourceLabel}.`;
  }

  if (normalizedTitle.includes("state changed")) {
    return "Activation or runtime participation state differs.";
  }

  if (normalizedTitle.includes("owner changed")) {
    return "Ownership metadata differs; treat this as context, not execution causality.";
  }

  if (normalizedTitle.includes("managed") || normalizedTitle.includes("version")) {
    return "Solution packaging evidence differs between snapshots.";
  }

  return "Review the underlying evidence before comparing runtime behaviour.";
}


function getVisibleDifferenceLimit(group: ComparisonDriftGroup): number {
  const level = getGroupDensityLevel(group);
  if (level === "very-dense") {
    return 12;
  }

  if (level === "dense") {
    return 16;
  }

  return group.differences.length;
}

function getOrderedGroupDifferences(group: ComparisonDriftGroup): readonly ComparisonDifference[] {
  return [...group.differences].sort((left, right) => {
    const priority = getSignalPriority(right) - getSignalPriority(left);
    if (priority !== 0) {
      return priority;
    }

    const significance = significanceRank(right.significance) - significanceRank(left.significance);
    if (significance !== 0) {
      return significance;
    }

    return left.title.localeCompare(right.title);
  });
}



function isMinorIdentityMatchingSignal(difference: ComparisonDifference): boolean {
  if (difference.kind !== "Changed") {
    return false;
  }

  if (difference.evidence.some((item) => item.label === "Participation density")) {
    return false;
  }

  const title = difference.title.toLowerCase();
  const confidenceBasedTitle = title.startsWith("likely corresponding identity:")
    || title.startsWith("possible corresponding identity:");
  if (!confidenceBasedTitle) {
    return false;
  }

  const subject = getIdentitySubjectFromDifference(difference);
  return subject === "Teams" || subject === "Roles" || subject === undefined;
}

function getMinorIdentityGroupedCardIntro(count: number): string {
  return `${count} lower-priority team/role matching signal${count === 1 ? "" : "s"} observed. These are grouped to reduce repetitive identity matching noise while preserving evidence continuity.`;
}

function getMinorIdentityGroupedDirectionSummary(differences: readonly ComparisonDifference[]): string {
  const likely = differences.filter((difference) => difference.title.toLowerCase().startsWith("likely corresponding identity:")).length;
  const possible = differences.filter((difference) => difference.title.toLowerCase().startsWith("possible corresponding identity:")).length;
  const parts = [
    likely > 0 ? `${likely} likely match${likely === 1 ? "" : "es"}` : undefined,
    possible > 0 ? `${possible} possible match${possible === 1 ? "" : "es"}` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "Confidence-based team/role matching signals";
}

export function renderGroupedIdentityEvidenceSummary(
  groupedDifferences: readonly ComparisonDifference[],
  totalDifferenceCount: number
): string {
  const counts = new Map<string, number>();
  for (const difference of groupedDifferences) {
    const subject = getIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }

  const rows: readonly [string, string][] = [
    ["Grouped classification", `${groupedDifferences.length} of ${totalDifferenceCount} identity drift signals`],
    ["Classification rationale", "Grouped because these are lower-priority confidence-based team/role matching signals without participation-density evidence."],
    ["Match posture", getMinorIdentityGroupedDirectionSummary(groupedDifferences)],
    ["Identity subjects", renderCountBreakdown(counts)],
    ["Operational priority", "Lower-priority topology matching context by default; review when team or role equivalence is part of the investigation."],
    ["Evidence continuity", "Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export."]
  ];

  return `<div class="dvqr-grouped-evidence-summary">${rows
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("")}</div>`;
}

export function renderGroupedIdentityDetails(
  differences: readonly ComparisonDifference[],
  sourceLabel: string,
  targetLabel: string,
  totalDifferenceCount: number
): string {
  if (differences.length === 0) {
    return "";
  }

  const preview = differences
    .slice(0, 8)
    .map((difference) => {
      const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
      const summary = simplifyDifferenceSummary(difference, sourceLabel, targetLabel);
      const evidenceValue = difference.evidence
        .map((evidence) => `${evidence.label}: ${evidence.value ?? ""}`)
        .join(" · ");
      const evidenceId = slug(`${difference.id}-${difference.kind}-grouped-identity-evidence-${title}`);
      return `<li class="dvqr-evidence-item" data-evidence-label="Grouped identity signal" data-evidence-value="${escapeHtml(title)}" data-evidence-kind="identity" data-parent-title="${escapeHtml(title)}" data-parent-summary="${escapeHtml(summary)}" data-parent-kind="${escapeHtml(difference.kind)}" data-parent-provider="identity-participation-drift" data-parent-evidence="${escapeHtml(evidenceValue)}">
        <span class="dvqr-classified-drift-main"><strong>${escapeHtml(title)}</strong><span class="dvqr-classified-drift-meta">${escapeHtml(difference.significance)} · ${escapeHtml(difference.kind)}</span></span>
        <button type="button" class="dvqr-evidence-continuation-pill" data-evidence-inspect="${escapeHtml(evidenceId)}" data-evidence-label-collapsed="Investigate evidence ›" aria-expanded="false" title="Open representative grouped identity evidence context.">
          Investigate evidence ›
        </button>
        <div class="dvqr-inline-evidence-context" data-evidence-context="${escapeHtml(evidenceId)}" hidden>
          <strong>Inline evidence context</strong>
          <span>This grouped identity signal preserves representative evidence from a dense identity section. Use it to verify the drift signal before continuing investigation outside DVQR.</span>
          <dl>
            <dt>Evidence label</dt>
            <dd>Grouped identity signal</dd>
            <dt>Observed value</dt>
            <dd>${escapeHtml(title)}</dd>
            <dt>Operational boundary</dt>
            <dd>Grouped evidence opens captured comparison context. In the VS Code webview, DVQR can continue into bounded live identity/team/role pivots without losing comparison context.</dd>
            <dt>Live evidence pivot</dt>
            <dd data-evidence-live-result="${escapeHtml(evidenceId)}">Not queried yet.</dd>
          </dl>
        </div>
      </li>`;
    })
    .join("");
  const overflow = differences.length > 8
    ? `<li class="dvqr-classified-drift-overflow"><em>${differences.length - 8} additional signal${differences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.</em></li>`
    : "";

  return `<details class="dvqr-deferred-differences dvqr-classified-drift-card">
        <summary>Minor identity matching signals (${differences.length})</summary>
        <p>${escapeHtml(getMinorIdentityGroupedCardIntro(differences.length))}</p>
        ${renderGroupedIdentityEvidenceSummary(differences, totalDifferenceCount)}
        <ul class="dvqr-classified-drift-list">${preview}${overflow}</ul>
      </details>`;
}

function getProviderMinorGroupingLabel(group: ComparisonDriftGroup): string {
  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return "Minor plugin configuration signals";
  }

  if (group.id === "workflow-automation-participation-drift") {
    return "Minor workflow metadata signals";
  }

  if (group.id === "operational-profile-drift") {
    return "Minor operational profile detail signals";
  }

  return "Additional provider detail signals";
}

function getProviderMinorGroupingIntro(group: ComparisonDriftGroup, count: number): string {
  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return `${count} lower-priority plugin configuration signal${count === 1 ? "" : "s"} observed. These are grouped to keep runtime-behaviour drift focused on execution-impacting changes while preserving evidence continuity.`;
  }

  if (group.id === "workflow-automation-participation-drift") {
    return `${count} lower-priority workflow metadata signal${count === 1 ? "" : "s"} observed. These are grouped so activation, presence, and orchestration participation remain easier to scan.`;
  }

  if (group.id === "operational-profile-drift") {
    return `${count} lower-priority operational profile detail signal${count === 1 ? "" : "s"} observed. These are grouped so headline density shifts remain prominent.`;
  }

  return `${count} lower-priority provider signal${count === 1 ? "" : "s"} observed. These are grouped to preserve readability while keeping evidence inspectable.`;
}

function getProviderMinorGroupingRationale(group: ComparisonDriftGroup): string {
  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return "Grouped because these are plugin configuration or metadata changes rather than added/removed steps or state changes.";
  }

  if (group.id === "workflow-automation-participation-drift") {
    return "Grouped because these are lower-priority workflow metadata changes rather than activation or presence drift.";
  }

  if (group.id === "operational-profile-drift") {
    return "Grouped because these are profile dimension detail changes rather than the primary operational-density score shift.";
  }

  return "Grouped because these are lower-priority provider details in a dense comparison surface.";
}

function getProviderMinorDirectionSummary(differences: readonly ComparisonDifference[]): string {
  const counts = new Map<string, number>();
  for (const difference of differences) {
    counts.set(difference.kind, (counts.get(difference.kind) ?? 0) + 1);
  }

  return counts.size > 0 ? renderCountBreakdown(counts) : "Grouped provider detail signals";
}

function isMinorProviderDetailSignal(group: ComparisonDriftGroup, difference: ComparisonDifference): boolean {
  if (group.id === "solution-participation-drift" || group.id === "identity-participation-drift") {
    return false;
  }

  if (group.differences.length <= 5 || difference.significance === "High" || getSignalPriority(difference) >= 70) {
    return false;
  }

  const text = `${difference.title} ${difference.summary} ${difference.evidence.map((item) => item.label).join(" ")}`.toLowerCase();

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return text.includes("configuration")
      || text.includes("filtering")
      || text.includes("secure")
      || text.includes("unsecure")
      || text.includes("managed");
  }

  if (group.id === "workflow-automation-participation-drift") {
    return text.includes("owner")
      || text.includes("managed")
      || text.includes("category")
      || text.includes("type");
  }

  if (group.id === "operational-profile-drift") {
    return difference.kind === "Changed" || difference.significance === "Low";
  }

  return difference.significance === "Low";
}

export function renderGroupedProviderEvidenceSummary(
  group: ComparisonDriftGroup,
  groupedDifferences: readonly ComparisonDifference[],
  totalDifferenceCount: number
): string {
  const rows: readonly [string, string][] = [
    ["Grouped classification", `${groupedDifferences.length} of ${totalDifferenceCount} ${shortGroupTitle(group.title).toLowerCase()} drift signals`],
    ["Classification rationale", getProviderMinorGroupingRationale(group)],
    ["Direction summary", getProviderMinorDirectionSummary(groupedDifferences)],
    ["Operational priority", "Lower-priority provider detail by default; review when these details are part of the investigation path."],
    ["Evidence continuity", "Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export."]
  ];

  return `<div class="dvqr-grouped-evidence-summary">${rows
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("")}</div>`;
}

export function renderGroupedProviderDetails(
  group: ComparisonDriftGroup,
  differences: readonly ComparisonDifference[],
  sourceLabel: string,
  targetLabel: string
): string {
  if (differences.length === 0) {
    return "";
  }

  const preview = differences
    .slice(0, 8)
    .map((difference) => {
      const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
      const evidenceValue = difference.evidence.length > 0
        ? difference.evidence.map((item) => `${item.label}: ${item.value ?? ""}`).join(" · ")
        : difference.summary;
      const evidenceId = slug(`grouped-${group.id}-${difference.id}-${title}`);
      const evidenceKind = group.id === "workflow-automation-participation-drift"
        ? "workflow"
        : group.id === "plugin-step-runtime-behaviour-drift"
          ? "plugin"
          : "evidence";

      return `<li class="dvqr-evidence-item dvqr-classified-drift-evidence-item" data-evidence-label="${escapeHtml(title)}" data-evidence-value="${escapeHtml(evidenceValue)}" data-evidence-kind="${escapeHtml(evidenceKind)}" data-parent-title="${escapeHtml(title)}" data-parent-summary="${escapeHtml(difference.summary)}" data-parent-kind="${escapeHtml(difference.kind)}" data-parent-provider="${escapeHtml(group.id)}" data-parent-evidence="${escapeHtml(evidenceValue)}">
        <span class="dvqr-classified-drift-main"><strong>${escapeHtml(title)}</strong><span class="dvqr-classified-drift-meta">${escapeHtml(difference.significance)} · ${escapeHtml(difference.kind)}</span></span>
        <button type="button" class="dvqr-evidence-continuation-pill" data-evidence-inspect="${escapeHtml(evidenceId)}" data-evidence-label-collapsed="Investigate evidence ›" aria-expanded="false" title="Investigate representative grouped provider evidence inline.">Investigate evidence ›</button>
        <div class="dvqr-inline-evidence-context" data-evidence-context="${escapeHtml(evidenceId)}" hidden>
          <strong>Inline evidence context</strong>
          <span>This grouped signal preserves representative evidence from a dense provider section. Use it to verify the signal before continuing investigation outside DVQR.</span>
          <dl>
            <dt>Evidence label</dt>
            <dd>${escapeHtml(title)}</dd>
            <dt>Observed value</dt>
            <dd>${escapeHtml(evidenceValue || "No value captured")}</dd>
            <dt>Operational boundary</dt>
            <dd>Grouped evidence opens captured comparison context. In the VS Code webview, DVQR can request a bounded live evidence pivot for supported evidence types.</dd>
            <dt>Live evidence pivot</dt>
            <dd data-evidence-live-result="${escapeHtml(evidenceId)}">Not queried yet.</dd>
          </dl>
        </div>
      </li>`;
    })
    .join("");
  const overflow = differences.length > 8
    ? `<li class="dvqr-classified-drift-overflow"><em>${differences.length - 8} additional signal${differences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.</em></li>`
    : "";

  return `<details class="dvqr-deferred-differences dvqr-classified-drift-card">
        <summary>${escapeHtml(getProviderMinorGroupingLabel(group))} (${differences.length})</summary>
        <p>${escapeHtml(getProviderMinorGroupingIntro(group, differences.length))}</p>
        ${renderGroupedProviderEvidenceSummary(group, differences, group.differences.length)}
        <ul class="dvqr-classified-drift-list">${preview}${overflow}</ul>
      </details>`;
}

function isGroupedSolutionClassification(classification: string): boolean {
  return classification === "Microsoft platform solution"
    || classification === "Platform patch layer"
    || classification === "Backup / archived solution";
}

function shouldRenderSolutionAsGroupedCard(difference: ComparisonDifference): boolean {
  return isGroupedSolutionClassification(getSolutionClassification(difference));
}

function getSolutionGroupedCardIntro(classification: string, count: number): string {
  if (classification === "Microsoft platform solution") {
    return `${count} Microsoft/platform solution drift signal${count === 1 ? "" : "s"} observed. These are grouped as low-priority platform-layering context; expand only if platform package alignment is relevant.`;
  }

  if (classification === "Platform patch layer") {
    return `${count} patch or cumulative-layer drift signal${count === 1 ? "" : "s"} observed. These are grouped as servicing-layer context rather than primary customisation drift.`;
  }

  if (classification === "Backup / archived solution") {
    return `${count} backup/archive-like solution drift signal${count === 1 ? "" : "s"} observed. This remains visible as evidence but is treated as lower-priority investigation context.`;
  }

  return `${count} grouped drift signal${count === 1 ? "" : "s"} observed.`;
}

function getSolutionGroupedEvidenceRationale(classification: string): string {
  if (classification === "Microsoft platform solution") {
    return "Grouped because the observed solutions match Microsoft/platform package naming or baseline platform-layer evidence.";
  }

  if (classification === "Platform patch layer") {
    return "Grouped because the observed solutions look like patch, cumulative, servicing, or hotfix layers.";
  }

  if (classification === "Backup / archived solution") {
    return "Grouped because the observed solution name suggests backup, archive, or preserved-copy context.";
  }

  return "Grouped to preserve readability while keeping the underlying drift signals inspectable.";
}

function getSolutionGroupedSignificancePosture(classification: string): string {
  if (classification === "Microsoft platform solution" || classification === "Platform patch layer") {
    return "Low operational priority by default; review when platform package alignment is part of the investigation.";
  }

  if (classification === "Backup / archived solution") {
    return "Lower-priority investigation context by default; review when archived or backup layers may explain local customisation history.";
  }

  return "Grouped evidence remains advisory; review representative signals before expanding the full evidence set.";
}

function getSolutionGroupedDirectionSummary(differences: readonly ComparisonDifference[]): string {
  const sourceOnly = differences.filter((difference) => difference.kind === "OnlyInSource").length;
  const targetOnly = differences.filter((difference) => difference.kind === "OnlyInTarget").length;
  const changed = differences.filter((difference) => difference.kind !== "OnlyInSource" && difference.kind !== "OnlyInTarget").length;
  const parts = [
    sourceOnly > 0 ? `${sourceOnly} source-only` : undefined,
    targetOnly > 0 ? `${targetOnly} target-only` : undefined,
    changed > 0 ? `${changed} changed` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "No direction summary available";
}

export function renderGroupedSolutionEvidenceSummary(
  classification: string,
  groupedDifferences: readonly ComparisonDifference[],
  totalDifferenceCount: number
): string {
  const rows: readonly [string, string][] = [
    ["Grouped classification", `${groupedDifferences.length} of ${totalDifferenceCount} solution drift signals`],
    ["Classification rationale", getSolutionGroupedEvidenceRationale(classification)],
    ["Direction summary", getSolutionGroupedDirectionSummary(groupedDifferences)],
    ["Operational priority", getSolutionGroupedSignificancePosture(classification)],
    ["Evidence continuity", "Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export."]
  ];

  return `<div class="dvqr-grouped-evidence-summary">${rows
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("")}</div>`;
}

function groupSolutionDifferencesByClassification(differences: readonly ComparisonDifference[]): readonly [string, readonly ComparisonDifference[]][] {
  const grouped = new Map<string, ComparisonDifference[]>();
  for (const difference of differences) {
    const classification = getSolutionClassification(difference);
    const current = grouped.get(classification) ?? [];
    current.push(difference);
    grouped.set(classification, current);
  }

  return [...grouped.entries()].sort((left, right) => {
    const priority = getSolutionClassificationGroupPriority(left[0]) - getSolutionClassificationGroupPriority(right[0]);
    if (priority !== 0) {
      return priority;
    }

    return right[1].length - left[1].length || left[0].localeCompare(right[0]);
  });
}

function getSolutionClassificationGroupPriority(classification: string): number {
  if (classification === "Microsoft platform solution") {
    return 0;
  }

  if (classification === "Platform patch layer") {
    return 1;
  }

  if (classification === "Backup / archived solution") {
    return 2;
  }

  return 3;
}

function renderDifferenceList(
  group: ComparisonDriftGroup,
  sourceLabel: string,
  targetLabel: string
): string {
  const orderedDifferences = getOrderedGroupDifferences(group);
  const groupedSolutionCards = group.id === "solution-participation-drift"
    ? orderedDifferences.filter(shouldRenderSolutionAsGroupedCard)
    : [];
  const groupedIdentityCards = group.id === "identity-participation-drift"
    ? orderedDifferences.filter(isMinorIdentityMatchingSignal)
    : [];
  const groupedProviderCards = orderedDifferences.filter((difference) => isMinorProviderDetailSignal(group, difference));
  const primaryDifferences = group.id === "solution-participation-drift"
    ? orderedDifferences.filter((difference) => !shouldRenderSolutionAsGroupedCard(difference))
    : group.id === "identity-participation-drift"
      ? orderedDifferences.filter((difference) => !isMinorIdentityMatchingSignal(difference))
      : orderedDifferences.filter((difference) => !isMinorProviderDetailSignal(group, difference));
  const visibleLimit = getVisibleDifferenceLimit({ ...group, differences: primaryDifferences });
  const visible = primaryDifferences.slice(0, visibleLimit);
  const deferred = primaryDifferences.slice(visibleLimit);
  const renderedVisible = visible
    .map((difference, index) => renderDifference(difference, sourceLabel, targetLabel, group.differences, index))
    .join("");

  const groupedSolutionDetails = renderGroupedSolutionDetails(groupedSolutionCards, sourceLabel, targetLabel, group.differences.length);
  const groupedIdentityDetails = renderGroupedIdentityDetails(groupedIdentityCards, sourceLabel, targetLabel, group.differences.length);
  const groupedProviderDetails = renderGroupedProviderDetails(group, groupedProviderCards, sourceLabel, targetLabel);
  const groupedDetails = `${groupedSolutionDetails}${groupedIdentityDetails}${groupedProviderDetails}`;

  if (deferred.length === 0) {
    return `<div class="dvqr-difference-list">${renderedVisible}</div>${groupedDetails}`;
  }

  const renderedDeferred = deferred
    .map((difference, index) => renderDifference(difference, sourceLabel, targetLabel, group.differences, visibleLimit + index))
    .join("");
  const deferredSummary = renderDeferredSummary(group, deferred);

  return `<div class="dvqr-difference-list">${renderedVisible}</div>
    ${groupedDetails}
    <details class="dvqr-deferred-differences">
      <summary>Show ${deferred.length} additional drift signal${deferred.length === 1 ? "" : "s"}</summary>
      <p>Lower-ranked signals are grouped to keep dense comparisons readable. They remain available as evidence-backed investigation context.</p>
      ${deferredSummary}
      <div class="dvqr-difference-list">${renderedDeferred}</div>
    </details>`;
}

export function renderGroupedSolutionDetails(
  differences: readonly ComparisonDifference[],
  sourceLabel: string,
  targetLabel: string,
  totalDifferenceCount: number
): string {
  if (differences.length === 0) {
    return "";
  }

  return groupSolutionDifferencesByClassification(differences)
    .map(([classification, groupedDifferences]) => {
      const preview = groupedDifferences
        .slice(0, 8)
        .map((difference) => {
          const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
          const summary = simplifyDifferenceSummary(difference, sourceLabel, targetLabel);
          const evidenceValue = difference.evidence.length > 0
            ? difference.evidence.map((item) => `${item.label}: ${item.value ?? ""}`).join(" · ")
            : `${summary} · ${difference.sourceValue ?? ""} · ${difference.targetValue ?? ""}`;
          const evidenceId = slug(`grouped-solution-${classification}-${difference.id}-${title}`);
          const evidenceKind = "solution";

          return `<li class="dvqr-evidence-item dvqr-classified-drift-evidence-item" data-evidence-label="${escapeHtml(title)}" data-evidence-value="${escapeHtml(evidenceValue)}" data-evidence-kind="${escapeHtml(evidenceKind)}" data-parent-title="${escapeHtml(title)}" data-parent-summary="${escapeHtml(summary)}" data-parent-kind="${escapeHtml(difference.kind)}" data-parent-provider="solution-participation-drift" data-parent-evidence="${escapeHtml(evidenceValue)}">
            <span class="dvqr-classified-drift-main"><strong>${escapeHtml(title)}</strong><span class="dvqr-classified-drift-meta">${escapeHtml(difference.significance)} · ${escapeHtml(difference.kind)}</span></span>
            <button type="button" class="dvqr-evidence-continuation-pill" data-evidence-inspect="${escapeHtml(evidenceId)}" data-evidence-label-collapsed="Investigate evidence ›" aria-expanded="false" title="Investigate representative grouped solution evidence inline.">Investigate evidence ›</button>
            <div class="dvqr-inline-evidence-context" data-evidence-context="${escapeHtml(evidenceId)}" hidden>
              <strong>Inline evidence context</strong>
              <span>This grouped solution signal preserves representative evidence from a dense solution section. Use it to verify the signal before continuing investigation outside DVQR.</span>
              <dl>
                <dt>Evidence label</dt>
                <dd>${escapeHtml(title)}</dd>
                <dt>Observed value</dt>
                <dd>${escapeHtml(evidenceValue || "No value captured")}</dd>
                <dt>Operational boundary</dt>
                <dd>Grouped solution evidence opens captured comparison context. In the VS Code webview, DVQR can request a bounded live solution evidence pivot.</dd>
                <dt>Live evidence pivot</dt>
                <dd data-evidence-live-result="${escapeHtml(evidenceId)}">Not queried yet.</dd>
              </dl>
            </div>
          </li>`;
        })
        .join("");
      const overflow = groupedDifferences.length > 8
        ? `<li class="dvqr-classified-drift-overflow"><em>${groupedDifferences.length - 8} additional signal${groupedDifferences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.</em></li>`
        : "";

      return `<details class="dvqr-deferred-differences dvqr-classified-drift-card">
        <summary>${escapeHtml(classification)} (${groupedDifferences.length})</summary>
        <p>${escapeHtml(getSolutionGroupedCardIntro(classification, groupedDifferences.length))}</p>
        ${renderGroupedSolutionEvidenceSummary(classification, groupedDifferences, totalDifferenceCount)}
        <ul class="dvqr-classified-drift-list">${preview}${overflow}</ul>
      </details>`;
    })
    .join("");
}

function renderDeferredSummary(group: ComparisonDriftGroup, deferred: readonly ComparisonDifference[]): string {
  if (!deferred.length) {
    return "";
  }

  if (group.id === "solution-participation-drift") {
    const counts = new Map<string, number>();
    for (const difference of deferred) {
      const classification = getSolutionClassification(difference);
      counts.set(classification, (counts.get(classification) ?? 0) + 1);
    }

    return `<div class="dvqr-deferred-summary"><strong>Grouped solution drift</strong><span>${escapeHtml(renderCountBreakdown(counts))}</span></div>`;
  }

  if (group.id === "identity-participation-drift") {
    const counts = new Map<string, number>();
    for (const difference of deferred) {
      const subject = getIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }

    return `<div class="dvqr-deferred-summary"><strong>Grouped identity drift</strong><span>${escapeHtml(renderCountBreakdown(counts))}</span></div>`;
  }

  return "";
}

export function renderGroup(
  group: ComparisonDriftGroup,
  sourceLabel: string,
  targetLabel: string
): string {
  return `<article class="dvqr-card dvqr-group-card" id="${escapeHtml(slug(group.id))}" data-group-id="${escapeHtml(group.id)}" data-significance="${escapeHtml(group.significance)}">
    <div class="dvqr-group-header">
      <div>
        <h2>${escapeHtml(group.title)}</h2>
        <p>${escapeHtml(simplifyGroupSummary(group))}</p>
      </div>
      <div class="dvqr-meta dvqr-group-meta">
        <span class="dvqr-chip">${escapeHtml(group.significance)} significance</span>
        <span class="dvqr-chip">${group.differences.length} difference${group.differences.length === 1 ? "" : "s"}</span>
        <span class="dvqr-chip dvqr-chip-muted">${escapeHtml(getProviderInsight(group))}</span>
      </div>
    </div>
    ${getGroupNarrative(group, sourceLabel, targetLabel)}
    ${renderGroupErgonomicsSummary(group)}
    ${renderGroupDensityNote(group)}
    ${renderDifferenceInvestigationContinuations(group.continuations, "Provider investigation continuations")}
    ${renderNearbyOperationalDrift(group)}
    ${renderDifferenceList(group, sourceLabel, targetLabel)}
    <a class="dvqr-back-top" href="#dvqr-comparison-top">Back to top ↑</a>
  </article>`;
}

