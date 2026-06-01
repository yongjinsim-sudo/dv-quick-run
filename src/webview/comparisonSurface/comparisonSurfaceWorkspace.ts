import { escapeHtml } from "./comparisonSurfacePrimitives.js";

export interface InvestigationSessionRenderModel {
  readonly initialVerificationPosture: string;
  readonly initialVerificationPostureClass: string;
  readonly initialOutstandingVerificationItems: string;
}

export function renderInvestigationWorkspace(): string {
  return `<section class="dvqr-card dvqr-investigation-mode-surface" id="dvqr-investigation-workspace">
      <div class="dvqr-section-heading-row">
        <div>
          <h2>Investigation Workspace</h2>
          <p class="dvqr-muted">Switch workspace modes to focus investigation synthesis, detailed findings, verification tasks, or handoff readiness without losing the underlying comparison evidence.</p>
        </div>
      </div>

      <div class="dvqr-investigation-mode-tabs" role="tablist" aria-label="Investigation workspace modes">
        <button type="button" class="dvqr-investigation-mode-tab dvqr-investigation-mode-tab-active" data-workspace-mode="investigation" aria-pressed="true">
          <strong>Investigation</strong>
          <span>Operational storyline, continuity, and active investigation review.</span>
        </button>

        <button type="button" class="dvqr-investigation-mode-tab" data-workspace-mode="findings" aria-pressed="false">
          <strong>Findings</strong>
          <span>Provider drift evidence, runtime participation, and operational density.</span>
        </button>

        <button type="button" class="dvqr-investigation-mode-tab" data-workspace-mode="verification" aria-pressed="false">
          <strong>Verification</strong>
          <span>External validation, unresolved operational review items, and verification posture.</span>
        </button>

        <button type="button" class="dvqr-investigation-mode-tab" data-workspace-mode="handoff" aria-pressed="false">
          <strong>Handoff</strong>
          <span>Operational review packaging, unresolved drift summary, and investigation transfer context.</span>
        </button>
      </div>

      <div class="dvqr-mode-content-summary" aria-live="polite">
        <strong data-workspace-mode-summary-title>Investigation view active</strong>
        <span data-workspace-mode-summary-copy>Showing storyline, session continuity, top operational signals, and investigation continuations. Switch to Findings for the full diff evidence browser.</span>
      </div>

      <div class="dvqr-workspace-state-strip" aria-live="polite">
        <div>
          <span class="dvqr-workspace-state-label">Active mode</span>
          <strong data-workspace-active-label>Investigation</strong>
        </div>
        <div>
          <span class="dvqr-workspace-state-label">Workspace focus</span>
          <span data-workspace-active-description>Storyline, continuity, current posture, and investigation progression.</span>
        </div>
        <div>
          <span class="dvqr-workspace-state-label">Mode behaviour</span>
          <span>Mode-focused workspace view. Use Findings to inspect provider drift evidence.</span>
        </div>
      </div>
    </section>`;
}

export function renderInvestigationObservationBriefing(): string {
  return `<section class="dvqr-card dvqr-investigation-observation-briefing dvqr-workspace-mode-section" id="dvqr-investigation-observation-briefing" data-workspace-section="investigation">
      <div class="dvqr-section-heading-row">
        <div>
          <h2>Investigation Briefing</h2>
          <p class="dvqr-muted">Observation-first summary of what DVQR detected before moving into detailed findings or external verification.</p>
        </div>
      </div>

      <div class="dvqr-observation-briefing-grid">
        <article class="dvqr-observation-briefing-card dvqr-observation-briefing-card-primary">
          <span class="dvqr-observation-briefing-label">Observed comparison pattern</span>
          <strong>Multiple operational drift surfaces were detected</strong>
          <p>DVQR observed differences across runtime behaviour, workflow / orchestration, solution participation, operational density, and identity participation. Treat this as investigation orientation, not RCA certainty.</p>
        </article>

        <article class="dvqr-observation-briefing-card">
          <span class="dvqr-observation-briefing-label">Strongest review cue</span>
          <strong>Runtime and orchestration differences need attention first</strong>
          <p>Review high-significance plugin/runtime changes and workflow participation before treating the compared environments as operationally equivalent.</p>
        </article>

        <article class="dvqr-observation-briefing-card">
          <span class="dvqr-observation-briefing-label">Human verification boundary</span>
          <strong>External validation remains required</strong>
          <p>Use Findings to inspect evidence, Verification to track external validation prompts, and Handoff to package unresolved observations for another reviewer or team.</p>
        </article>
      </div>
    </section>`;
}

