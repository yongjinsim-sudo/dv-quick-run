import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { getComparisonSurfaceMarkup } from "./markup.js";
import { getComparisonSurfaceStyles } from "./styles.js";

function getComparisonSurfaceScript(initialInvestigationState: unknown = {}): string {
  const serializedInitialInvestigationState = JSON.stringify(initialInvestigationState ?? {}).replace(/</g, "\\u003c");
  return `
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;

  function escapeRuntimeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function emitEvidencePivotTrace(stage, details) {
    return;
  }

  window.addEventListener('error', (event) => {
    emitEvidencePivotTrace('webview.error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    emitEvidencePivotTrace('webview.unhandledRejection', {
      reason: String(event.reason)
    });
  });

  emitEvidencePivotTrace('script.initialized', {
    hasAcquireVsCodeApi: typeof acquireVsCodeApi === 'function',
    hasVscodeApi: Boolean(vscode),
    evidenceButtonCount: document.querySelectorAll('[data-evidence-inspect]').length,
    entityLogicalName: document.querySelector('#dvqr-comparison-top')?.getAttribute('data-entity-logical-name') || ''
  });

  const persistedState = ${serializedInitialInvestigationState};
  const webviewState = vscode?.getState?.() || {};
  const initialState = Object.assign({}, persistedState, webviewState);
  const investigationState = {
    activeMode: initialState.activeMode || 'investigation',
    baselineExportedAt: initialState.baselineExportedAt || undefined,
    reviewedSurfaces: Array.isArray(initialState.reviewedSurfaces) ? initialState.reviewedSurfaces : [],
    verifiedItems: Array.isArray(initialState.verifiedItems) ? initialState.verifiedItems : [],
    verificationStatusByItem: initialState.verificationStatusByItem && typeof initialState.verificationStatusByItem === 'object' ? initialState.verificationStatusByItem : {},
    verificationNotesByItem: initialState.verificationNotesByItem && typeof initialState.verificationNotesByItem === 'object' ? initialState.verificationNotesByItem : {}
  };


  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type !== 'evidencePivotResult') {
      return;
    }

    emitEvidencePivotTrace('message.evidencePivotResult', message);

    const evidenceId = message.evidenceId;
    if (!evidenceId) {
      return;
    }

    if (typeof evidencePivotTimers !== 'undefined' && evidencePivotTimers.has(evidenceId)) {
      clearTimeout(evidencePivotTimers.get(evidenceId));
      evidencePivotTimers.delete(evidenceId);
    }

    const result = document.querySelector('[data-evidence-live-result="' + evidenceId + '"]')
      ?? document.querySelector('[data-evidence-live-result="' + evidenceId + '-fallback"]');

    if (!result) {
      emitEvidencePivotTrace('message.resultTargetMissing', { evidenceId });
      return;
    }

    result.classList.remove('dvqr-live-pivot-timeout');
    result.classList.toggle('is-available', message.status === 'available');
    result.classList.toggle('is-unavailable', message.status === 'unavailable');
    result.classList.toggle('is-error', message.status === 'error');
    result.textContent = message.summary || 'Captured comparison context is available inline.';
  });


  function persistInvestigationState() {
    vscode?.setState?.(investigationState);
    vscode?.postMessage?.({ type: 'investigationStateChanged', state: investigationState });
  }

  function showInvestigationResetNotice() {
    let notice = document.querySelector('[data-reset-review-notice]');
    if (!notice) {
      notice = document.createElement('div');
      notice.setAttribute('data-reset-review-notice', 'true');
      notice.className = 'dvqr-reset-review-notice';
      const toolbar = document.querySelector('.dvqr-toolbar');
      toolbar?.insertAdjacentElement('afterend', notice);
    }

    if (notice) {
      notice.textContent = 'Review state reset for this local comparison. Snapshot evidence and comparison results were not changed.';
      notice.classList.add('is-visible');
      window.setTimeout(() => notice.classList.remove('is-visible'), 5200);
    }
  }

  function getResetConfirmationPanel() {
    let panel = document.querySelector('[data-reset-review-confirmation]');
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute('data-reset-review-confirmation', 'true');
      panel.className = 'dvqr-reset-review-confirmation';
      panel.innerHTML = '<strong>Reset review state?</strong><span>This clears checklist statuses, reviewer notes, reviewed cards, and baseline-export status for this local investigation. Snapshot evidence and comparison results are not changed.</span><div><button type="button" class="dvqr-action-button dvqr-action-button-primary" data-reset-review-confirm>Confirm reset</button><button type="button" class="dvqr-action-button" data-reset-review-cancel>Cancel</button></div>';
      const toolbar = document.querySelector('.dvqr-toolbar');
      toolbar?.insertAdjacentElement('afterend', panel);
    }

    return panel;
  }

  function showResetReviewConfirmation() {
    const panel = getResetConfirmationPanel();
    panel?.classList.add('is-visible');
  }

  function hideResetReviewConfirmation() {
    document.querySelector('[data-reset-review-confirmation]')?.classList.remove('is-visible');
  }


  function getVerificationStatus(itemId) {
    return investigationState.verificationStatusByItem[itemId] || 'NotReviewed';
  }

  function getVerificationNote(itemId) {
    return investigationState.verificationNotesByItem[itemId] || '';
  }

  function isReviewCompleteStatus(status) {
    return status === 'VerifiedExternally' || status === 'RecheckedCurrent' || status === 'ResolvedOutsideDvqr';
  }

  function normalizeVerificationReviewState() {
    const renderedVerificationIds = Array.from(document.querySelectorAll('[data-verification-item-id]'))
      .map((item) => item.getAttribute('data-verification-item-id'))
      .filter(Boolean);
    const renderedVerificationIdSet = new Set(renderedVerificationIds);

    investigationState.verifiedItems = Array.from(new Set(investigationState.verifiedItems))
      .filter((itemId) => renderedVerificationIdSet.size === 0 || renderedVerificationIdSet.has(itemId));

    Object.keys(investigationState.verificationStatusByItem).forEach((itemId) => {
      if (renderedVerificationIdSet.size > 0 && !renderedVerificationIdSet.has(itemId)) {
        delete investigationState.verificationStatusByItem[itemId];
      }
    });

    Object.keys(investigationState.verificationNotesByItem).forEach((itemId) => {
      if (renderedVerificationIdSet.size > 0 && !renderedVerificationIdSet.has(itemId)) {
        delete investigationState.verificationNotesByItem[itemId];
      }
    });

    renderedVerificationIds.forEach((itemId) => {
      const status = getVerificationStatus(itemId);
      if (isReviewCompleteStatus(status) && !investigationState.verifiedItems.includes(itemId)) {
        investigationState.verifiedItems.push(itemId);
      }
    });
  }


  function setArrayMembership(values, value, isMember) {
    const normalized = Array.isArray(values) ? values.filter(Boolean) : [];
    const without = normalized.filter((item) => item !== value);
    if (!isMember) {
      return without;
    }

    return without.concat(value);
  }


  document.querySelectorAll('[data-export-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.getAttribute('data-export-kind');
      if (vscode && kind) {
        vscode.postMessage({ type: 'saveComparison', kind });
      }
    });
  });

  function markBaselineExported(exportedAt) {
    investigationState.baselineExportedAt = exportedAt || new Date().toLocaleString();
    persistInvestigationState();
    const statusLabel = document.querySelector('[data-baseline-status-label]');
    const statusDescription = document.querySelector('[data-baseline-status-description]');
    const sessionNote = document.querySelector('[data-baseline-session-note]');
    const baselineButtons = Array.from(document.querySelectorAll('[data-export-kind="baseline"]'));

    if (statusLabel) {
      statusLabel.textContent = 'Baseline exported';
    }

    if (statusDescription) {
      statusDescription.textContent = 'Pre-investigation comparison evidence was exported at ' + (exportedAt || 'this session') + '. Later investigation state should be treated as review context layered over this baseline.';
    }

    if (sessionNote) {
      sessionNote.classList.add('is-exported');
      sessionNote.innerHTML = '<strong>Baseline captured</strong><span>Investigation review state can now be interpreted against the exported pre-investigation comparison baseline.</span>';
    }

    baselineButtons.forEach((button) => {
      button.classList.add('is-exported');
      button.textContent = 'Baseline Exported';
      button.setAttribute('aria-label', 'Pre-investigation baseline exported');
    });
  }

  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'baselineExported') {
      markBaselineExported(message.exportedAt);
    }
  });



  if (investigationState.baselineExportedAt) {
    markBaselineExported(investigationState.baselineExportedAt);
  }

  let activeGroupFilter = 'all';
  let activeSearchTerm = '';
  let searchMatches = [];
  let activeMatchIndex = -1;

  function normalizeText(value) {
    return (value || '').toLowerCase();
  }

  function clearHighlights(root) {
    root.querySelectorAll('mark.dvqr-search-highlight').forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) {
        return;
      }
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    });
  }

  function highlightTextNode(node, term) {
    const value = node.nodeValue || '';
    const lowerValue = value.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const matchIndex = lowerValue.indexOf(lowerTerm);
    if (matchIndex < 0) {
      return [];
    }

    const fragment = document.createDocumentFragment();
    const marks = [];
    let cursor = 0;
    let index = matchIndex;

    while (index >= 0) {
      if (index > cursor) {
        fragment.appendChild(document.createTextNode(value.slice(cursor, index)));
      }

      const mark = document.createElement('mark');
      mark.className = 'dvqr-search-highlight';
      mark.textContent = value.slice(index, index + term.length);
      fragment.appendChild(mark);
      marks.push(mark);
      cursor = index + term.length;
      index = lowerValue.indexOf(lowerTerm, cursor);
    }

    if (cursor < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(cursor)));
    }

    node.parentNode?.replaceChild(fragment, node);
    return marks;
  }

  function highlightMatches(root, term) {
    if (!term) {
      return [];
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script, style, input, button, mark')) {
          return NodeFilter.FILTER_REJECT;
        }

        return normalizeText(node.nodeValue).includes(normalizeText(term))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    return nodes.flatMap((node) => highlightTextNode(node, term));
  }

  function expandContextForMatch(match) {
    match.closest('details')?.setAttribute('open', '');
  }

  function updateSearchNavigation() {
    const count = document.querySelector('[data-search-count]');
    const prev = document.querySelector('[data-search-prev]');
    const next = document.querySelector('[data-search-next]');
    const hasMatches = searchMatches.length > 0;
    const position = hasMatches ? activeMatchIndex + 1 : 0;

    if (count) {
      count.textContent = position + ' / ' + searchMatches.length;
    }

    if (prev) {
      prev.disabled = !hasMatches;
    }

    if (next) {
      next.disabled = !hasMatches;
    }
  }

  function setActiveSearchMatch(index, shouldScroll) {
    searchMatches.forEach((match) => match.classList.remove('is-active'));

    if (searchMatches.length === 0) {
      activeMatchIndex = -1;
      updateSearchNavigation();
      return;
    }

    activeMatchIndex = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length;
    const activeMatch = searchMatches[activeMatchIndex];
    activeMatch.classList.add('is-active');
    expandContextForMatch(activeMatch);

    if (shouldScroll) {
      activeMatch.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }

    updateSearchNavigation();
  }

  function updateSearchStatus(matchCount, visibleGroupCount) {
    const status = document.querySelector('[data-search-status]');
    if (!status) {
      return;
    }

    if (!activeSearchTerm) {
      status.textContent = 'Search is local to this comparison.';
      return;
    }

    status.textContent = matchCount === 0
      ? 'No matches'
      : matchCount + ' match' + (matchCount === 1 ? '' : 'es') + ' in ' + visibleGroupCount + ' visible section' + (visibleGroupCount === 1 ? '' : 's');
  }

  function ensureSearchEmptyState() {
    let empty = document.querySelector('[data-search-empty]');
    if (empty) {
      return empty;
    }

    empty = document.createElement('div');
    empty.className = 'dvqr-search-empty';
    empty.setAttribute('data-search-empty', 'true');
    empty.textContent = 'No local evidence matched this search. Clear search or try a plugin, workflow, solution, identity, drift kind, or significance term.';
    document.querySelector('.dvqr-tabbar')?.after(empty);
    return empty;
  }

  function applyFilters() {
    const term = activeSearchTerm.trim().toLowerCase();
    searchMatches = [];
    activeMatchIndex = -1;
    let visibleGroupCount = 0;

    document.querySelectorAll('[data-group-id]').forEach((card) => {
      clearHighlights(card);
      const groupMatchesTab = activeGroupFilter === 'all' || card.getAttribute('data-group-id') === activeGroupFilter;
      const groupMatchesSearch = !term || normalizeText(card.textContent).includes(term);
      const show = groupMatchesTab && groupMatchesSearch;
      card.classList.toggle('is-hidden', !show);

      if (show) {
        visibleGroupCount += 1;
        searchMatches.push(...highlightMatches(card, activeSearchTerm.trim()));
      }
    });

    const empty = ensureSearchEmptyState();
    empty.classList.toggle('is-visible', Boolean(term) && visibleGroupCount === 0);
    updateSearchStatus(searchMatches.length, visibleGroupCount);
    setActiveSearchMatch(0, Boolean(term) && searchMatches.length > 0);
  }

  function activateTab(filter) {
    activeGroupFilter = filter || 'all';
    document.querySelectorAll('[data-group-filter]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-group-filter') === activeGroupFilter);
    });
    applyFilters();
  }

  function goToNextSearchMatch() {
    if (searchMatches.length === 0) {
      return;
    }

    setActiveSearchMatch(activeMatchIndex + 1, true);
  }

  function goToPreviousSearchMatch() {
    if (searchMatches.length === 0) {
      return;
    }

    setActiveSearchMatch(activeMatchIndex - 1, true);
  }

  document.querySelectorAll('[data-group-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activateTab(tab.getAttribute('data-group-filter') || 'all');
    });
  });


  // Workstream 21 functional workspace modes
  const workspaceModeButtons = Array.from(document.querySelectorAll('[data-workspace-mode]'));
  const workspaceModeSections = Array.from(document.querySelectorAll('[data-workspace-section]'));
  const workspaceContinuationLinks = Array.from(document.querySelectorAll('[data-continuation-target]'));
  const workspaceActiveLabel = document.querySelector('[data-workspace-active-label]');
  const workspaceActiveDescription = document.querySelector('[data-workspace-active-description]');
  const workspaceSummaryTitle = document.querySelector('[data-workspace-mode-summary-title]');
  const workspaceSummaryCopy = document.querySelector('[data-workspace-mode-summary-copy]');

  const workspaceModeDetails = {
    investigation: {
      label: 'Investigation',
      title: 'Investigation view active',
      description: 'Observation briefing, storyline, continuity, top operational signals, and investigation progression.',
      summary: 'Showing investigation continuity, storyline, top signals, and the full evidence browser. Switch modes to narrow focus for verification or handoff.',
      target: '#dvqr-investigation-observation-briefing'
    },
    findings: {
      label: 'Findings',
      title: 'Findings view active',
      description: 'Provider evidence, grouped drift, runtime participation, and operational signals.',
      summary: 'Showing grouped provider drift, runtime behaviour, density changes, solution participation, and identity evidence for detailed inspection.',
      target: '#dvqr-findings-mode'
    },
    verification: {
      label: 'Verification',
      title: 'Verification view active',
      description: 'Checklist review, unresolved validation items, and external verification posture.',
      summary: 'Showing investigation continuations and the operational verification checklist. Use Findings to inspect the underlying evidence behind each validation item.',
      target: '#dvqr-verification-checklist'
    },
    handoff: {
      label: 'Handoff',
      title: 'Handoff view active',
      description: 'Operational review packaging, unresolved drift summary, and transfer context.',
      summary: 'Showing handoff readiness and transfer guidance for human review outside DVQR. Use Verification for checklist review and Findings for evidence inspection.',
      target: '#dvqr-handoff-readiness'
    }
  };

  function getWorkspaceModeForTarget(href) {
    if (!href) {
      return 'investigation';
    }

    if (href === '#dvqr-verification-checklist' || href.indexOf('verification-checklist') >= 0) {
      return 'verification';
    }

    if (href === '#dvqr-handoff-readiness') {
      return 'handoff';
    }

    if (href === '#dvqr-operational-storyline' || href === '#dvqr-investigation-session' || href === '#dvqr-investigation-observation-briefing') {
      return 'investigation';
    }

    if (href.indexOf('drift') >= 0 || href.indexOf('difference') >= 0 || href.indexOf('group') >= 0 || href === '#dvqr-findings-mode') {
      return 'findings';
    }

    return 'investigation';
  }

  function focusWorkspaceTarget(selector) {
    if (!selector || selector.charAt(0) !== '#') {
      return;
    }

    const target = document.querySelector(selector);
    if (!target) {
      return;
    }

    target.classList.remove('dvqr-focus-pulse');
    void target.offsetWidth;
    target.classList.add('dvqr-focus-pulse');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  function resetFindingsFiltersForNonFindingsMode(mode) {
    if (mode === 'findings') {
      return;
    }

    const searchInputForReset = document.querySelector('#dvqr-comparison-search');
    activeGroupFilter = 'all';
    activeSearchTerm = '';
    if (searchInputForReset) {
      searchInputForReset.value = '';
    }
    document.querySelectorAll('[data-group-filter]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-group-filter') === 'all');
    });
    applyFilters();
  }

  function setWorkspaceMode(mode, shouldScroll) {
    const normalizedMode = workspaceModeDetails[mode] ? mode : 'investigation';
    const details = workspaceModeDetails[normalizedMode];

    workspaceModeButtons.forEach((button) => {
      const active = button.getAttribute('data-workspace-mode') === normalizedMode;
      button.classList.toggle('dvqr-investigation-mode-tab-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    workspaceModeSections.forEach((section) => {
      if (section.id === 'dvqr-investigation-workspace' || section.classList.contains('dvqr-investigation-mode-surface')) {
        section.classList.remove('dvqr-mode-hidden');
        section.setAttribute('aria-hidden', 'false');
        return;
      }

      const sectionModes = (section.getAttribute('data-workspace-section') || '').split(/\s+/).filter(Boolean);
      const visible = sectionModes.length === 0 || sectionModes.includes(normalizedMode);
      section.classList.toggle('dvqr-mode-hidden', !visible);
      section.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });

    if (workspaceActiveLabel) {
      workspaceActiveLabel.textContent = details.label;
    }

    if (workspaceActiveDescription) {
      workspaceActiveDescription.textContent = details.description;
    }

    if (workspaceSummaryTitle) {
      workspaceSummaryTitle.textContent = details.title;
    }

    if (workspaceSummaryCopy) {
      workspaceSummaryCopy.textContent = details.summary;
    }


    document.body.setAttribute('data-active-workspace-mode', normalizedMode);
    investigationState.activeMode = normalizedMode;
    persistInvestigationState();

    resetFindingsFiltersForNonFindingsMode(normalizedMode);

    if (shouldScroll) {
      const target = document.querySelector(details.target);
      if (target && !target.classList.contains('dvqr-mode-hidden')) {
        focusWorkspaceTarget(details.target);
      } else {
        const firstVisibleSection = workspaceModeSections.find((section) => !section.classList.contains('dvqr-mode-hidden'));
        if (firstVisibleSection && firstVisibleSection.id) {
          focusWorkspaceTarget('#' + firstVisibleSection.id);
        }
      }
    }
  }

  workspaceModeButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      setWorkspaceMode(button.getAttribute('data-workspace-mode') || 'investigation', true);
    });
  });

  workspaceContinuationLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      setWorkspaceMode(getWorkspaceModeForTarget(href), false);
      focusWorkspaceTarget(href);
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const anchor = target.closest('a[href^="#"]');
    if (!anchor || anchor.hasAttribute('data-continuation-target')) {
      return;
    }

    const href = anchor.getAttribute('href');
    if (!href || href === '#dvqr-comparison-top') {
      return;
    }

    const targetElement = document.querySelector(href);
    if (!targetElement) {
      return;
    }

    const isTopSignalLink = Boolean(anchor.closest('.dvqr-top-signals'));
    const inferredMode = getWorkspaceModeForTarget(href);

    if (isTopSignalLink || targetElement.classList.contains('dvqr-mode-hidden')) {
      event.preventDefault();
      setWorkspaceMode(inferredMode, false);
      window.setTimeout(() => {
        focusWorkspaceTarget(href);
      }, 0);
    }
  });

  setWorkspaceMode(investigationState.activeMode || 'investigation', false);




  function getTotalVerificationItems() {
    const checklistItems = document.querySelectorAll('[data-verification-item-id]').length;
    return checklistItems || investigationState.verifiedItems.length;
  }

  function getStatusLabel(status) {
    const labels = {
      NotReviewed: 'Not reviewed',
      VerifiedExternally: 'Verified externally',
      RecheckedCurrent: 'Rechecked against current',
      ResolvedOutsideDvqr: 'Resolved outside DVQR',
      NeedsFollowUp: 'Needs follow-up'
    };

    return labels[status] || status || 'Not reviewed';
  }

  function clearReflectedReviewPosture() {
    document.querySelectorAll('[data-reflected-review-posture]').forEach((element) => element.remove());
  }

  function createReviewPill(label, value, status) {
    const pill = document.createElement('span');
    pill.className = 'dvqr-review-pill';
    pill.setAttribute('data-reflected-review-posture', 'true');
    if (status) {
      pill.setAttribute('data-review-status', status);
    }

    const strong = document.createElement('strong');
    strong.textContent = label;
    pill.appendChild(strong);
    pill.appendChild(document.createTextNode(' ' + value));
    return pill;
  }

  function normalizeReviewText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getReviewMatchTokens(title, provider) {
    const normalizedTitle = normalizeReviewText(title);
    const normalizedProvider = normalizeReviewText(provider);
    const tokens = [normalizedTitle];

    if (normalizedTitle.startsWith('verify ')) {
      tokens.push(normalizedTitle.replace(/^verify\s+/, ''));
    }

    if (normalizedTitle.includes(' changed ')) {
      tokens.push(normalizedTitle.split(' changed ')[0]);
    }

    if (normalizedTitle.includes(' added ')) {
      tokens.push(normalizedTitle.split(' added ')[0]);
    }

    if (normalizedTitle.includes(' removed ')) {
      tokens.push(normalizedTitle.split(' removed ')[0]);
    }

    if (normalizedProvider) {
      tokens.push(normalizedProvider);
    }

    return Array.from(new Set(tokens.filter((token) => token.length >= 4)));
  }

  function findReviewPostureTargets(title, provider) {
    const tokens = getReviewMatchTokens(title, provider);
    const surfaces = Array.from(document.querySelectorAll('.dvqr-difference-card, .dvqr-top-signals a'));

    return surfaces.filter((surface) => {
      const surfaceText = normalizeReviewText(surface.textContent || '');
      return tokens.some((token) => surfaceText.includes(token));
    });
  }

  function reflectReviewPostureToFindings() {
    clearReflectedReviewPosture();

    document.querySelectorAll('[data-verification-item-id]').forEach((item) => {
      const itemId = item.getAttribute('data-verification-item-id');
      const title = item.getAttribute('data-verification-title') || '';
      const provider = item.getAttribute('data-verification-provider') || '';
      if (!itemId || !title) {
        return;
      }

      const status = getVerificationStatus(itemId);
      const note = getVerificationNote(itemId).trim();
      if (status === 'NotReviewed' && !note) {
        return;
      }

      const targetCards = findReviewPostureTargets(title, provider);

      targetCards.forEach((surface) => {
        let container = surface.querySelector(':scope > .dvqr-review-aware-surface');
        if (!container) {
          container = document.createElement('div');
          container.className = 'dvqr-review-aware-surface';
          container.setAttribute('data-reflected-review-posture', 'true');
          surface.appendChild(container);
        }

        if (status !== 'NotReviewed') {
          container.appendChild(createReviewPill('Review status', getStatusLabel(status), status));
        }

        if (note) {
          container.appendChild(createReviewPill('Reviewer note', note.length > 120 ? note.slice(0, 117) + '...' : note, undefined));
        }
      });
    });
  }


  function getOutstandingReviewItems() {
    return Array.from(document.querySelectorAll('[data-verification-item-id]'))
      .map((item) => {
        const itemId = item.getAttribute('data-verification-item-id');
        const title = item.getAttribute('data-verification-title') || 'Operational drift signal';
        const provider = item.getAttribute('data-verification-provider') || 'Operational evidence';
        const status = itemId ? getVerificationStatus(itemId) : 'NotReviewed';
        const note = itemId ? getVerificationNote(itemId).trim() : '';
        const text = (item.textContent || '').toLowerCase();
        return { itemId, title, provider, status, note, high: text.includes('high') };
      })
      .filter((item) => item.status === 'NotReviewed' || item.status === 'NeedsFollowUp');
  }

  function updateOutstandingVerificationList(outstandingItems) {
    const list = document.querySelector('[data-outstanding-verification-list]');
    if (!list) {
      return;
    }

    list.innerHTML = '';

    const priorityItems = outstandingItems
      .filter((item) => item.high || item.status === 'NeedsFollowUp')
      .slice(0, 4);

    if (!priorityItems.length) {
      const item = document.createElement('li');
      item.className = 'dvqr-outstanding-verification-resolved';
      item.innerHTML = '<strong>No outstanding operational verification items</strong><span>All rendered verification items have a reviewed posture. Continue with handoff review if needed.</span>';
      list.appendChild(item);
      return;
    }

    priorityItems.forEach((entry) => {
      const item = document.createElement('li');
      item.setAttribute('data-review-status', entry.status);
      const statusLabel = entry.status === 'NeedsFollowUp' ? 'Needs follow-up' : 'Not reviewed';
      item.innerHTML = '<strong>' + escapeRuntimeHtml(entry.title) + '</strong><span>' + escapeRuntimeHtml(statusLabel + ' · ' + entry.provider + (entry.note ? ' · ' + entry.note : '')) + '</span>';
      list.appendChild(item);
    });
  }

  function updateVerificationPosture(coverage, outstandingItems) {
    const pill = document.querySelector('[data-verification-posture-pill]');
    if (!pill) {
      return;
    }

    pill.classList.remove('dvqr-investigation-status-pill-warning', 'dvqr-investigation-status-pill-success');

    const hasFollowUp = outstandingItems.some((item) => item.status === 'NeedsFollowUp');
    if (coverage === 100 && !hasFollowUp) {
      pill.textContent = 'Verification posture: Reviewed';
      pill.classList.add('dvqr-investigation-status-pill-success');
      return;
    }

    if (coverage === 100 && hasFollowUp) {
      pill.textContent = 'Verification posture: Follow-up required';
      pill.classList.add('dvqr-investigation-status-pill-warning');
      return;
    }

    pill.textContent = 'Verification posture: In Progress';
    pill.classList.add('dvqr-investigation-status-pill-warning');
  }


  function updateReviewSummary() {
    investigationState.reviewedSurfaces = Array.from(new Set(investigationState.reviewedSurfaces));
    normalizeVerificationReviewState();

    const verificationItems = Array.from(document.querySelectorAll('[data-verification-item-id]'));
    const reviewedProviderSet = new Set();
    const totalProviderSet = new Set();
    let outstandingHighCount = 0;

    verificationItems.forEach((item) => {
      const provider = item.getAttribute('data-verification-provider') || item.getAttribute('data-verification-title') || 'unknown';
      const itemId = item.getAttribute('data-verification-item-id');
      const status = itemId ? getVerificationStatus(itemId) : 'NotReviewed';
      const significanceText = (item.textContent || '').toLowerCase();
      totalProviderSet.add(provider);
      if (isReviewCompleteStatus(status) || status === 'NeedsFollowUp') {
        reviewedProviderSet.add(provider);
      }

      if (significanceText.includes('high') && status === 'NotReviewed') {
        outstandingHighCount += 1;
      }
    });

    const reviewedCount = reviewedProviderSet.size || investigationState.reviewedSurfaces.length;
    const totalReviewSurfaceCount = totalProviderSet.size || 5;
    const verifiedCount = investigationState.verifiedItems.length;
    const statusValues = Object.values(investigationState.verificationStatusByItem);
    const noteValues = Object.values(investigationState.verificationNotesByItem).filter((note) => String(note || '').trim().length > 0);
    const followUpCount = statusValues.filter((status) => status === 'NeedsFollowUp').length;
    const externallyVerifiedCount = statusValues.filter((status) => status === 'VerifiedExternally').length;
    const resolvedOutsideCount = statusValues.filter((status) => status === 'ResolvedOutsideDvqr').length;

    const reviewedCountElement = document.querySelector('[data-reviewed-count]');
    const reviewedSurfaceProgressElement = document.querySelector('[data-reviewed-surface-progress]');
    const outstandingHighCountElement = document.querySelector('[data-outstanding-high-count]');
    const outstandingCountElement = document.querySelector('[data-outstanding-count]');
    const coverageElement = document.querySelector('[data-verification-coverage]');
    const progressCaption = document.querySelector('[data-verification-progress-caption]');
    const progressFill = document.querySelector('[data-verification-progress-fill]');
    const handoffVerifiedCount = document.querySelector('[data-handoff-verified-count]');
    const handoffFollowupCount = document.querySelector('[data-handoff-followup-count]');
    const handoffNoteCount = document.querySelector('[data-handoff-note-count]');
    const reviewNotesSummary = document.querySelector('[data-review-notes-summary]');

    const totalVerificationItems = getTotalVerificationItems();
    const outstandingCount = Math.max(totalVerificationItems - verifiedCount, 0);
    const coverage = totalVerificationItems > 0 ? Math.round((verifiedCount / totalVerificationItems) * 100) : 0;
    const outstandingReviewItems = getOutstandingReviewItems();

    if (reviewedCountElement) {
      reviewedCountElement.textContent = String(reviewedCount);
    }

    if (reviewedSurfaceProgressElement) {
      reviewedSurfaceProgressElement.textContent = String(reviewedCount) + ' / ' + String(totalReviewSurfaceCount);
    }

    if (outstandingHighCountElement) {
      outstandingHighCountElement.textContent = String(outstandingHighCount);
    }

    if (outstandingCountElement) {
      outstandingCountElement.textContent = String(outstandingCount);
    }

    if (coverageElement) {
      coverageElement.textContent = String(coverage) + '%';
    }

    if (progressCaption) {
      progressCaption.textContent = String(verifiedCount) + ' of ' + String(totalVerificationItems) + ' operational verification items reviewed in this session';
    }

    if (progressFill) {
      progressFill.style.width = String(coverage) + '%';
    }

    updateOutstandingVerificationList(outstandingReviewItems);
    updateVerificationPosture(coverage, outstandingReviewItems);

    if (handoffVerifiedCount) {
      handoffVerifiedCount.textContent = String(externallyVerifiedCount + resolvedOutsideCount);
    }

    if (handoffFollowupCount) {
      handoffFollowupCount.textContent = String(followUpCount);
    }

    if (handoffNoteCount) {
      handoffNoteCount.textContent = String(noteValues.length);
    }

    if (reviewNotesSummary) {
      reviewNotesSummary.textContent = noteValues.length
        ? String(noteValues.length) + ' reviewer note' + (noteValues.length === 1 ? '' : 's') + ' captured. Include these as review context, not remediation authority.'
        : 'No reviewer notes captured in this investigation session.';
    }

    reflectReviewPostureToFindings();
  }

  function hydrateReviewState() {
    document.querySelectorAll('[data-review-surface-id]').forEach((surface) => {
      const surfaceId = surface.getAttribute('data-review-surface-id');
      const reviewed = Boolean(surfaceId && investigationState.reviewedSurfaces.includes(surfaceId));
      const button = surface.querySelector('[data-review-toggle]');
      surface.classList.toggle('is-reviewed', reviewed);
      if (button) {
        button.classList.toggle('is-reviewed', reviewed);
        button.textContent = reviewed ? 'Reviewed' : 'Mark reviewed';
        button.setAttribute('aria-pressed', reviewed ? 'true' : 'false');
      }
    });

    document.querySelectorAll('[data-verification-item-id]').forEach((item) => {
      const itemId = item.getAttribute('data-verification-item-id');
      const reviewed = Boolean(itemId && investigationState.verifiedItems.includes(itemId));
      const button = item.querySelector('[data-verification-toggle]');
      const statusSelect = item.querySelector('[data-verification-status]');
      const noteInput = item.querySelector('[data-verification-note]');
      const status = itemId ? getVerificationStatus(itemId) : 'NotReviewed';
      const note = itemId ? getVerificationNote(itemId) : '';

      item.classList.toggle('is-reviewed', reviewed);
      item.setAttribute('data-review-status', status);

      if (button) {
        button.classList.toggle('is-reviewed', reviewed);
        button.textContent = reviewed ? '✓' : '□';
        button.setAttribute('aria-pressed', reviewed ? 'true' : 'false');
        button.setAttribute('aria-label', reviewed ? 'Verification item reviewed' : 'Mark verification item reviewed');
      }

      if (statusSelect) {
        statusSelect.value = status;
      }

      if (noteInput && noteInput.value !== note) {
        noteInput.value = note;
      }
    });

    updateReviewSummary();
  }

  function clearInvestigationReviewState() {
    investigationState.activeMode = 'investigation';
    investigationState.baselineExportedAt = undefined;
    investigationState.reviewedSurfaces = [];
    investigationState.verifiedItems = [];
    investigationState.verificationStatusByItem = {};
    investigationState.verificationNotesByItem = {};

    vscode?.setState?.(investigationState);
    vscode?.postMessage?.({ type: 'resetInvestigationState' });

    clearReflectedReviewPosture();

    document.querySelectorAll('[data-review-surface-id]').forEach((surface) => {
      surface.classList.remove('is-reviewed');
      const button = surface.querySelector('[data-review-toggle]');
      if (button) {
        button.classList.remove('is-reviewed');
        button.textContent = 'Mark reviewed';
        button.setAttribute('aria-pressed', 'false');
      }
    });

    document.querySelectorAll('[data-verification-item-id]').forEach((item) => {
      item.classList.remove('is-reviewed');
      item.setAttribute('data-review-status', 'NotReviewed');

      const button = item.querySelector('[data-verification-toggle]');
      if (button) {
        button.classList.remove('is-reviewed');
        button.textContent = '□';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', 'Mark verification item reviewed');
      }

      const statusSelect = item.querySelector('[data-verification-status]');
      if (statusSelect) {
        statusSelect.value = 'NotReviewed';
      }

      const noteInput = item.querySelector('[data-verification-note]');
      if (noteInput) {
        noteInput.value = '';
      }
    });

    document.querySelectorAll('[data-baseline-session-note]').forEach((note) => {
      note.classList.remove('is-exported');
      note.innerHTML = '<strong>Baseline boundary pending</strong><span>Export the pre-investigation baseline before marking evidence reviewed so later handoff state can be compared against the original observed diff.</span>';
    });

    document.querySelectorAll('[data-baseline-export-button]').forEach((button) => {
      button.classList.remove('is-exported');
      button.textContent = 'Export Baseline Diff';
      button.setAttribute('aria-label', 'Export pre-investigation baseline diff');
    });

    setWorkspaceMode('investigation', false);
    updateReviewSummary();
    hydrateReviewState();
    showInvestigationResetNotice();
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const confirmResetButton = target.closest('[data-reset-review-confirm]');
    if (confirmResetButton) {
      event.preventDefault();
      event.stopPropagation();
      hideResetReviewConfirmation();
      clearInvestigationReviewState();
      return;
    }

    const cancelResetButton = target.closest('[data-reset-review-cancel]');
    if (cancelResetButton) {
      event.preventDefault();
      event.stopPropagation();
      hideResetReviewConfirmation();
      return;
    }

    const resetButton = target.closest('[data-reset-investigation-state]');
    if (!resetButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    showResetReviewConfirmation();
  });

  document.querySelectorAll('[data-review-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const surface = button.closest('[data-review-surface-id]');
      const surfaceId = surface?.getAttribute('data-review-surface-id');
      if (!surfaceId) {
        return;
      }

      const reviewed = !investigationState.reviewedSurfaces.includes(surfaceId);
      investigationState.reviewedSurfaces = setArrayMembership(investigationState.reviewedSurfaces, surfaceId, reviewed);
      persistInvestigationState();
      hydrateReviewState();
    });
  });

  document.querySelectorAll('[data-verification-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('[data-verification-item-id]');
      const itemId = item?.getAttribute('data-verification-item-id');
      if (!itemId) {
        return;
      }

      const reviewed = !investigationState.verifiedItems.includes(itemId);
      investigationState.verifiedItems = setArrayMembership(investigationState.verifiedItems, itemId, reviewed);
      if (reviewed && getVerificationStatus(itemId) === 'NotReviewed') {
        investigationState.verificationStatusByItem[itemId] = 'VerifiedExternally';
      }

      if (!reviewed && isReviewCompleteStatus(getVerificationStatus(itemId))) {
        investigationState.verificationStatusByItem[itemId] = 'NotReviewed';
      }

      persistInvestigationState();
      hydrateReviewState();
    });
  });

  document.querySelectorAll('[data-verification-status]').forEach((select) => {
    select.addEventListener('change', () => {
      const item = select.closest('[data-verification-item-id]');
      const itemId = item?.getAttribute('data-verification-item-id');
      if (!itemId) {
        return;
      }

      const status = select.value || 'NotReviewed';
      investigationState.verificationStatusByItem[itemId] = status;
      investigationState.verifiedItems = setArrayMembership(investigationState.verifiedItems, itemId, isReviewCompleteStatus(status));
      persistInvestigationState();
      hydrateReviewState();
    });
  });

  document.querySelectorAll('[data-verification-note]').forEach((input) => {
    input.addEventListener('input', () => {
      const item = input.closest('[data-verification-item-id]');
      const itemId = item?.getAttribute('data-verification-item-id');
      if (!itemId) {
        return;
      }

      investigationState.verificationNotesByItem[itemId] = input.value || '';
      persistInvestigationState();
      updateReviewSummary();
    });
  });

  hydrateReviewState();



  function resolveEvidenceButton(target) {
    if (!(target instanceof Element)) {
      return undefined;
    }

    return target.closest('[data-evidence-inspect]');
  }

  function ensureEvidenceContext(button, evidenceId) {
    const item = button.closest('.dvqr-evidence-item');
    let context = item?.querySelector('[data-evidence-context="' + evidenceId + '"]')
      ?? document.querySelector('[data-evidence-context="' + evidenceId + '"]');

    if (context) {
      return context;
    }

    if (!item) {
      return undefined;
    }

    const fallback = document.createElement('div');
    fallback.className = 'dvqr-inline-evidence-context';
    fallback.setAttribute('data-evidence-context', evidenceId);
    fallback.setAttribute('hidden', '');
    fallback.innerHTML = '<strong>Inline evidence context</strong><span>Captured evidence context was not pre-rendered for this row. DVQR will still request the bounded live evidence pivot where possible.</span><dl><dt>Live evidence pivot</dt><dd data-evidence-live-result="' + evidenceId + '">Not queried yet.</dd></dl>';
    item.appendChild(fallback);
    return fallback;
  }

  function requestEvidencePivot(button, evidenceId) {
    const evidenceItem = button.closest('.dvqr-evidence-item');
    emitEvidencePivotTrace('request.prepare', { evidenceId, hasEvidenceItem: Boolean(evidenceItem) });
    const liveResult = evidenceItem?.querySelector('[data-evidence-live-result="' + evidenceId + '"]')
      ?? document.querySelector('[data-evidence-live-result="' + evidenceId + '"]');

    if (liveResult && liveResult.textContent === 'Not queried yet.') {
      liveResult.textContent = 'Requesting bounded live evidence pivot from DVQR...';

      window.setTimeout(() => {
        if (liveResult.textContent === 'Requesting bounded live evidence pivot from DVQR...') {
          liveResult.textContent = 'No response returned from DVQR yet. Captured evidence remains available inline; retry after confirming the Dataverse connection.';
          liveResult.classList.add('dvqr-live-pivot-timeout');
        }
      }, 18000);
    }

    emitEvidencePivotTrace('request.postMessage', {
      evidenceId,
      label: evidenceItem?.getAttribute('data-evidence-label') || '',
      value: evidenceItem?.getAttribute('data-evidence-value') || '',
      evidenceKind: evidenceItem?.getAttribute('data-evidence-kind') || 'evidence',
      entityLogicalName: document.querySelector('#dvqr-comparison-top')?.getAttribute('data-entity-logical-name') || ''
    });

    vscode?.postMessage?.({
      type: 'evidencePivotRequested',
      evidenceId,
      label: evidenceItem?.getAttribute('data-evidence-label') || '',
      value: evidenceItem?.getAttribute('data-evidence-value') || '',
      evidenceKind: evidenceItem?.getAttribute('data-evidence-kind') || 'evidence',
      parentTitle: evidenceItem?.getAttribute('data-parent-title') || '',
      parentSummary: evidenceItem?.getAttribute('data-parent-summary') || '',
      parentKind: evidenceItem?.getAttribute('data-parent-kind') || '',
      parentProvider: evidenceItem?.getAttribute('data-parent-provider') || '',
      parentEvidence: evidenceItem?.getAttribute('data-parent-evidence') || '',
      entityLogicalName: document.querySelector('#dvqr-comparison-top')?.getAttribute('data-entity-logical-name') || ''
    });
  }

  function activateEvidenceButton(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const evidenceId = button.getAttribute('data-evidence-inspect');
    emitEvidencePivotTrace('activate.start', { evidenceId: evidenceId || '', text: button.textContent?.trim() || '' });
    if (!evidenceId) {
      return;
    }

    const context = ensureEvidenceContext(button, evidenceId);
    if (!context) {
      emitEvidencePivotTrace('activate.noContext', { evidenceId });
      return;
    }

    const isHidden = context.hasAttribute('hidden');
    context.toggleAttribute('hidden', !isHidden);
    button.classList.toggle('is-active', isHidden);
    button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');

    const collapsedLabel = button.getAttribute('data-evidence-label-collapsed') || 'Investigate evidence ›';
    button.textContent = isHidden ? 'Hide evidence context ↑' : collapsedLabel;

    emitEvidencePivotTrace('activate.toggled', { evidenceId, expanded: isHidden });

    if (isHidden) {
      requestEvidencePivot(button, evidenceId);
    }
  }


  document.addEventListener('pointerdown', (event) => {
    const button = resolveEvidenceButton(event.target);
    if (!button) {
      return;
    }

    emitEvidencePivotTrace('pointerdown.detected', {
      evidenceId: button.getAttribute('data-evidence-inspect') || '',
      text: button.textContent?.trim() || '',
      hasEvidenceItem: Boolean(button.closest('.dvqr-evidence-item'))
    });
  }, true);

  document.addEventListener('click', (event) => {
    const button = resolveEvidenceButton(event.target);
    if (!button) {
      return;
    }

    activateEvidenceButton(button, event);
  });

  const evidenceButtons = document.querySelectorAll('[data-evidence-inspect]');
  evidenceButtons.forEach((button) => {
    button.addEventListener('click', (event) => activateEvidenceButton(button, event));
  });
  emitEvidencePivotTrace('bindings.installed', { evidenceButtonCount: evidenceButtons.length });


  const searchInput = document.querySelector('#dvqr-comparison-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      activeSearchTerm = searchInput.value || '';
      applyFilters();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        goToPreviousSearchMatch();
        return;
      }

      goToNextSearchMatch();
    });
  }

  document.querySelector('[data-search-prev]')?.addEventListener('click', goToPreviousSearchMatch);
  document.querySelector('[data-search-next]')?.addEventListener('click', goToNextSearchMatch);

  document.querySelector('[data-search-clear]')?.addEventListener('click', () => {
    activeSearchTerm = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    applyFilters();
  });

  updateSearchNavigation();
})();`;
}

