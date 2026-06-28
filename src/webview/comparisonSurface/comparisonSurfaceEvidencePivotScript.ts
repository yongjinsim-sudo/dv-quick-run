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

  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type !== 'auditEvidenceResult') {
      return;
    }

    const evidenceId = message.evidenceId;
    if (!evidenceId) {
      return;
    }

    const result = document.querySelector('[data-audit-result="' + evidenceId + '"]');
    if (!result) {
      return;
    }

    result.innerHTML = message.html || '<p>Audit evidence result was returned without renderable content.</p>';
  });




  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type !== 'dvafExportResult' && message.type !== 'dvimExportResult' && message.type !== 'dvceExportResult') {
      return;
    }

    const exportId = message.exportId;
    if (!exportId) {
      return;
    }

    const result = document.querySelector('[data-dvaf-export-result="' + exportId + '"]') || document.querySelector('[data-dvim-export-result="' + exportId + '"]') || document.querySelector('[data-dvce-export-result="' + exportId + '"]');
    if (!result) {
      return;
    }

    result.removeAttribute('hidden');
    result.classList.toggle('is-error', message.ok !== true);
    result.classList.toggle('is-success', message.ok === true);
    result.textContent = message.summary || (message.ok ? 'Reconstruction artifact exported.' : 'Export did not complete.');
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



  function resolveDvafExportButton(target) {
    if (!(target instanceof Element)) {
      return undefined;
    }

    return target.closest('[data-dvaf-export-candidate]');
  }

  function activateDvafExportButton(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const exportId = button.getAttribute('data-dvaf-export-id') || '';
    const candidateJson = button.getAttribute('data-dvaf-export-candidate') || '';
    const result = exportId ? document.querySelector('[data-dvaf-export-result="' + exportId + '"]') : undefined;

    if (result) {
      result.removeAttribute('hidden');
      result.classList.remove('is-error');
      result.classList.remove('is-success');
      result.textContent = 'Exporting source-side attribute definition to DVAF...';
    }

    vscode?.postMessage?.({
      type: 'dvafExportRequested',
      exportId,
      candidateJson
    });
  }


  function resolveDvimExportButton(target) {
    if (!(target instanceof Element)) {
      return undefined;
    }

    return target.closest('[data-dvim-export-candidate]');
  }

  function activateDvimExportButton(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const exportId = button.getAttribute('data-dvim-export-id') || '';
    const candidateJson = button.getAttribute('data-dvim-export-candidate') || '';
    const result = exportId ? document.querySelector('[data-dvim-export-result="' + exportId + '"]') : undefined;

    if (result) {
      result.removeAttribute('hidden');
      result.classList.remove('is-error');
      result.classList.remove('is-success');
      result.textContent = 'Exporting source-side identity participation intent to DVIM...';
    }

    vscode?.postMessage?.({
      type: 'dvimExportRequested',
      exportId,
      candidateJson
    });
  }



  function resolveDvceExportButton(target) {
    if (!(target instanceof Element)) {
      return undefined;
    }

    return target.closest('[data-dvce-export-candidate]');
  }

  function activateDvceExportButton(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const exportId = button.getAttribute('data-dvce-export-id') || '';
    const candidateJson = button.getAttribute('data-dvce-export-candidate') || '';
    const result = exportId ? document.querySelector('[data-dvce-export-result="' + exportId + '"]') : undefined;

    if (result) {
      result.removeAttribute('hidden');
      result.classList.remove('is-error');
      result.classList.remove('is-success');
      result.textContent = 'Exporting source-side choice reconstruction intent to DVCE...';
    }

    vscode?.postMessage?.({
      type: 'dvceExportRequested',
      exportId,
      candidateJson
    });
  }

  function resolveAuditButton(target) {
    if (!(target instanceof Element)) {
      return undefined;
    }

    return target.closest('[data-audit-check]');
  }

  function ensureAuditContext(button, evidenceId) {
    const item = button.closest('.dvqr-evidence-item');
    let context = item?.querySelector('[data-audit-context="' + evidenceId + '"]')
      ?? document.querySelector('[data-audit-context="' + evidenceId + '"]');

    if (context) {
      return context;
    }

    if (!item) {
      return undefined;
    }

    const fallback = document.createElement('div');
    fallback.className = 'dvqr-inline-audit-context';
    fallback.setAttribute('data-audit-context', evidenceId);
    fallback.setAttribute('hidden', '');
    fallback.innerHTML = '<strong>Audit evidence</strong><span>Audit lookup is explicit and interval-bounded. Audit evidence enriches this finding; it does not establish root cause.</span><div data-audit-result="' + evidenceId + '">Not queried yet.</div>';
    item.appendChild(fallback);
    return fallback;
  }

  function activateAuditButton(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const evidenceId = button.getAttribute('data-audit-check');
    if (!evidenceId) {
      return;
    }

    const context = ensureAuditContext(button, evidenceId);
    if (!context) {
      return;
    }

    const isHidden = context.hasAttribute('hidden');
    context.toggleAttribute('hidden', !isHidden);
    button.classList.toggle('is-active', isHidden);
    button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    button.textContent = isHidden ? 'Hide audit evidence ↑' : 'Check audit evidence ›';

    if (!isHidden) {
      return;
    }

    const evidenceItem = button.closest('.dvqr-evidence-item');
    const result = evidenceItem?.querySelector('[data-audit-result="' + evidenceId + '"]')
      ?? document.querySelector('[data-audit-result="' + evidenceId + '"]');

    if (result && result.textContent === 'Not queried yet.') {
      result.textContent = 'Checking audit evidence inside this snapshot-bounded interval...';
    }

    const comparisonTop = document.querySelector('#dvqr-comparison-top');
    vscode?.postMessage?.({
      type: 'auditEvidenceRequested',
      evidenceId,
      label: evidenceItem?.getAttribute('data-evidence-label') || '',
      value: evidenceItem?.getAttribute('data-evidence-value') || '',
      parentTitle: evidenceItem?.getAttribute('data-parent-title') || '',
      parentSummary: evidenceItem?.getAttribute('data-parent-summary') || '',
      parentProvider: evidenceItem?.getAttribute('data-parent-provider') || '',
      parentEvidence: evidenceItem?.getAttribute('data-parent-evidence') || '',
      entityLogicalName: comparisonTop?.getAttribute('data-entity-logical-name') || '',
      fromCapturedAtIso: comparisonTop?.getAttribute('data-source-captured-at') || '',
      toCapturedAtIso: comparisonTop?.getAttribute('data-target-captured-at') || ''
    });
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
    const dvafExportButton = resolveDvafExportButton(event.target);
    if (dvafExportButton) {
      activateDvafExportButton(dvafExportButton, event);
      return;
    }

    const dvimExportButton = resolveDvimExportButton(event.target);
    if (dvimExportButton) {
      activateDvimExportButton(dvimExportButton, event);
      return;
    }

    const dvceExportButton = resolveDvceExportButton(event.target);
    if (dvceExportButton) {
      activateDvceExportButton(dvceExportButton, event);
      return;
    }

    const auditButton = resolveAuditButton(event.target);
    if (auditButton) {
      activateAuditButton(auditButton, event);
      return;
    }

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
  const auditButtons = document.querySelectorAll('[data-audit-check]');
  auditButtons.forEach((button) => {
    button.addEventListener('click', (event) => activateAuditButton(button, event));
  });
  const dvafExportButtons = document.querySelectorAll('[data-dvaf-export-candidate]');
  dvafExportButtons.forEach((button) => {
    button.addEventListener('click', (event) => activateDvafExportButton(button, event));
  });
  const dvimExportButtons = document.querySelectorAll('[data-dvim-export-candidate]');
  dvimExportButtons.forEach((button) => {
    button.addEventListener('click', (event) => activateDvimExportButton(button, event));
  });
  const dvceExportButtons = document.querySelectorAll('[data-dvce-export-candidate]');
  dvceExportButtons.forEach((button) => {
    button.addEventListener('click', (event) => activateDvceExportButton(button, event));
  });
  emitEvidencePivotTrace('bindings.installed', { evidenceButtonCount: evidenceButtons.length, auditButtonCount: auditButtons.length, dvafExportButtonCount: dvafExportButtons.length, dvimExportButtonCount: dvimExportButtons.length, dvceExportButtonCount: dvceExportButtons.length });
`;
}
