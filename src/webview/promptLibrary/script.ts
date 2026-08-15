import type { PromptLibraryViewModel } from "../../commands/promptLibrary/promptLibraryViewModel.js";

function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function getPromptLibraryScript(model: PromptLibraryViewModel): string {
  const serialized = serializeForScript(model);
  return `(() => {
  const vscode = acquireVsCodeApi();
  const model = ${serialized};
  const promptsById = new Map(model.prompts.map((prompt) => [prompt.id, prompt]));
  let selectedPromptId = '';
  let activeCategory = 'all';
  let activeTier = 'all';
  let currentRenderedText = '';

  const searchInput = document.getElementById('prompt-search');
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const cards = Array.from(document.querySelectorAll('.prompt-card'));
  const quickStartButtons = Array.from(document.querySelectorAll('.quick-start-button'));

  function applyFilters() {
    const query = String(searchInput?.value ?? '').trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const category = card.getAttribute('data-category') ?? '';
      const tier = card.getAttribute('data-tier') ?? '';
      const search = card.getAttribute('data-search') ?? '';
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesTier = activeTier === 'all' || tier === activeTier;
      const matchesQuery = !query || search.includes(query);
      const show = matchesCategory && matchesTier && matchesQuery;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (resultCount) resultCount.textContent = visible + (visible === 1 ? ' prompt' : ' prompts');
    if (emptyState) emptyState.hidden = visible !== 0;
  }

  searchInput?.addEventListener('input', applyFilters);
  document.querySelectorAll('[data-category]').forEach((button) => {
    if (!button.classList.contains('category-button')) return;
    button.addEventListener('click', () => {
      activeCategory = button.getAttribute('data-category') ?? 'all';
      document.querySelectorAll('.category-button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      applyFilters();
    });
  });

  document.querySelectorAll('[data-tier-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTier = button.getAttribute('data-tier-filter') ?? 'all';
      document.querySelectorAll('[data-tier-filter]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      applyFilters();
    });
  });

  function collectValues(prompt) {
    const values = {};
    prompt.parameters.forEach((parameter) => {
      const input = document.querySelector('[data-parameter-id="' + CSS.escape(parameter.id) + '"]');
      values[parameter.id] = input instanceof HTMLInputElement ? input.value : '';
    });
    return values;
  }

  function requestRender() {
    const prompt = promptsById.get(selectedPromptId);
    if (!prompt) return;
    vscode.postMessage({ type: 'renderPrompt', promptId: prompt.id, values: collectValues(prompt) });
  }

  function selectPrompt(promptId) {
    const prompt = promptsById.get(promptId);
    if (!prompt) return;
    selectedPromptId = promptId;
    currentRenderedText = '';
    cards.forEach((card) => card.classList.toggle('selected', card.getAttribute('data-prompt-id') === promptId));

    const empty = document.getElementById('builder-empty');
    const content = document.getElementById('builder-content');
    if (empty) empty.hidden = true;
    if (content) content.hidden = false;

    const title = document.getElementById('builder-title');
    const description = document.getElementById('builder-description');
    const category = document.getElementById('builder-category');
    const tier = document.getElementById('builder-tier');
    const capability = document.getElementById('builder-capability');
    if (title) title.textContent = prompt.title;
    if (description) description.textContent = prompt.description;
    if (category) category.textContent = prompt.categoryTitle + ' · ' + prompt.journeyStage;
    if (capability) capability.textContent = prompt.capabilityTool;
    if (tier) {
      tier.textContent = prompt.tier === 'free' ? 'Free' : 'Pro';
      tier.className = 'tier-badge tier-' + prompt.tier;
    }

    const lockedBanner = document.getElementById('locked-banner');
    if (lockedBanner) lockedBanner.hidden = prompt.available;

    const form = document.getElementById('parameter-form');
    if (form) {
      form.innerHTML = '';
      prompt.parameters.forEach((parameter) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'parameter-field';
        const label = document.createElement('label');
        label.textContent = parameter.label + (parameter.required ? ' *' : '');
        if (parameter.required) label.classList.add('required');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = parameter.placeholder;
        input.setAttribute('data-parameter-id', parameter.id);
        input.addEventListener('input', requestRender);
        const help = document.createElement('small');
        help.textContent = parameter.description + (parameter.example ? ' Example: ' + parameter.example : '');
        wrapper.append(label, input, help);
        form.appendChild(wrapper);
      });
    }

    const followSection = document.getElementById('journey-section');
    const followList = document.getElementById('follow-up-list');
    if (followList) {
      followList.innerHTML = '';
      prompt.followUpPromptIds.map((id) => promptsById.get(id)).filter(Boolean).forEach((follow) => {
        const button = document.createElement('button');
        button.className = 'follow-up-button';
        button.textContent = follow.title + ' · ' + (follow.tier === 'free' ? 'Free' : 'Pro');
        button.addEventListener('click', () => selectPrompt(follow.id));
        followList.appendChild(button);
      });
    }
    if (followSection) followSection.hidden = prompt.followUpPromptIds.length === 0;

    requestRender();
  }

  cards.forEach((card) => card.addEventListener('click', () => selectPrompt(card.getAttribute('data-prompt-id') ?? '')));
  quickStartButtons.forEach((button) => button.addEventListener('click', () => selectPrompt(button.getAttribute('data-prompt-id') ?? '')));

  document.getElementById('copy-prompt')?.addEventListener('click', () => {
    if (currentRenderedText) vscode.postMessage({ type: 'copyPrompt', text: currentRenderedText });
  });
  document.getElementById('open-pricing')?.addEventListener('click', () => vscode.postMessage({ type: 'openPricing' }));
  document.getElementById('mcp-status')?.addEventListener('click', () => vscode.postMessage({ type: 'showMcpStatus' }));

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message?.type === 'promptRendered' && message.rendered?.promptId === selectedPromptId) {
      const rendered = message.rendered;
      const selectedPrompt = promptsById.get(selectedPromptId);
      currentRenderedText = rendered.text ?? '';
      const preview = document.getElementById('prompt-preview');
      const status = document.getElementById('preview-status');
      const copy = document.getElementById('copy-prompt');
      if (preview) preview.textContent = currentRenderedText;
      if (status) status.textContent = !selectedPrompt?.available ? 'Requires Pro' : (rendered.isReady ? 'Ready to copy' : 'Fill: ' + rendered.missingRequiredParameters.join(', '));
      if (copy instanceof HTMLButtonElement) copy.disabled = !rendered.isReady || !selectedPrompt?.available;
    }
    if (message?.type === 'promptCopied') {
      const status = document.getElementById('copy-status');
      if (status) {
        status.textContent = 'Copied to clipboard.';
        window.setTimeout(() => { status.textContent = ''; }, 1500);
      }
    }
  });

  applyFilters();
})();`;
}
