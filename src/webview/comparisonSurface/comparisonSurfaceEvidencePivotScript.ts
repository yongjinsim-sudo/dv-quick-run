export function getComparisonSurfaceEvidencePivotScript(): string {
  return `
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
`;
}
