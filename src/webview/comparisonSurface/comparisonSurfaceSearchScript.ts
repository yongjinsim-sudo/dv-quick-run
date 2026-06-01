export function getComparisonSurfaceSearchScript(): string {
  return `
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
`;
}
