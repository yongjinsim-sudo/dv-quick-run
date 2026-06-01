import type { ComparisonDriftGroup, ComparisonOperationalSignificance, ComparisonViewModel } from "../../core/comparison/index.js";
import { simplifyDifferenceSummary, simplifyDifferenceTitle } from "./comparisonSurfaceDifferences.js";
import { escapeHtml, significanceRank, slug } from "./comparisonSurfacePrimitives.js";

function getVerificationCategoryLabel(item: NonNullable<ComparisonDriftGroup["nearbyOperationalDrift"]>[number]): string {
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

function getVerificationChecklistAnchor(category: string): string {
  return `verification-${slug(category)}`;
}

export function renderNearbyVerificationChecklistPivot(item: NonNullable<ComparisonDriftGroup["nearbyOperationalDrift"]>[number]): string {
  if (!(item.representativeSignals ?? []).length) {
    return "";
  }

  const category = getVerificationCategoryLabel(item);
  return `<div class="dvqr-nearby-drift-pivots" aria-label="Investigation handoff">
        <span>Investigation handoff</span>
        <a class="dvqr-nearby-drift-pill" href="#${escapeHtml(getVerificationChecklistAnchor(category))}">Included in verification checklist ↓</a>
      </div>`;
}

interface VerificationChecklistItem {
  readonly title: string;
  readonly kind: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly sourceProvider: string;
  readonly purpose: string;
}

interface VerificationChecklistGroup {
  readonly category: string;
  readonly items: readonly VerificationChecklistItem[];
}

function getVerificationCategoryLabelFromGroup(group: ComparisonDriftGroup): string {
  const title = group.title.toLowerCase();

  if (title.includes("plugin") || title.includes("runtime")) {
    return "Runtime behaviour verification";
  }

  if (title.includes("workflow") || title.includes("automation") || title.includes("orchestration")) {
    return "Workflow / orchestration verification";
  }

  if (title.includes("solution") || title.includes("package")) {
    return "Package / solution verification";
  }

  if (title.includes("profile") || title.includes("density") || title.includes("score")) {
    return "Operational density verification";
  }

  if (title.includes("identity") || title.includes("user") || title.includes("team") || title.includes("role")) {
    return "Identity participation verification";
  }

  return "Operational verification";
}

export function collectVerificationChecklist(model: ComparisonViewModel): readonly VerificationChecklistGroup[] {
  const categories = new Map<string, Map<string, VerificationChecklistItem>>();

  const addItem = (category: string, item: VerificationChecklistItem): void => {
    const bucket = categories.get(category) ?? new Map<string, VerificationChecklistItem>();
    const key = `${category}::${item.title}::${item.kind}::${item.sourceProvider}`;
    if (!bucket.has(key)) {
      bucket.set(key, item);
    }

    categories.set(category, bucket);
  };

  for (const group of model.groups) {
    const groupCategory = getVerificationCategoryLabelFromGroup(group);

    for (const difference of group.differences) {
      addItem(groupCategory, {
        title: simplifyDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel),
        kind: difference.kind,
        significance: difference.significance,
        sourceProvider: group.title,
        purpose: simplifyDifferenceSummary(difference, model.summary.sourceLabel, model.summary.targetLabel)
      });
    }

    for (const nearby of group.nearbyOperationalDrift ?? []) {
      const category = getVerificationCategoryLabel(nearby);
      for (const signal of nearby.representativeSignals ?? []) {
        addItem(category, {
          title: signal.title,
          kind: signal.kind,
          significance: signal.significance,
          sourceProvider: nearby.relatedGroupTitle,
          purpose: nearby.summary
        });
      }
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
    .map(([category, items]) => ({
      category,
      items: [...items.values()].sort((left, right) => significanceRank(right.significance) - significanceRank(left.significance) || left.title.localeCompare(right.title))
    }))
    .filter((group) => group.items.length > 0)
    .sort((left, right) => {
      const leftIndex = categoryOrder.indexOf(left.category);
      const rightIndex = categoryOrder.indexOf(right.category);
      return (leftIndex === -1 ? categoryOrder.length : leftIndex) - (rightIndex === -1 ? categoryOrder.length : rightIndex);
    });
}

export function renderOperationalVerificationChecklist(model: ComparisonViewModel): string {
  const checklist = collectVerificationChecklist(model);
  if (!checklist.length) {
    return "";
  }

  const groups = checklist.map((group) => `<article class="dvqr-verification-checklist-group" id="${escapeHtml(getVerificationChecklistAnchor(group.category))}">
      <h3>${escapeHtml(group.category)}</h3>
      <p>Use these evidence-backed prompts for external validation. They are not root-cause findings, blame statements, or corrective instructions.</p>
      <ul>${group.items.map((item) => `<li data-verification-item-id="${escapeHtml(slug(`${group.category}-${item.title}`))}" data-verification-title="${escapeHtml(item.title)}" data-verification-provider="${escapeHtml(item.sourceProvider)}">
          <button type="button" class="dvqr-verification-checkbox" data-verification-toggle aria-label="Mark verification item reviewed">□</button>
          <div class="dvqr-verification-item-body">
            <span>
              <strong>Verify:</strong> ${escapeHtml(item.title)}
              <em>${escapeHtml(item.significance)} · ${escapeHtml(item.kind)} · from ${escapeHtml(item.sourceProvider)}</em>
            </span>
            <div class="dvqr-verification-review-controls">
              <label>
                <span>Status</span>
                <select class="dvqr-verification-status-select" data-verification-status>
                  <option value="NotReviewed">Not reviewed</option>
                  <option value="VerifiedExternally">Verified externally</option>
                  <option value="RecheckedCurrent">Rechecked against current</option>
                  <option value="ResolvedOutsideDvqr">Resolved outside DVQR</option>
                  <option value="NeedsFollowUp">Needs follow-up</option>
                </select>
              </label>
              <label class="dvqr-verification-note-label">
                <span>Reviewer note</span>
                <textarea class="dvqr-verification-note" data-verification-note rows="2" placeholder="Add external validation note, owner/team context, or follow-up reminder..."></textarea>
              </label>
            </div>
          </div>
        </li>`).join("")}</ul>
    </article>`).join("");

  return `<section class="dvqr-card dvqr-verification-checklist dvqr-workspace-mode-section" id="dvqr-verification-checklist" data-workspace-section="verification" aria-label="Operational verification checklist">
    <div class="dvqr-section-heading-row">
      <div>
        <h2>Operational Verification Checklist</h2>
        <p class="dvqr-muted">Consolidated review prompts from all rendered operational drift surfaces. Use this checklist to decide what needs human validation outside DVQR before treating environments as operationally equivalent.</p>
      </div>
    </div>
    <div class="dvqr-verification-checklist-note">
      <strong>External verification recommended</strong>
      <span>DVQR observes drift and supports verification. Humans retain operational authority and decide any corrective action.</span>
    </div>
    <div class="dvqr-verification-checklist-grid">${groups}</div>
  </section>`;
}