export function renderInvestigationSession(model: InvestigationSessionRenderModel): string {
  return `<section class="dvqr-card dvqr-investigation-session dvqr-workspace-mode-section" id="dvqr-investigation-session" data-workspace-section="investigation">
      <div class="dvqr-section-heading-row">
        <div>
          <h2>Investigation Session</h2>
          <p class="dvqr-muted">Operational investigation continuity for this comparison workspace. Investigation guidance remains evidence-backed and externally verifiable.</p>
        </div>
      </div>

      <div class="dvqr-investigation-session-grid">
        <article class="dvqr-investigation-session-panel">
          <div class="dvqr-investigation-session-panel-label">Session continuity</div>
          <div class="dvqr-baseline-session-note" data-baseline-session-note>
            <strong>Baseline boundary pending</strong>
            <span>Export the pre-investigation baseline before marking evidence reviewed so later handoff state can be compared against the original observed diff.</span>
          </div>

          <div class="dvqr-investigation-metric-grid">
            <div class="dvqr-investigation-metric">
              <div class="dvqr-investigation-metric-value" data-reviewed-surface-progress>0 / 0</div>
              <div class="dvqr-investigation-metric-label">Reviewed drift surfaces</div>
            </div>

            <div class="dvqr-investigation-metric">
              <div class="dvqr-investigation-metric-value" data-verification-coverage>0%</div>
              <div class="dvqr-investigation-metric-label">Operational verification coverage</div>
            </div>

            <div class="dvqr-investigation-metric">
              <div class="dvqr-investigation-metric-value dvqr-investigation-alert-value" data-outstanding-high-count>0</div>
              <div class="dvqr-investigation-metric-label">Outstanding high-significance signals</div>
            </div>
          </div>

          <div class="dvqr-investigation-status-row">
            <span class="dvqr-investigation-status-pill">Snapshot trust: Verified</span>
            <span class="dvqr-investigation-status-pill${model.initialVerificationPostureClass}" data-verification-posture-pill>${escapeHtml(model.initialVerificationPosture)}</span>
            <span class="dvqr-investigation-status-pill">Replay source: Cross-environment comparison</span>
          </div>
        </article>

        <article class="dvqr-investigation-session-panel">
          <div class="dvqr-investigation-session-panel-label">Outstanding operational verification</div>

          <ul class="dvqr-outstanding-verification-list" data-outstanding-verification-list>
            ${model.initialOutstandingVerificationItems}
          </ul>

          <div class="dvqr-investigation-notes-placeholder" data-review-notes-panel>
            <strong>Operational review notes</strong>
            <span data-review-notes-summary>No reviewer notes captured in this investigation session.</span>
          </div>
        </article>
      </div>
    </section>`;
}

