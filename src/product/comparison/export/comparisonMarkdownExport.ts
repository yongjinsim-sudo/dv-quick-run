import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../../core/comparison/index.js";

function formatSnapshotPickerTime(value: string | undefined): string {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function slugFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "comparison";
}

function normalizeExportScopeLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized
    .replace(/\s+·\s+/g, " ")
    .replace(/\s*→\s*/g, " to ");
}

function formatExportTimestamp(date = new Date()): string {
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildDefaultExportUri(model: ComparisonViewModel, extension: "json" | "md" | "html" | "baseline" | "summary-html" | "handoff-html" | "summary-pdf" | "handoff-pdf"): vscode.Uri | undefined {
  const prefix = model.title.startsWith("Timeline Diff") ? "dvqr-timeline-diff" : "dvqr-cross-environment-diff";
  const scope = normalizeExportScopeLabel(model.summary.subjectLabel);
  const scopePart = scope ? `${slugFilePart(scope)}-` : "";
  const extensionPart = extension === "summary-html" || extension === "handoff-html" ? "html" : extension === "summary-pdf" || extension === "handoff-pdf" ? "pdf" : extension;
  const reportPart = extension === "summary-html" || extension === "summary-pdf" ? "diff-findings-summary-" : extension === "handoff-html" || extension === "handoff-pdf" ? "investigation-handoff-" : "";
  const fileName = `${prefix}-${reportPart}${scopePart}${slugFilePart(model.summary.sourceLabel)}-to-${slugFilePart(model.summary.targetLabel)}-${formatExportTimestamp()}.${extensionPart}`;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return vscode.Uri.joinPath(folders[0].uri, fileName);
  }

  return vscode.Uri.file(fileName);
}


function extractScoreBandFromEvidence(value: string | undefined): string | undefined {
  const match = value?.match(/\(([^)]+)\)/);
  return match?.[1];
}


function describeBandMovement(sourceValue: string | undefined, targetValue: string | undefined): string {
  const rank = (value: string | undefined): number | undefined => {
    const normalized = (value ?? "").toLowerCase();
    if (normalized.includes("none") || normalized.includes("no evidence")) {
      return 0;
    }

    if (normalized.includes("low")) {
      return 1;
    }

    if (normalized.includes("moderate")) {
      return 2;
    }

    if (normalized.includes("high")) {
      return 3;
    }
    return undefined;
  };

  const source = rank(sourceValue);
  const target = rank(targetValue);
  if (source === undefined || target === undefined || source === target) {
    return "changed";
  }

  return target > source ? "increased" : "decreased";
}

function extractMarkdownOnlyInName(title: string): string {
  const withKnownPrefixRemoved = title.replace(
    /^(plugin step|workflow|flow|identity|team participation|user participation|business unit participation|solution participation|operational profile)\s*:\s*/i,
    ""
  );

  return withKnownPrefixRemoved
    .replace(/\s+present only in (source|target)$/i, "")
    .replace(/\s+changed from .+$/i, "")
    .trim();
}

function isMarkdownEnvironmentScopedPresenceTitle(title: string, targetLabel: string): boolean {
  const normalized = title.toLowerCase();
  const target = targetLabel.toLowerCase();
  return normalized.endsWith(` added in ${target}`) || normalized.endsWith(` removed in ${target}`);
}

function describeDirection(source: string | undefined, target: string | undefined): string {
  if (!source || !target) {
    return "changed";
  }

  const sourceLower = source.toLowerCase();
  const targetLower = target.toLowerCase();
  if (sourceLower.includes("no evidence") && !targetLower.includes("no evidence")) {
    return "appeared";
  }

  if (!sourceLower.includes("no evidence") && targetLower.includes("no evidence")) {
    return "was no longer observed";
  }

  return "changed";
}

function getMarkdownDensitySubjectTitle(subject: string, sourceValue: string | undefined, targetValue: string | undefined): string {
  const direction = describeDirection(sourceValue, targetValue);

  if (subject === "DVQR Score density") {
    return "DVQR Score changed";
  }

  if (subject === "Automation (Plugin Steps)") {
    if (direction === "appeared") {
      return "Plugin Steps participation appeared";
    }

    if (direction === "was no longer observed") {
      return "Plugin Steps participation removed";
    }

    return sourceValue && targetValue
      ? `Plugin Steps count ${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})`
      : "Plugin Steps count changed";
  }

  if (subject === "Real-time Workflows") {
    if (direction === "appeared") {
      return "Real-time workflow participation appeared";
    }

    if (direction === "was no longer observed") {
      return "Real-time workflow participation removed";
    }

    return sourceValue && targetValue
      ? `Real-time workflow participation ${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})`
      : "Real-time workflow participation changed";
  }

  if (subject === "Relationships") {
    return direction === "appeared" ? "Relationship evidence appeared" : direction === "was no longer observed" ? "Relationship evidence removed" : `Relationship count ${direction === "changed" && sourceValue && targetValue ? `${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})` : direction}`;
  }

  if (subject === "Columns") {
    return direction === "appeared" ? "Column evidence appeared" : direction === "was no longer observed" ? "Column evidence removed" : `Column count ${direction === "changed" && sourceValue && targetValue ? `${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})` : direction}`;
  }

  return `${subject} ${direction}`;
}

