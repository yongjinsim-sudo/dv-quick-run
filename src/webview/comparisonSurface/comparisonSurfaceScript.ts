import { getComparisonSurfaceReviewStateScript } from "./comparisonSurfaceReviewStateScript";
import { getComparisonSurfaceSearchScript } from "./comparisonSurfaceSearchScript";
import { getComparisonSurfaceWorkspaceModeScript } from "./comparisonSurfaceWorkspaceModeScript";
import { getComparisonSurfaceEvidencePivotScript } from "./comparisonSurfaceEvidencePivotScript";

export function getComparisonSurfaceScript(initialInvestigationState: unknown = {}): string {
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


  ${getComparisonSurfaceEvidencePivotScript()}


${getComparisonSurfaceReviewStateScript()}

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

    if (renderedVerificationIdSet.size === 0) {
      investigationState.verifiedItems = [];
      investigationState.verificationStatusByItem = {};
      investigationState.verificationNotesByItem = {};
      return;
    }

    investigationState.verifiedItems = Array.from(new Set(investigationState.verifiedItems))
      .filter((itemId) => renderedVerificationIdSet.has(itemId));

    Object.keys(investigationState.verificationStatusByItem).forEach((itemId) => {
      if (!renderedVerificationIdSet.has(itemId)) {
        delete investigationState.verificationStatusByItem[itemId];
      }
    });

    Object.keys(investigationState.verificationNotesByItem).forEach((itemId) => {
      if (!renderedVerificationIdSet.has(itemId)) {
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

      const reportMenu = button.closest('.dvqr-report-menu');
      if (reportMenu) {
        reportMenu.removeAttribute('open');
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

  ${getComparisonSurfaceSearchScript()}

  ${getComparisonSurfaceWorkspaceModeScript()}



  function getTotalVerificationItems() {
    return document.querySelectorAll('[data-verification-item-id]').length;
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

  function updateOutstandingVerificationList(outstandingItems, totalVerificationItems) {
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
      item.innerHTML = totalVerificationItems > 0
        ? '<strong>No outstanding operational verification items</strong><span>All rendered verification items have a reviewed posture. Continue with handoff review if needed.</span>'
        : '<strong>No rendered operational verification items</strong><span>No provider drift evidence produced verification checklist items for this comparison.</span>';
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

  function updateVerificationPosture(coverage, outstandingItems, totalVerificationItems) {
    const pill = document.querySelector('[data-verification-posture-pill]');
    if (!pill) {
      return;
    }

    pill.classList.remove('dvqr-investigation-status-pill-warning', 'dvqr-investigation-status-pill-success');

    if (totalVerificationItems === 0) {
      pill.textContent = 'Verification posture: No verification items';
      return;
    }

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

    const reviewedCount = reviewedProviderSet.size;
    const totalReviewSurfaceCount = totalProviderSet.size;
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
    const reviewBannerTitle = document.querySelector('[data-verification-banner-title]');
    const reviewBannerDescription = document.querySelector('[data-verification-banner-description]');
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

    if (reviewBannerTitle) {
      reviewBannerTitle.textContent = totalVerificationItems === 0
        ? 'No rendered operational verification items'
        : coverage === 100 && outstandingReviewItems.length === 0
          ? 'Operational verification reviewed'
          : 'Operational verification in progress';
    }

    if (reviewBannerDescription) {
      reviewBannerDescription.textContent = totalVerificationItems === 0
        ? 'The selected comparison did not render verification checklist items for the supplied snapshots.'
        : coverage === 100 && outstandingReviewItems.length === 0
          ? 'All rendered operational verification items have a reviewed posture. Continue with handoff review if needed.'
          : 'High-significance operational drift still requires external validation before operational equivalence should be assumed.';
    }

    updateOutstandingVerificationList(outstandingReviewItems, totalVerificationItems);
    updateVerificationPosture(coverage, outstandingReviewItems, totalVerificationItems);

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


})();`;
}
