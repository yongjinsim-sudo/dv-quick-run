import type { CapabilityInfo, DvQuickRunHubViewModel, InvestigationPlaybook } from "../../commands/hub/dvQuickRunHubTypes.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items: readonly string[]): string {
  return `<ul class="dvqr-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderPlaybook(playbook: InvestigationPlaybook): string {
  const steps = playbook.flow.map((step) => {
    const command = step.commandId ? `<button class="dvqr-action-button" data-command="${escapeHtml(step.commandId)}">Start Guided Traversal</button><div class="dvqr-command">Command: ${escapeHtml(step.commandId)}</div>` : "";
    const surface = step.relatedSurface ? `<div class="dvqr-muted">Surface: ${escapeHtml(step.relatedSurface)}</div>` : "";
    return `<li><strong>${escapeHtml(step.label)}</strong><br />${escapeHtml(step.description)}${surface}${command}</li>`;
  }).join("");

  const safety = playbook.safetyNotes && playbook.safetyNotes.length > 0
    ? `<p class="dvqr-muted"><strong>Safety:</strong> ${playbook.safetyNotes.map(escapeHtml).join(" ")}</p>`
    : "";

  return `<article class="dvqr-card dvqr-playbook-card" id="playbook-${escapeHtml(playbook.id)}">
    <h3>${escapeHtml(playbook.title)}</h3>
    <p>${escapeHtml(playbook.summary)}</p>
    <p class="dvqr-muted"><strong>Use when:</strong></p>
    ${renderList(playbook.whenToUse)}
    <ol class="dvqr-flow">${steps}</ol>
    <div class="dvqr-meta">${playbook.relatedCapabilities.map((capability) => `<span class="dvqr-chip">${escapeHtml(capability)}</span>`).join("")}</div>
    ${safety}
  </article>`;
}


function renderInvestigationContinuation(model: DvQuickRunHubViewModel): string {
  const continuation = model.investigationContinuation;
  const items = continuation.items.length > 0
    ? `<dl class="dvqr-context-list">${continuation.items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("")}</dl>`
    : "";
  const actions = continuation.actions.length > 0
    ? `<div class="dvqr-continuation-actions"><h4>Available continuations</h4>${continuation.actions.map((action) => {
      const commandArgs = action.commandArgs && action.commandArgs.length > 0
        ? ` data-command-args="${escapeHtml(JSON.stringify(action.commandArgs))}"`
        : "";
      const actionButton = action.commandId
        ? `<button class="dvqr-action-button" data-command="${escapeHtml(action.commandId)}"${commandArgs}>${escapeHtml(action.actionLabel ?? "Continue")}</button>`
        : "";
      return `<article class="dvqr-continuation-action"><div class="dvqr-continuation-action-header"><strong>${escapeHtml(action.label)}</strong>${actionButton}</div><p>${escapeHtml(action.detail)}</p><span class="dvqr-chip">${escapeHtml(action.surface)}</span></article>`;
    }).join("")}</div>`
    : "";
  const timeline = continuation.timeline.length > 0
    ? `<div class="dvqr-investigation-timeline"><h4>Investigation timeline</h4><ol>${continuation.timeline.map((step) => `<li><strong>${escapeHtml(step.label)}</strong><p>${escapeHtml(step.detail)}</p></li>`).join("")}</ol></div>`
    : "";
  const modifier = continuation.hasContext ? "" : " dvqr-card-muted";
  const trust = continuation.trustState
    ? `<div class="dvqr-trust-state dvqr-trust-state-${escapeHtml(continuation.trustState.kind)}"><strong>${escapeHtml(continuation.trustState.label)}</strong><span>${escapeHtml(continuation.trustState.detail)}</span></div>`
    : "";

  return `<section id="current-context">
    <h2>Current Context</h2>
    <div class="dvqr-card dvqr-context-card${modifier}">
      <h3>${escapeHtml(continuation.title)}</h3>
      <p>${escapeHtml(continuation.summary)}</p>
      ${trust}
      ${items}
      ${timeline}
      ${actions}
      <p class="dvqr-muted">Context-aware actions appear only when the required query, result, runtime, or record context exists.</p>
    </div>
  </section>`;
}


function renderEvidenceWorkspaceLauncher(model: DvQuickRunHubViewModel): string {
  const workspace = model.evidenceWorkspace;
  const statusTitle = workspace.available ? "Evidence Workspace Ready" : "Evidence Workspace not configured";
  const statusDetail = workspace.available
    ? `Workspace${workspace.workspaceName ? `: ${escapeHtml(workspace.workspaceName)}` : " is available"}`
    : escapeHtml(workspace.reason ?? "Create a Git-friendly workspace for DVQR investigation artifacts.");
  const createAction = workspace.available
    ? ""
    : `<button class="dvqr-action-button" data-command="dvQuickRun.createEvidenceWorkspace">Create Evidence Workspace</button>`;
  const folderActions = workspace.available
    ? `<button class="dvqr-action-button" data-command="dvQuickRun.openSnapshotWorkspaceFolder">Open Snapshot Folder</button>
        <button class="dvqr-action-button" data-command="dvQuickRun.openComparisonWorkspaceFolder">Open Comparisons Folder</button>
        <button class="dvqr-action-button" data-command="dvQuickRun.openReportWorkspaceFolder">Open Reports Folder</button>`
    : "";

  return `<section id="evidence-workspace">
    <h2>Evidence Workspace</h2>
    <p class="dvqr-section-note">Capture, organise, search, compare, audit-enrich, and preserve investigation evidence across environments and time.</p>
    <div class="dvqr-card dvqr-evidence-workspace-card">
      <div>
        <h3>${statusTitle}</h3>
        <p>${statusDetail}</p>
        <p>Use Evidence Workspace and Snapshot Library to capture investigation evidence, reconstruct same-environment timelines, compare environments, and generate bounded reconstruction artifacts for DVAF, DVIM, DVCE, and DVEVM.</p>
        <div class="dvqr-meta">
          <span class="dvqr-chip">.dvforgelab/dvqr/snapshots</span>
          <span class="dvqr-chip">.dvforgelab/dvqr/reports</span>
          <span class="dvqr-chip">.dvforgelab/dvaf/exports • .dvforgelab/dvim/exports • .dvforgelab/dvce/exports • .dvforgelab/dvevm/exports</span>
          <span class="dvqr-chip">Timeline reconstruction</span>
          <span class="dvqr-chip">Reconstruction artifacts</span>
        </div>
      </div>
      <div class="dvqr-evidence-actions">
        <button class="dvqr-action-button" data-command="dvQuickRun.openSnapshotLibrary">Open Snapshot Library</button>
        ${createAction}
        <button class="dvqr-action-button" data-command="dvQuickRun.captureOperationalProfileSnapshot">Capture Snapshot</button>
        ${folderActions}
      </div>
    </div>
  </section>`;
}

function renderAccessContextLauncher(): string {
  return `<section id="access-context">
    <h2>Access Context</h2>
    <p class="dvqr-section-note">Investigate bounded operational identity participation for users, application users, teams, roles, and business units without simulating effective access.</p>
    <div class="dvqr-card dvqr-access-context-card">
      <div>
        <h3>Investigate Access Context</h3>
        <p>Search for a user, application user, team, role, or business unit and open the same evidence-backed Access Context surface used by Result Viewer row actions.</p>
        <div class="dvqr-meta">
          <span class="dvqr-chip">User</span>
          <span class="dvqr-chip">Application User</span>
          <span class="dvqr-chip">Team</span>
          <span class="dvqr-chip">Role</span>
          <span class="dvqr-chip">Business Unit</span>
        </div>
      </div>
      <button class="dvqr-action-button" data-command="dvQuickRun.investigateAccessContext">Investigate Access Context</button>
    </div>
  </section>`;
}

function groupCapabilities(capabilities: readonly CapabilityInfo[]): Map<string, CapabilityInfo[]> {
  const grouped = new Map<string, CapabilityInfo[]>();

  capabilities.forEach((capability) => {
    const items = grouped.get(capability.group) ?? [];
    items.push(capability);
    grouped.set(capability.group, items);
  });

  return grouped;
}

function renderCapability(capability: CapabilityInfo): string {
  const since = capability.sinceVersion
    ? `<span class="dvqr-status">${capability.status === "future" ? "Planned" : "Since"} ${escapeHtml(capability.sinceVersion)}</span>`
    : "";
  const canLaunch = capability.commandId && capability.contextState?.launchable !== false;
  const action = canLaunch ? `<button class="dvqr-action-button" data-command="${escapeHtml(capability.commandId as string)}">${escapeHtml(capability.actionLabel ?? "Launch")}</button>` : "";
  const state = capability.contextState ? `<span class="dvqr-context-state dvqr-context-state-${escapeHtml(capability.contextState.kind)}">${escapeHtml(capability.contextState.label)}</span>` : "";
  const contextHint = capability.contextState ? `<p class="dvqr-context-hint">${escapeHtml(capability.contextState.detail)}</p>` : "";
  const howToUse = capability.howToUse && capability.howToUse.length > 0
    ? `<div class="dvqr-how-to"><strong>How to use:</strong><ol>${capability.howToUse.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div>`
    : "";

  return `<article class="dvqr-card" id="capability-${escapeHtml(capability.id)}">
    <h3>${escapeHtml(capability.title)}</h3>
    <p>${escapeHtml(capability.summary)}</p>
    <p class="dvqr-muted"><strong>Operational use:</strong> ${escapeHtml(capability.operationalUseCase)}</p>
    ${howToUse}
    ${contextHint}
    <div class="dvqr-meta"><span class="dvqr-status">${escapeHtml(capability.status)}</span>${since}${state}${action}</div>
  </article>`;
}


function renderDvForgeLabEcosystem(): string {
  return `<section id="dvforgelab-ecosystem">
    <h2>DV ForgeLab Ecosystem</h2>
    <p class="dvqr-section-note">DV Quick Run investigates. DV ForgeLab utilities reconstruct. Investigation and reconstruction remain separate concerns.</p>
    <div class="dvqr-direction-grid">
      <article class="dvqr-card"><h3>DV Quick Run</h3><p>Investigate operational drift, runtime behaviour, identity participation, and cross-environment evidence.</p></article>
      <article class="dvqr-card"><h3>DV Bulk Upsert Runner</h3><p>Bulk import and upsert Dataverse records using reusable data packages.</p></article>
      <article class="dvqr-card"><h3>DV Choice Editor</h3><p>Manage Dataverse global and local choices with confidence.</p></article>
      <article class="dvqr-card"><h3>DV Environment Variable Manager</h3><p>Review and manage environment configuration values.</p></article>
      <article class="dvqr-card"><h3>DV Identity Manager</h3><p>Investigate and administer application users and identities.</p></article>
      <article class="dvqr-card"><h3>DV Attribute Factory</h3><p>Accelerate Dataverse attribute creation and metadata construction.</p></article>
    </div>
    <div class="dvqr-card dvqr-ecosystem-handoff">
      <h3>DV ForgeLab reconstruction handoffs</h3>
      <p>DV Quick Run investigates and exports bounded reconstruction artifacts for focused companion utilities. DVAF reconstructs attributes, DVIM reconstructs identity participation, DVCE reconstructs choice metadata, and DVEVM reconstructs environment variable current values through preview-first workflows.</p>
      <div class="dvqr-meta"><span class="dvqr-chip">DVQR investigates</span><span class="dvqr-chip">DVAF · DVIM · DVCE · DVEVM reconstruct</span><span class="dvqr-chip">Preview-first</span></div>
      <div class="dvqr-continuation-actions">
        <button class="dvqr-action-button" data-command="dvQuickRun.openDvForgeLabProducts">View DV ForgeLab Utilities</button>
        <button class="dvqr-action-button" data-command="dvQuickRun.openDvQuickRunPricing">Start 14-day Pro Trial</button>
        <button class="dvqr-action-button" data-command="dvQuickRun.openDvForgeLabStore">Open Store</button>
        <button class="dvqr-action-button" data-command="dvQuickRun.openDvQuickRunWebsite">Open dvquickrun.com</button>
        <button class="dvqr-action-button" data-command="dvQuickRun.openDvForgeLabWebsite">Open dvforgelab.com</button>
      </div>
    </div>
  </section>`;
}

export function getDvQuickRunHubMarkup(model: DvQuickRunHubViewModel, iconUri?: string): string {
  const capabilityGroups = Array.from(groupCapabilities(model.capabilities).entries());
  const heroIcon = iconUri
    ? `<div class="dvqr-hero-icon-frame" aria-hidden="true"><img class="dvqr-hero-icon" src="${escapeHtml(iconUri)}" alt="" /></div>`
    : "";
  const supporterBadges = model.supporterBadges.length > 0
    ? `<div class="dvqr-supporter-badges">${model.supporterBadges.map((badge) => `<span class="dvqr-supporter-badge">${escapeHtml(badge)}</span>`).join("")}</div>`
    : "";

  return `<main class="dvqr-hub">
    <section class="dvqr-hero">
      <div class="dvqr-hero-copy">
        <div class="dvqr-eyebrow">Operational Investigation Fluency</div>
        <h1>${escapeHtml(model.title)}</h1>
        <p class="dvqr-subtitle">${escapeHtml(model.subtitle)}</p>
        ${supporterBadges}
        <nav class="dvqr-nav" aria-label="Hub sections">
          ${model.sectionLinks.map((link) => `<a class="dvqr-chip" href="#${escapeHtml(link.anchor)}">${escapeHtml(link.label)}</a>`).join("")}
        </nav>
      </div>
      ${heroIcon}
    </section>

    ${renderInvestigationContinuation(model)}

    ${renderEvidenceWorkspaceLauncher(model)}

    ${renderAccessContextLauncher()}

    <section id="playbooks">
      <h2>Investigation Playbooks</h2>
      <p class="dvqr-section-note">Workflow-oriented guides for staying in context while investigating Dataverse and Power Platform behaviour.</p>
      <div class="dvqr-playbook-grid">${model.playbooks.map(renderPlaybook).join("")}</div>
    </section>

    <section id="capabilities">
      <h2>Capabilities</h2>
      <p class="dvqr-section-note">Current capabilities grouped by the operational problem they help solve.</p>
      ${capabilityGroups.map(([group, capabilities]) => `<div class="dvqr-group"><h3>${escapeHtml(group)}</h3><div class="dvqr-capability-grid">${capabilities.map(renderCapability).join("")}</div></div>`).join("")}
    </section>

    ${renderDvForgeLabEcosystem()}

    <section id="whats-new">
      <h2>What's New</h2>
      <div class="dvqr-card">${renderList(model.whatsNew)}</div>
    </section>

    <section id="direction">
      <h2>Product Direction</h2>
      <p class="dvqr-section-note">High-level direction only. This avoids promising dates or turning future ideas into current behaviour.</p>
      <div class="dvqr-direction-grid">${model.productDirection.map((item) => `<article class="dvqr-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></article>`).join("")}</div>
    </section>

    <section id="philosophy">
      <h2>Why DV Quick Run Works This Way</h2>
      <div class="dvqr-card">${renderList(model.philosophy)}</div>
    </section>
  </main>`;
}
