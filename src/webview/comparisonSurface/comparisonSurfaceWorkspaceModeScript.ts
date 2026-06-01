export function getComparisonSurfaceWorkspaceModeScript(): string {
  return `
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




`;
}