export function renderComparisonSurfaceHtml(
  webview: vscode.Webview,
  model: ComparisonViewModel,
  options: { readonly canExport?: boolean; readonly isProPreview?: boolean; readonly investigationState?: unknown } = {}
): string {
  const cspSource = webview.cspSource;
  const nonce = String(Date.now());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${model.title.startsWith("Timeline Diff") ? "DV Quick Run Timeline Diff" : "DV Quick Run Cross-Environment Diff"}</title>
  <style>${getComparisonSurfaceStyles()}</style>
</head>
<body>
  ${getComparisonSurfaceMarkup(model, options)}
  <script nonce="${nonce}">${getComparisonSurfaceScript(options.investigationState)}</script>
</body>
</html>`;
}

export function renderStandaloneComparisonSurfaceHtml(model: ComparisonViewModel): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${model.title.startsWith("Timeline Diff") ? "DV Quick Run Timeline Diff" : "DV Quick Run Cross-Environment Diff"}</title>
  <style>${getComparisonSurfaceStyles()}</style>
</head>
<body>
  ${getComparisonSurfaceMarkup(model)}
  <script>${getComparisonSurfaceScript().replace(/vscode\.postMessage\(\{ type: 'saveComparison', kind \}\);/g, "")}</script>
</body>
</html>`;
}


// workstream25ReviewAwareSurfaces
// Review posture is now designed to flow back into:
// - findings surfaces
// - provider drift cards
// - investigation storyline
// - handoff summaries
// while preserving evidence immutability semantics.
