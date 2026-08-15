import type { PromptLibraryViewModel } from "../../commands/promptLibrary/promptLibraryViewModel.js";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

export function getPromptLibraryMarkup(model: PromptLibraryViewModel): string {
  const categoryButtons = model.categories.map((category) =>
    `<button class="category-button" data-category="${escapeHtml(category.id)}"><span>${escapeHtml(category.title)}</span><strong>${category.promptCount}</strong><small>${escapeHtml(category.description)}</small></button>`
  ).join("");


  const quickStartPrompts = model.quickStartPromptIds
    .map((id) => model.prompts.find((prompt) => prompt.id === id))
    .filter((prompt): prompt is NonNullable<typeof prompt> => Boolean(prompt));
  const quickStarts = quickStartPrompts.map((prompt) =>
    `<button class="quick-start-button" data-prompt-id="${escapeHtml(prompt.id)}"><span class="quick-start-label">I want to…</span><strong>${escapeHtml(prompt.title)}</strong><small>${escapeHtml(prompt.categoryTitle)} · ${prompt.tier === "free" ? "Free" : "Pro"}</small></button>`
  ).join("");

  const cards = model.prompts.map((prompt) => {
    const locked = prompt.available ? "" : " locked";
    const searchText = escapeHtml([prompt.title, prompt.description, prompt.tags.join(" "), prompt.categoryTitle, prompt.journeyStage].join(" ").toLowerCase());
    return `<button class="prompt-card${locked}" data-prompt-id="${escapeHtml(prompt.id)}" data-category="${escapeHtml(prompt.categoryId)}" data-tier="${prompt.tier}" data-search="${searchText}">
      <div class="prompt-card-top"><span class="stage-badge">${escapeHtml(prompt.journeyStage)}</span><span class="tier-badge tier-${prompt.tier}">${prompt.tier === "free" ? "Free" : "Pro"}</span></div>
      <strong>${escapeHtml(prompt.title)}</strong>
      <span>${escapeHtml(prompt.description)}</span>
      <small>${escapeHtml(prompt.categoryTitle)}</small>
    </button>`;
  }).join("");

  return `<main class="shell">
    <header class="hero">
      <div>
        <div class="eyebrow">v0.15.9 · Discoverability & Guided Investigation</div>
        <h1>${escapeHtml(model.title)}</h1>
        <p>${escapeHtml(model.subtitle)}</p>
      </div>
      <div class="hero-stats">
        <span><strong>${model.promptCount}</strong> guided prompts</span>
        <span><strong>${model.freePromptCount}</strong> Free</span>
        <span><strong>${model.proPromptCount}</strong> Pro</span>
        <span>Plan: <strong>${model.currentPlan === "pro" ? "Pro" : "Free"}</strong></span>
      </div>
    </header>

    <section class="quick-starts" aria-label="Quick starts">
      <div class="quick-start-heading"><div><div class="eyebrow">Recommended starting points</div><h2>What do you want to do?</h2></div><p>Start with a common outcome, or search the full catalogue below.</p></div>
      <div class="quick-start-grid">${quickStarts}</div>
    </section>

    <section class="toolbar" aria-label="Prompt filters">
      <label class="search-box"><span>Search</span><input id="prompt-search" type="search" placeholder="Try relationship, score, Custom API, investigation…" /></label>
      <div class="tier-filters" role="group" aria-label="Tier filter">
        <button class="filter-chip active" data-tier-filter="all">All</button>
        <button class="filter-chip" data-tier-filter="free">Free</button>
        <button class="filter-chip" data-tier-filter="pro">Pro</button>
      </div>
      <button id="mcp-status" class="secondary-button">MCP Status</button>
    </section>

    <section class="category-strip" aria-label="Prompt categories">
      <button class="category-button active" data-category="all"><span>All prompts</span><strong>${model.promptCount}</strong><small>Browse the complete guided catalogue.</small></button>
      ${categoryButtons}
    </section>

    <div class="workspace">
      <section class="catalogue-pane">
        <div class="pane-heading"><div><h2>Prompt catalogue</h2><p id="result-count">${model.promptCount} prompts</p></div></div>
        <div id="prompt-grid" class="prompt-grid">${cards}</div>
        <div id="empty-state" class="empty-state" hidden>No prompts match these filters.</div>
      </section>

      <aside class="builder-pane" id="builder-pane">
        <div class="builder-empty" id="builder-empty">
          <div class="builder-icon">✦</div>
          <h2>Choose a prompt</h2>
          <p>Select a guided prompt to fill its parameters, preview the exact natural-language request, and follow the suggested next step.</p>
        </div>
        <div id="builder-content" hidden>
          <div class="builder-header"><div><div id="builder-category" class="eyebrow"></div><h2 id="builder-title"></h2><p id="builder-description"></p><details class="capability-details"><summary>DVQR capability</summary><code id="builder-capability"></code></details></div><span id="builder-tier" class="tier-badge"></span></div>
          <div id="locked-banner" class="locked-banner" hidden><strong>Pro journey</strong><span>This prompt is visible so you can understand the journey, but its underlying MCP capability requires Pro.</span><button id="open-pricing" class="secondary-button">View Pro</button></div>
          <div id="parameter-form" class="parameter-form"></div>
          <div class="preview-heading"><h3>Rendered prompt</h3><span id="preview-status" class="preview-status"></span></div>
          <pre id="prompt-preview" class="prompt-preview"></pre>
          <div class="builder-actions"><button id="copy-prompt" class="primary-button" disabled>Copy Prompt</button><span id="copy-status" role="status" aria-live="polite"></span></div>
          <div id="journey-section" class="journey-section" hidden><h3>Suggested next prompts</h3><div id="follow-up-list" class="follow-up-list"></div></div>
        </div>
      </aside>
    </div>
  </main>`;
}