function simplifyMarkdownPluginDifferenceTitle(title: string, targetLabel: string): string | undefined {
  const modernState = title.match(/^(.+) plugin state changed \((.+)\)$/i);
  if (modernState?.[1] && modernState[2]) {
    return `${modernState[1].trim()} plugin state changed (${modernState[2].trim()})`;
  }

  const removed = title.match(/^(.+) removed from target$/i);
  if (removed?.[1]) {
    return `${removed[1].trim()} removed in ${targetLabel}`;
  }

  const added = title.match(/^(.+) added in target$/i);
  if (added?.[1]) {
    return `${added[1].trim()} added in ${targetLabel}`;
  }

  const patterns: readonly [RegExp, string][] = [
    [/^Plugin step state changed:\s*(.+)$/i, "$1 plugin state changed"],
    [/^Plugin step execution pipeline changed:\s*(.+)$/i, "$1 execution pipeline changed"],
    [/^Plugin step configuration changed:\s*(.+)$/i, "$1 configuration changed"],
    [/^Plugin step changed:\s*(.+)$/i, "$1 changed"],
    [/^Plugin step removed from target:\s*(.+)$/i, `$1 removed in ${targetLabel}`],
    [/^Plugin step added in target:\s*(.+)$/i, `$1 added in ${targetLabel}`]
  ];

  for (const [pattern, replacement] of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      return replacement.replace("$1", match[1].trim());
    }
  }

  return undefined;
}

function getMarkdownDifferenceTitle(
  difference: ComparisonViewModel["groups"][number]["differences"][number],
  sourceLabel: string,
  targetLabel: string
): string {
  const pluginTitle = simplifyMarkdownPluginDifferenceTitle(difference.title, targetLabel);
  if (pluginTitle) {
    return pluginTitle;
  }

  if (difference.title.startsWith("DVQR Score density changed")) {
    const source = difference.sourceValue ?? "source";
    const target = difference.targetValue ?? "target";
    return `DVQR Score changed: ${source} → ${target}`;
  }

  if (difference.kind === "DensityChanged") {
    const subject = difference.title.split(" changed:")[0] || "Operational density";
    return getMarkdownDensitySubjectTitle(subject, difference.sourceValue, difference.targetValue);
  }

  if (difference.kind === "OnlyInSource") {
    if (isMarkdownEnvironmentScopedPresenceTitle(difference.title, targetLabel)) {
      return difference.title;
    }

    return `${extractMarkdownOnlyInName(difference.title)} present only in ${sourceLabel}`;
  }

  if (difference.kind === "OnlyInTarget") {
    if (isMarkdownEnvironmentScopedPresenceTitle(difference.title, targetLabel)) {
      return difference.title;
    }

    return `${extractMarkdownOnlyInName(difference.title)} present only in ${targetLabel}`;
  }

  if (difference.kind === "Changed") {
    if (/ changed from .+ → .+$/i.test(difference.title)) {
      return difference.title;
    }

    const name = extractMarkdownOnlyInName(difference.title);
    const managedState = difference.evidence.find((item) => item.label.toLowerCase().includes("managed state"));
    if (managedState?.value) {
      return `${name} changed from ${managedState.value}`;
    }

    const version = difference.evidence.find((item) => item.label.toLowerCase().includes("version"));
    if (version?.value) {
      if (difference.title.toLowerCase().includes("version changed")) {
        return /\([^)]*→[^)]*\)\s*$/u.test(difference.title) ? difference.title : `${difference.title} (${version.value})`;
      }

      return `${name} version changed (${version.value})`;
    }

    return `${name} changed`;
  }

  return difference.title;
}

function getMarkdownDifferenceSummary(
  difference: ComparisonViewModel["groups"][number]["differences"][number],
  sourceLabel: string,
  targetLabel: string
): string {
  if (difference.title.startsWith("DVQR Score density changed")) {
    const sourceBand = extractScoreBandFromEvidence(difference.evidence.find((item) => item.label === "Source score")?.value);
    const targetBand = extractScoreBandFromEvidence(difference.evidence.find((item) => item.label === "Target score")?.value);
    if (sourceBand && targetBand) {
      return `DVQR Score increased from ${sourceBand} to ${targetBand} density.`;
    }

    return `${difference.title}.`;
  }

  if (difference.kind === "OnlyInSource") {
    return `Only observed in ${sourceLabel}.`;
  }

  if (difference.kind === "OnlyInTarget") {
    return `Only observed in ${targetLabel}.`;
  }

  if (difference.kind === "DensityChanged") {
    const subject = difference.title.split(" changed:")[0] || "Operational density";
    return `${subject} changed between ${sourceLabel} and ${targetLabel}.`;
  }

  if (difference.kind === "Changed") {
    if (difference.title.toLowerCase().includes("managed state")) {
      return `Managed state differs between ${sourceLabel} and ${targetLabel}.`;
    }

    if (difference.title.toLowerCase().includes("version")) {
      return `Version differs between ${sourceLabel} and ${targetLabel}.`;
    }

    return `Participation details differ between ${sourceLabel} and ${targetLabel}.`;
  }

  return difference.summary;
}

