export function getComparisonSurfaceReviewStateScript(): string {
  return `
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


  `;
}