export function renderInvestigationContinuations(): string {
  return `<section class="dvqr-card dvqr-investigation-continuations dvqr-workspace-mode-section" id="dvqr-investigation-continuations" data-workspace-section="investigation verification">
      <div class="dvqr-section-heading-row">
        <div>
          
<h2>Investigation Continuations</h2>

      
      <div class="dvqr-investigation-phase-strip">
        <div class="dvqr-investigation-phase-step dvqr-investigation-phase-step-complete">
          <span class="dvqr-investigation-phase-index">1</span>
          <div class="dvqr-investigation-phase-copy">
            <strong>Observed drift</strong>
            <span>Comparison evidence collected</span>
          </div>
        </div>

        <div class="dvqr-investigation-phase-connector"></div>

        <div class="dvqr-investigation-phase-step dvqr-investigation-phase-step-active">
          <span class="dvqr-investigation-phase-index">2</span>
          <div class="dvqr-investigation-phase-copy">
            <strong>Operational verification</strong>
            <span>External validation in progress</span>
          </div>
        </div>

        <div class="dvqr-investigation-phase-connector"></div>

        <div class="dvqr-investigation-phase-step">
          <span class="dvqr-investigation-phase-index">3</span>
          <div class="dvqr-investigation-phase-copy">
            <strong>Operational conclusion</strong>
            <span>Awaiting reviewer confirmation</span>
          </div>
        </div>
      </div>

<div class="dvqr-investigation-review-banner">
        <div class="dvqr-investigation-review-banner-state">
          <strong data-verification-banner-title>No rendered operational verification items</strong>
          <span data-verification-banner-description>The selected comparison did not render verification checklist items for the supplied snapshots.</span>
        </div>

        <div class="dvqr-investigation-review-banner-progress">
          <div class="dvqr-investigation-review-progress-label">Verification completion</div>
          <div class="dvqr-investigation-review-progress-track">
            <div class="dvqr-investigation-review-progress-fill" data-verification-progress-fill style="width:0%"></div>
          </div>
          <div class="dvqr-investigation-review-progress-caption" data-verification-progress-caption>0 of 0 operational verification items reviewed in this session</div>
        </div>
      </div>


          <div class="dvqr-investigation-session-summary">
            <div class="dvqr-investigation-session-card">
              <div class="dvqr-investigation-session-value" data-reviewed-count>0</div>
              <div class="dvqr-investigation-session-label">Reviewed externally</div>
            </div>

            <div class="dvqr-investigation-session-card">
              <div class="dvqr-investigation-session-value" data-outstanding-count>6</div>
              <div class="dvqr-investigation-session-label">Outstanding verification items</div>
            </div>
          </div>
          <p class="dvqr-muted">Continue investigation directly from evidence-backed operational drift signals. These continuations preserve investigation locality and comparison context.</p>
        </div>
      </div>

      <div class="dvqr-continuation-grid">
        <article class="dvqr-continuation-card dvqr-reviewable-surface" data-review-surface-id="runtime-continuation">
          <div class="dvqr-continuation-label">Runtime continuation</div>
          <h3>Plugin runtime investigation</h3>
          <p>Continue reviewing execution ordering, stage placement, filtering attributes, and runtime participation context.</p>
          <div class="dvqr-continuation-actions">
            <a class="dvqr-inline-investigation-action" href="#plugin-step-runtime-behaviour-drift" data-continuation-target="plugin-runtime">Inspect plugin step drift</a>
            <a class="dvqr-inline-investigation-action" href="#plugin-step-runtime-behaviour-drift" data-continuation-target="execution-pipeline">Review execution pipeline</a>
          </div>

          <div class="dvqr-review-state-row">
            <button type="button" class="dvqr-review-toggle" data-review-toggle>Mark reviewed</button>
          </div>
        </article>

        <article class="dvqr-continuation-card dvqr-reviewable-surface" data-review-surface-id="orchestration-continuation">
          <div class="dvqr-continuation-label">Orchestration continuation</div>
          <h3>Workflow / automation investigation</h3>
          <p>Continue reviewing workflow participation, activation changes, orchestration topology, and automation alignment.</p>
          <div class="dvqr-continuation-actions">
            <a class="dvqr-inline-investigation-action" href="#workflow-automation-participation-drift" data-continuation-target="workflow">Inspect workflow participation</a>
            <a class="dvqr-inline-investigation-action" href="#workflow-automation-participation-drift" data-continuation-target="orchestration-evidence">Review orchestration evidence</a>
          </div>

          <div class="dvqr-review-state-row">
            <button type="button" class="dvqr-review-toggle" data-review-toggle>Mark reviewed</button>
          </div>
        </article>

        <article class="dvqr-continuation-card dvqr-reviewable-surface" data-review-surface-id="handoff-continuation">
          <div class="dvqr-continuation-label">Operational handoff</div>
          <h3>Verification-oriented continuation</h3>
          <p>Convert representative evidence into externally verifiable operational review tasks before corrective action is considered.</p>
          <div class="dvqr-continuation-actions">
            <a class="dvqr-inline-investigation-action" href="#dvqr-verification-checklist" data-continuation-target="verification-checklist">Open verification checklist</a>
            <a class="dvqr-inline-investigation-action" href="#dvqr-operational-storyline" data-continuation-target="storyline">Review operational storyline</a>
          </div>

          <div class="dvqr-review-state-row">
            <button type="button" class="dvqr-review-toggle" data-review-toggle>Mark reviewed</button>
          </div>
        </article>
      </div>
    </section>`;
}

export function renderHandoffReadiness(): string {
  return `<section class="dvqr-card dvqr-handoff-readiness dvqr-workspace-mode-section" id="dvqr-handoff-readiness" data-workspace-section="handoff">
      <div class="dvqr-section-heading-row">
        <div>
          <h2>Operational Handoff Readiness</h2>
          <p class="dvqr-muted">Review-ready summary for transferring this investigation to another human or team. This is not remediation authority or RCA certainty.</p>
        </div>
      </div>

      <div class="dvqr-handoff-grid">
        <article class="dvqr-handoff-card dvqr-handoff-card-primary">
          <div class="dvqr-handoff-label">Handoff posture</div>
          <h3>Ready for external operational verification</h3>
          <p>DVQR has narrowed the operational problem space and identified unresolved validation prompts. Human reviewers should confirm expectations in Dataverse, Power Platform admin surfaces, ALM pipelines, or owner/team channels before corrective action is considered.</p>
          <div class="dvqr-handoff-review-summary" aria-label="Investigation review summary">
            <span><strong data-handoff-verified-count>0</strong> externally verified / resolved</span>
            <span><strong data-handoff-followup-count>0</strong> need follow-up</span>
            <span><strong data-handoff-note-count>0</strong> reviewer notes</span>
          </div>
        </article>

        <article class="dvqr-handoff-card">
          <div class="dvqr-handoff-label">Include in handoff</div>
          <ul class="dvqr-handoff-list">
            <li>Observed operational storyline</li>
            <li>Outstanding high-significance signals</li>
            <li>Verification checklist and reviewed-state summary</li>
            <li>Snapshot trust and comparison context</li>
          </ul>
        </article>

        <article class="dvqr-handoff-card">
          <div class="dvqr-handoff-label">Do not imply</div>
          <ul class="dvqr-handoff-list">
            <li>Root cause certainty</li>
            <li>Remediation instruction</li>
            <li>Blame or ownership assignment</li>
            <li>Effective-access or runtime causality certainty</li>
          </ul>
        </article>
      </div>
    </section>`;
}