function getMarkdownGroupSummary(group: ComparisonViewModel["groups"][number]): string {
  if (group.id === "operational-profile-drift") {
    const match = group.summary.match(/for ([^.]+)\./);
    return match?.[1] ? `${match[1]} operational profile differs between snapshots.` : "Operational profile differs between snapshots.";
  }

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return "Plugin step registrations differ between snapshots.";
  }

  if (group.id === "solution-participation-drift") {
    return "Solution package participation differs between snapshots.";
  }

  if (group.id === "workflow-automation-participation-drift") {
    return "Workflow and automation participation differs between snapshots.";
  }

  return group.summary;
}


function getMarkdownIdentitySubjectFromDifference(difference: ComparisonViewModel["groups"][number]["differences"][number]): string | undefined {
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

function renderMarkdownCountBreakdown(counts: ReadonlyMap<string, number>): string {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
}

function getMarkdownIdentityTypeBreakdown(group: ComparisonViewModel["groups"][number]): string | undefined {
  if (group.id !== "identity-participation-drift") {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const difference of group.differences) {
    const subject = getMarkdownIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }

  return counts.size > 0 ? renderMarkdownCountBreakdown(counts) : undefined;
}

function getMarkdownParticipationDensityHighlights(group: ComparisonViewModel["groups"][number], sourceLabel: string, targetLabel: string): readonly string[] {
  if (group.id !== "identity-participation-drift") {
    return [];
  }

  return group.differences
    .flatMap((difference) => difference.evidence
      .filter((item) => item.label === "Participation density")
      .map((item) => `${getMarkdownDifferenceTitle(difference, sourceLabel, targetLabel)} — ${item.value}`))
    .slice(0, 3);
}

function parseMarkdownParticipationDensity(value: string | undefined): { readonly source: number; readonly target: number } | undefined {
  const match = value?.match(/(\d+)\s*→\s*(\d+)/u);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return { source: Number.parseInt(match[1], 10), target: Number.parseInt(match[2], 10) };
}

function getMarkdownParticipationDensitySignalTitle(
  difference: ComparisonViewModel["groups"][number]["differences"][number],
  sourceLabel: string,
  targetLabel: string
): string | undefined {
  const density = difference.evidence.find((item) => item.label === "Participation density")?.value;
  const parsed = parseMarkdownParticipationDensity(density);
  if (!parsed) {
    return undefined;
  }

  const title = getMarkdownDifferenceTitle(difference, sourceLabel, targetLabel);
  const direction = parsed.target > parsed.source ? "expanded" : parsed.target < parsed.source ? "reduced" : "changed";
  return `${title} participation footprint ${direction}: ${parsed.source} → ${parsed.target}`;
}

function getMarkdownSignalPriority(difference: ComparisonViewModel["groups"][number]["differences"][number]): number {
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

function getMarkdownSolutionClassification(difference: ComparisonViewModel["groups"][number]["differences"][number]): string {
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

function getMarkdownSolutionClassificationBreakdown(group: ComparisonViewModel["groups"][number]): string | undefined {
  if (group.id !== "solution-participation-drift") {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const difference of group.differences) {
    const classification = getMarkdownSolutionClassification(difference);
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
  }

  return counts.size > 0 ? renderMarkdownCountBreakdown(counts) : undefined;
}

function getMarkdownGroupHighlights(
  group: ComparisonViewModel["groups"][number],
  sourceLabel: string,
  targetLabel: string
): readonly string[] {
  const strongest = [...group.differences].sort((left, right) => {
    const priority = getMarkdownSignalPriority(right) - getMarkdownSignalPriority(left);
    if (priority !== 0) {
      return priority;
    }

    const significance = (right.significance === "High" ? 3 : right.significance === "Medium" ? 2 : 1)
      - (left.significance === "High" ? 3 : left.significance === "Medium" ? 2 : 1);
    if (significance !== 0) {
      return significance;
    }

    return left.title.localeCompare(right.title);
  });
  return strongest
    .slice(0, 3)
    .map((difference) => getMarkdownParticipationDensitySignalTitle(difference, sourceLabel, targetLabel) ?? getMarkdownDifferenceTitle(difference, sourceLabel, targetLabel));
}

function getMarkdownGroupNarrative(
  group: ComparisonViewModel["groups"][number],
  sourceLabel: string,
  targetLabel: string
): string {
  if (group.id === "operational-profile-drift") {
    return `Operational profile density shifted between ${sourceLabel} and ${targetLabel}. Review the strongest contributor changes before treating the environments as operationally equivalent.`;
  }

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return `Plugin runtime behaviour differs between ${sourceLabel} and ${targetLabel}. Review changed step state, pipeline placement, and environment-specific registrations before comparing runtime outcomes.`;
  }

  if (group.id === "solution-participation-drift") {
    return `Solution layering differs between ${sourceLabel} and ${targetLabel}. Review package presence, version, and managed-state drift as operational context, not deployment validation.`;
  }

  if (group.id === "identity-participation-drift") {
    return `Identity participation differs between ${sourceLabel} and ${targetLabel}. Matching is confidence-based and should be treated as participation orientation, not authority certainty.`;
  }

  if (group.id === "workflow-automation-participation-drift") {
    return `Workflow and flow participation differs between ${sourceLabel} and ${targetLabel}. Review added, removed, or changed orchestration before comparing environment behaviour.`;
  }

  return `${group.title} contains ${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}.`;
}

function getMarkdownOperationalImpactSummary(
  difference: ComparisonViewModel["groups"][number]["differences"][number],
  sourceLabel: string,
  targetLabel: string
): string {
  const title = getMarkdownDifferenceTitle(difference, sourceLabel, targetLabel);
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

function normalizeMarkdownSignalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gu, "guid")
    .replace(/\b(dev|sit|uat|test|tst|perf|preprod|pre-prod|prod|production|sandbox|sbx)\b/gu, "env")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function getTopMarkdownOperationalSignals(model: ComparisonViewModel): readonly string[] {
  const rankSignificance = (value: string): number => value === "High" ? 3 : value === "Medium" ? 2 : 1;
  const sorted = model.groups
    .flatMap((group) => group.differences.map((difference) => ({
      groupTitle: group.title,
      groupId: group.id,
      title: getMarkdownParticipationDensitySignalTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)
        ?? getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel),
      significance: difference.significance,
      kind: difference.kind,
      impact: getMarkdownOperationalImpactSummary(difference, model.summary.sourceLabel, model.summary.targetLabel),
      priority: getMarkdownSignalPriority(difference)
    })))
    .sort((left, right) => {
      const priority = right.priority - left.priority;
      if (priority !== 0) {
        return priority;
      }

      const rank = rankSignificance(right.significance) - rankSignificance(left.significance);
      if (rank !== 0) {
        return rank;
      }

      const groupRank = left.groupTitle.localeCompare(right.groupTitle);
      if (groupRank !== 0) {
        return groupRank;
      }

      return left.title.localeCompare(right.title);
    });

  const selected: typeof sorted = [];
  const seen = new Set<string>();
  const perGroup = new Map<string, number>();

  for (const signal of sorted) {
    const key = `${signal.groupId}:${normalizeMarkdownSignalKey(signal.title)}`;
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

  return selected.map((signal) => `${signal.title} — ${signal.groupTitle} · ${signal.significance} · ${signal.kind}. ${signal.impact}`);
}

function getMarkdownComparisonDensityLabel(model: ComparisonViewModel): string | undefined {
  if (model.summary.differenceCount >= 75 || model.groups.some((group) => group.differences.length >= 50)) {
    return `Very dense grouped operational surface — ${model.summary.differenceCount} drift signals across ${model.summary.providerCount} provider${model.summary.providerCount === 1 ? "" : "s"}. Review top signals and provider summaries before drilling into grouped evidence.`;
  }

  if (model.summary.differenceCount >= 40 || model.groups.some((group) => group.differences.length >= 30)) {
    return `Grouped operational surface — ${model.summary.differenceCount} drift signals observed. Summary-first review is recommended; lower-priority platform and matching details are grouped for readability.`;
  }

  if (model.summary.differenceCount >= 8) {
    return `Focused operational surface — multiple drift signals observed across the selected providers.`;
  }

  if (model.summary.differenceCount > 0) {
    return `Quiet comparison surface — few drift signals observed; avoid inferring parity beyond the selected providers and snapshots.`;
  }

  return undefined;
}




function isMinorMarkdownIdentityMatchingSignal(
  difference: ComparisonViewModel["groups"][number]["differences"][number]
): boolean {
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

  const subject = getMarkdownIdentitySubjectFromDifference(difference);
  return subject === "Teams" || subject === "Roles" || subject === undefined;
}

function getMarkdownMinorIdentityGroupedDirectionSummary(
  differences: readonly ComparisonViewModel["groups"][number]["differences"][number][]
): string {
  const likely = differences.filter((difference) => difference.title.toLowerCase().startsWith("likely corresponding identity:")).length;
  const possible = differences.filter((difference) => difference.title.toLowerCase().startsWith("possible corresponding identity:")).length;
  const parts = [
    likely > 0 ? `${likely} likely match${likely === 1 ? "" : "es"}` : undefined,
    possible > 0 ? `${possible} possible match${possible === 1 ? "" : "es"}` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "Confidence-based team/role matching signals";
}

function getMarkdownMinorIdentitySubjectBreakdown(
  differences: readonly ComparisonViewModel["groups"][number]["differences"][number][]
): string {
  const counts = new Map<string, number>();
  for (const difference of differences) {
    const subject = getMarkdownIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }

  return renderMarkdownCountBreakdown(counts);
}

function getMarkdownProviderMinorGroupingLabel(group: ComparisonViewModel["groups"][number]): string {
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

function getMarkdownProviderMinorGroupingIntro(group: ComparisonViewModel["groups"][number], count: number): string {
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

function getMarkdownProviderMinorGroupingRationale(group: ComparisonViewModel["groups"][number]): string {
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

function getMarkdownProviderMinorDirectionSummary(
  differences: readonly ComparisonViewModel["groups"][number]["differences"][number][]
): string {
  const counts = new Map<string, number>();
  for (const difference of differences) {
    counts.set(difference.kind, (counts.get(difference.kind) ?? 0) + 1);
  }

  return counts.size > 0 ? renderMarkdownCountBreakdown(counts) : "Grouped provider detail signals";
}

function isMinorMarkdownProviderDetailSignal(
  group: ComparisonViewModel["groups"][number],
  difference: ComparisonViewModel["groups"][number]["differences"][number]
): boolean {
  if (group.id === "solution-participation-drift" || group.id === "identity-participation-drift") {
    return false;
  }

  if (group.differences.length <= 5 || difference.significance === "High" || getMarkdownSignalPriority(difference) >= 70) {
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

function isGroupedMarkdownSolutionClassification(classification: string): boolean {
  return classification === "Microsoft platform solution"
    || classification === "Platform patch layer"
    || classification === "Backup / archived solution";
}

function shouldRenderMarkdownSolutionAsGroupedCard(difference: ComparisonViewModel["groups"][number]["differences"][number]): boolean {
  return isGroupedMarkdownSolutionClassification(getMarkdownSolutionClassification(difference));
}

function getMarkdownSolutionGroupedCardIntro(classification: string, count: number): string {
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

function getMarkdownSolutionGroupedEvidenceRationale(classification: string): string {
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

function getMarkdownSolutionGroupedSignificancePosture(classification: string): string {
  if (classification === "Microsoft platform solution" || classification === "Platform patch layer") {
    return "Low operational priority by default; review when platform package alignment is part of the investigation.";
  }

  if (classification === "Backup / archived solution") {
    return "Lower-priority investigation context by default; review when archived or backup layers may explain local customisation history.";
  }

  return "Grouped evidence remains advisory; review representative signals before expanding the full evidence set.";
}

function getMarkdownSolutionGroupedDirectionSummary(differences: readonly ComparisonViewModel["groups"][number]["differences"][number][]): string {
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

function groupDeferredMarkdownSignals(
  group: ComparisonViewModel["groups"][number],
  differences: readonly ComparisonViewModel["groups"][number]["differences"][number][]
): readonly [string, readonly ComparisonViewModel["groups"][number]["differences"][number][]][] {
  const grouped = new Map<string, ComparisonViewModel["groups"][number]["differences"][number][]>();

  for (const difference of differences) {
    const key = group.id === "solution-participation-drift"
      ? getMarkdownSolutionClassification(difference)
      : group.id === "identity-participation-drift"
        ? getMarkdownIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals"
        : "Additional drift signals";
    const current = grouped.get(key) ?? [];
    current.push(difference);
    grouped.set(key, current);
  }

  return [...grouped.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
}

function getOrderedMarkdownGroupDifferences(group: ComparisonViewModel["groups"][number]): readonly ComparisonViewModel["groups"][number]["differences"][number][] {
  return [...group.differences].sort((left, right) => {
    const priority = getMarkdownSignalPriority(right) - getMarkdownSignalPriority(left);
    if (priority !== 0) {
      return priority;
    }

    const leftSignificance = left.significance === "High" ? 3 : left.significance === "Medium" ? 2 : 1;
    const rightSignificance = right.significance === "High" ? 3 : right.significance === "Medium" ? 2 : 1;
    const significance = rightSignificance - leftSignificance;
    if (significance !== 0) {
      return significance;
    }

    return left.title.localeCompare(right.title);
  });
}

function getMarkdownVisibleDifferenceLimit(group: ComparisonViewModel["groups"][number]): number {
  if (group.differences.length >= 30) {
    return 12;
  }

  if (group.differences.length >= 12) {
    return 16;
  }

  return group.differences.length;
}


function getMarkdownVerificationCategoryLabel(item: NonNullable<ComparisonViewModel["groups"][number]["nearbyOperationalDrift"]>[number]): string {
  const cue = item.orientationCue.toLowerCase();
  const title = item.relatedGroupTitle.toLowerCase();

  if (cue.includes("runtime") || title.includes("plugin")) {
    return "Runtime behaviour verification";
  }

  if (cue.includes("orchestration") || title.includes("workflow") || title.includes("automation")) {
    return "Workflow / orchestration verification";
  }

  if (cue.includes("package") || title.includes("solution")) {
    return "Package / solution verification";
  }

  if (cue.includes("density") || title.includes("profile")) {
    return "Operational density verification";
  }

  if (cue.includes("identity") || title.includes("identity")) {
    return "Identity participation verification";
  }

  return "Operational verification";
}

interface MarkdownVerificationChecklistItem {
  readonly title: string;
  readonly kind: string;
  readonly significance: string;
  readonly sourceProvider: string;
}

function collectMarkdownVerificationChecklist(model: ComparisonViewModel): readonly (readonly [string, readonly MarkdownVerificationChecklistItem[]])[] {
  const categories = new Map<string, Map<string, MarkdownVerificationChecklistItem>>();

  for (const group of model.groups) {
    for (const nearby of group.nearbyOperationalDrift ?? []) {
      const signals = nearby.representativeSignals ?? [];
      if (signals.length === 0) {
        continue;
      }

      const category = getMarkdownVerificationCategoryLabel(nearby);
      const bucket = categories.get(category) ?? new Map<string, MarkdownVerificationChecklistItem>();
      for (const signal of signals) {
        const key = `${category}::${signal.title}::${signal.kind}`;
        if (!bucket.has(key)) {
          bucket.set(key, {
            title: signal.title,
            kind: signal.kind,
            significance: signal.significance,
            sourceProvider: nearby.relatedGroupTitle
          });
        }
      }

      categories.set(category, bucket);
    }
  }

  const categoryOrder = [
    "Runtime behaviour verification",
    "Workflow / orchestration verification",
    "Package / solution verification",
    "Operational density verification",
    "Identity participation verification",
    "Operational verification"
  ];

  return [...categories.entries()]
    .map(([category, items]): readonly [string, readonly MarkdownVerificationChecklistItem[]] => [category, [...items.values()].sort((left, right) => {
      const leftRank = left.significance === "High" ? 3 : left.significance === "Medium" ? 2 : 1;
      const rightRank = right.significance === "High" ? 3 : right.significance === "Medium" ? 2 : 1;
      return rightRank - leftRank || left.title.localeCompare(right.title);
    })])
    .filter((entry) => entry[1].length > 0)
    .sort((left, right) => categoryOrder.indexOf(left[0]) - categoryOrder.indexOf(right[0]));
}

function appendMarkdownVerificationChecklist(lines: string[], model: ComparisonViewModel): void {
  const checklist = collectMarkdownVerificationChecklist(model);
  if (checklist.length === 0) {
    return;
  }

  lines.push("## Operational Verification Checklist");
  lines.push("");
  lines.push("Consolidated handoff prompts from reviewed drift surfaces. Use this checklist to decide what needs human validation outside DVQR before treating environments as operationally equivalent.");
  lines.push("");
  lines.push("> DVQR observes drift and supports verification. Humans retain operational authority and decide any corrective action.");
  lines.push("");

  for (const [category, items] of checklist) {
    lines.push(`### ${category}`);
    lines.push("");
    lines.push("Use these evidence-backed prompts for external validation. They are not root-cause findings, blame statements, or corrective instructions.");
    lines.push("");
    for (const item of items) {
      lines.push(`- [ ] Verify: ${item.title} — ${item.significance} · ${item.kind} · from ${item.sourceProvider}`);
    }
    lines.push("");
  }
}

export function renderComparisonMarkdown(model: ComparisonViewModel): string {
  const lines: string[] = [];
  lines.push(`# ${model.title}`);
  lines.push("");
  lines.push("DVQR observes operational drift. DVQR does not fix operational drift.");
  lines.push("");
  lines.push(`- Source: ${model.summary.sourceLabel}`);
  lines.push(`- Target: ${model.summary.targetLabel}`);
  lines.push(`- High significance: ${model.summary.highCount}`);
  lines.push(`- Medium significance: ${model.summary.mediumCount}`);
  lines.push(`- Low significance: ${model.summary.lowCount}`);
  lines.push(`- Differences: ${model.summary.differenceCount}`);
  lines.push(`- Providers: ${model.summary.providerCount}`);
  const densityLabel = getMarkdownComparisonDensityLabel(model);
  if (densityLabel) {
    lines.push(`- Investigation posture: ${densityLabel}`);
  }
  if (model.session) {
    lines.push(`- Generated: ${formatSnapshotPickerTime(model.session.generatedAtIso)}`);
    lines.push(`- Source snapshot: ${model.session.sourceSnapshot.label} (${formatSnapshotPickerTime(model.session.sourceSnapshot.capturedAtIso)})`);
    lines.push(`- Target snapshot: ${model.session.targetSnapshot.label} (${formatSnapshotPickerTime(model.session.targetSnapshot.capturedAtIso)})`);
    if (model.session.unalignedSubjects) {
      lines.push("- Scope note: source and target snapshots represent different operational subjects.");
    }
  }
  lines.push("");
  lines.push("## Top Operational Drift Signals");
  lines.push("");
  const topSignals = getTopMarkdownOperationalSignals(model);
  if (topSignals.length === 0) {
    lines.push("No top operational drift signals were produced by the selected providers.");
  } else {
    if (model.summary.highCount > topSignals.length) {
      lines.push(`Showing ${topSignals.length} of ${model.summary.highCount} high-significance drift signals. Additional signals remain available in provider sections.`);
      lines.push("");
    } else if (model.summary.differenceCount > topSignals.length) {
      lines.push(`Showing the strongest ${topSignals.length} of ${model.summary.differenceCount} drift signals. Provider sections keep the full evidence available.`);
      lines.push("");
    }

    for (const signal of topSignals) {
      lines.push(`- ${signal}`);
    }
  }
  lines.push("");
  lines.push("## Operational Drift");
  lines.push("");

  if (model.groups.length === 0) {
    lines.push("No operational drift detected from the selected providers.");
    lines.push("");
    return lines.join("\n");
  }

  for (const group of model.groups) {
    lines.push(`### ${group.title}`);
    lines.push("");
    lines.push(getMarkdownGroupSummary(group));
    lines.push("");
    lines.push(`- Summary: ${getMarkdownGroupNarrative(group, model.summary.sourceLabel, model.summary.targetLabel)}`);
    const highlights = getMarkdownGroupHighlights(group, model.summary.sourceLabel, model.summary.targetLabel);
    if (highlights.length > 0) {
      lines.push("- Highlights:");
      for (const highlight of highlights) {
        lines.push(`  - ${highlight}`);
      }
    }
    lines.push(`- Significance: ${group.significance}`);
    lines.push(`- Differences: ${group.differences.length}`);
    if (group.differences.length >= 12) {
      lines.push(`- Density note: ${group.differences.length >= 30 ? "Large" : "Dense"} drift surface. Summary-first review is recommended; expand individual evidence only where it helps the investigation.`);
    }
    const identityBreakdown = getMarkdownIdentityTypeBreakdown(group);
    if (identityBreakdown) {
      lines.push(`- Identity drift by type: ${identityBreakdown}`);
    }
    const solutionBreakdown = getMarkdownSolutionClassificationBreakdown(group);
    if (solutionBreakdown) {
      lines.push(`- Solution classification: ${solutionBreakdown}`);
    }
    const densityHighlights = getMarkdownParticipationDensityHighlights(group, model.summary.sourceLabel, model.summary.targetLabel);
    for (const densityHighlight of densityHighlights) {
      lines.push(`- Participation density: ${densityHighlight}`);
    }
    if ((group.nearbyOperationalDrift ?? []).length > 0) {
      lines.push("- Other observed drift surfaces:");
      lines.push("  - Additional drift surfaces observed in this bounded comparison only; this does not imply chronology, causality, remediation, or root-cause certainty.");
      for (const nearby of group.nearbyOperationalDrift ?? []) {
        lines.push(`  - ${nearby.orientationCue}: ${nearby.relatedGroupTitle} — ${nearby.significance}; ${nearby.differenceCount} drift signal${nearby.differenceCount === 1 ? "" : "s"}. ${nearby.summary}`);
        if ((nearby.representativeSignals ?? []).length > 0) {
          lines.push("    - Verification handoff: representative prompts are consolidated in the Operational Verification Checklist.");
        }
      }
    }
    lines.push("");

    const orderedDifferences = getOrderedMarkdownGroupDifferences(group);
    const groupedSolutionCards = group.id === "solution-participation-drift"
      ? orderedDifferences.filter(shouldRenderMarkdownSolutionAsGroupedCard)
      : [];
    const groupedIdentityCards = group.id === "identity-participation-drift"
      ? orderedDifferences.filter(isMinorMarkdownIdentityMatchingSignal)
      : [];
    const groupedProviderCards = orderedDifferences.filter((difference) => isMinorMarkdownProviderDetailSignal(group, difference));
    const primaryDifferences = group.id === "solution-participation-drift"
      ? orderedDifferences.filter((difference) => !shouldRenderMarkdownSolutionAsGroupedCard(difference))
      : group.id === "identity-participation-drift"
        ? orderedDifferences.filter((difference) => !isMinorMarkdownIdentityMatchingSignal(difference))
        : orderedDifferences.filter((difference) => !isMinorMarkdownProviderDetailSignal(group, difference));
    const visibleLimit = getMarkdownVisibleDifferenceLimit({ ...group, differences: primaryDifferences });
    const visible = primaryDifferences.slice(0, visibleLimit);
    const deferred = primaryDifferences.slice(visibleLimit);
    const groupedCount = groupedSolutionCards.length + groupedIdentityCards.length + groupedProviderCards.length + deferred.length;
    if (groupedCount > 0) {
      lines.push(`Showing ${visible.length} primary drift signal${visible.length === 1 ? "" : "s"} in detail. ${groupedCount} additional signal${groupedCount === 1 ? "" : "s"} are grouped below for dense investigation continuity.`);
      lines.push("");
    }

    for (const difference of visible) {
      lines.push(`#### ${getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)}`);
      lines.push("");
      lines.push(getMarkdownDifferenceSummary(difference, model.summary.sourceLabel, model.summary.targetLabel));
      lines.push("");
      lines.push(`- Kind: ${difference.kind}`);
      lines.push(`- Significance: ${difference.significance}`);
      if (difference.sourceValue) {
        lines.push(`- Source: ${difference.sourceValue}`);
      }
      if (difference.targetValue) {
        lines.push(`- Target: ${difference.targetValue}`);
      }
      if (difference.evidence.length > 0) {
        lines.push("- Evidence:");
        for (const evidence of difference.evidence) {
          lines.push(`  - ${evidence.label}${evidence.value ? ` — ${evidence.value}` : ""}`);
        }
      }
      lines.push("");
    }

    if (groupedSolutionCards.length > 0) {
      const solutionGroups = groupDeferredMarkdownSignals(group, groupedSolutionCards);
      for (const [label, differences] of solutionGroups) {
        lines.push(`#### ${label} (${differences.length})`);
        lines.push("");
        lines.push(getMarkdownSolutionGroupedCardIntro(label, differences.length));
        lines.push("");
        lines.push("Evidence summary:");
        lines.push(`- Classification rationale — ${getMarkdownSolutionGroupedEvidenceRationale(label)}`);
        lines.push(`- Direction summary — ${getMarkdownSolutionGroupedDirectionSummary(differences)}`);
        lines.push(`- Operational priority — ${getMarkdownSolutionGroupedSignificancePosture(label)}`);
        lines.push("- Evidence continuity — Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export.");
        lines.push("");
        lines.push("Observed solution signals:");
        for (const difference of differences.slice(0, 8)) {
          lines.push(`- ${getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)} — ${difference.significance} · ${difference.kind}`);
        }
        if (differences.length > 8) {
          lines.push(`- ${differences.length - 8} additional signal${differences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.`);
        }
        lines.push("");
      }
    }

    if (groupedIdentityCards.length > 0) {
      lines.push(`#### Minor identity matching signals (${groupedIdentityCards.length})`);
      lines.push("");
      lines.push(`${groupedIdentityCards.length} lower-priority team/role matching signal${groupedIdentityCards.length === 1 ? "" : "s"} observed. These are grouped to reduce repetitive identity matching noise while preserving evidence continuity.`);
      lines.push("");
      lines.push("Evidence summary:");
      lines.push(`- Classification rationale — Grouped because these are lower-priority confidence-based team/role matching signals without participation-density evidence.`);
      lines.push(`- Match posture — ${getMarkdownMinorIdentityGroupedDirectionSummary(groupedIdentityCards)}`);
      lines.push(`- Identity subjects — ${getMarkdownMinorIdentitySubjectBreakdown(groupedIdentityCards)}`);
      lines.push("- Operational priority — Lower-priority topology matching context by default; review when team or role equivalence is part of the investigation.");
      lines.push("- Evidence continuity — Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export.");
      lines.push("");
      lines.push("Observed identity matching signals:");
      for (const difference of groupedIdentityCards.slice(0, 8)) {
        lines.push(`- ${getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)} — ${difference.significance} · ${difference.kind}`);
      }
      if (groupedIdentityCards.length > 8) {
        lines.push(`- ${groupedIdentityCards.length - 8} additional signal${groupedIdentityCards.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.`);
      }
      lines.push("");
    }

    if (groupedProviderCards.length > 0) {
      lines.push(`#### ${getMarkdownProviderMinorGroupingLabel(group)} (${groupedProviderCards.length})`);
      lines.push("");
      lines.push(getMarkdownProviderMinorGroupingIntro(group, groupedProviderCards.length));
      lines.push("");
      lines.push("Evidence summary:");
      lines.push(`- Classification rationale — ${getMarkdownProviderMinorGroupingRationale(group)}`);
      lines.push(`- Direction summary — ${getMarkdownProviderMinorDirectionSummary(groupedProviderCards)}`);
      lines.push("- Operational priority — Lower-priority provider detail by default; review when these details are part of the investigation path.");
      lines.push("- Evidence continuity — Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export.");
      lines.push("");
      lines.push("Observed provider detail signals:");
      for (const difference of groupedProviderCards.slice(0, 8)) {
        lines.push(`- ${getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)} — ${difference.significance} · ${difference.kind}`);
      }
      if (groupedProviderCards.length > 8) {
        lines.push(`- ${groupedProviderCards.length - 8} additional signal${groupedProviderCards.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.`);
      }
      lines.push("");
    }

    if (deferred.length > 0) {
      lines.push("#### Additional drift signals grouped for readability");
      lines.push("");
      lines.push("These lower-ranked signals are grouped to keep the Markdown report readable. Use JSON/HTML export when full per-signal expansion is needed.");
      lines.push("");
      const deferredGroups = groupDeferredMarkdownSignals(group, deferred);
      for (const [label, differences] of deferredGroups) {
        lines.push(`- ${label} (${differences.length})`);
        for (const difference of differences.slice(0, 8)) {
          lines.push(`  - ${getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)} — ${difference.significance} · ${difference.kind}`);
        }
        if (differences.length > 8) {
          lines.push(`  - ${differences.length - 8} additional signal${differences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.`);
        }
      }
      lines.push("");
    }
  }

  appendMarkdownVerificationChecklist(lines, model);
  return lines.join("\n");
}
