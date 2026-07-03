# Change Log

---

All notable changes to the **DV Quick Run** extension will be documented in this file.

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/).

---

# DV Quick Run v0.14.1 --- Query Understanding Report & Understanding Engine v2.2

This release completes the v0.14.1 Understanding Engine pass. Query Explain is now rendered as a **Query Understanding Report** through Understanding Engine v2.2, preserving plain-English investigation narrative and technical truth in the same evidence-backed Markdown artifact.

The release consolidates the first-pass, second-pass, and fix-pass work into one stable report model for OData and FetchXML. It strengthens the path from syntax explanation to operational understanding while keeping recommendations advisory and bounded.

### Added
- Added `src/product/understanding` with `UnderstandingDocument`, query mechanics, investigation signals, recommendations, evidence references, and Markdown rendering.
- Added an OData Query Understanding adapter that wraps the existing Explain Engine result into Understanding Engine v2.2 output.
- Added a FetchXML Understanding Document adapter so FetchXML Explain now uses the same v2.2 report structure as OData.
- Added first-class report sections for Investigation Narrative, Query Mechanics, Traversal, Returned Shape, Investigation Complexity, Positive Findings, Investigation Smells & Risks, Technical Breakdown, Recommendations, Evidence References, and Raw Query Reference.
- Added richer OData `$expand` / relationship traversal explanation, including bounded related payload guidance when nested `$select` is used.
- Added positive `Bounded retrieval` findings for OData `$top` and FetchXML `top` queries.
- Added tests proving narrative and technical breakdown are preserved in the same rendered document.

### Changed
- Renamed rendered Explain output to `DV Quick Run - Query Understanding Report`.
- Updated OData Query Explain Markdown output to render from the Understanding Document model while reusing existing Explain Engine contributors and Query Doctor diagnostics.
- Preserved existing technical sections underneath the new narrative, mechanics, traversal, and returned-shape layers.
- Moved raw query syntax lower into the Raw Query Reference section so the report starts with investigation understanding rather than syntax.
- Reduced repeated section-level confidence noise in rendered Markdown while keeping overall confidence and bounded trust language.
- Kept Query Doctor fixes in Recommendations instead of duplicating them as Positive Findings.
- Reworded partial relationship diagnostics so `$expand` guidance reads as relationship guidance instead of a generic diagnostic review.
- Improved FetchXML filtered-query narrative so filtered FetchXML reports are framed as validation, matching OData.
- Hid the `Recommendations` item from the Investigation Pipeline when a report has no recommendations.
- Updated extension version to `0.14.1`.

### Fixed
- Normalised displayed filter text so expressions like `statecode eq 0and contains(...)` render as `statecode eq 0 and contains(...)`.
- Normalised recommendation preview query text using the same filter spacing guardrail.
- Removed the user-facing `Review diagnostic finding` wording for partial relationship diagnostics.
- Prevented FetchXML reports with no recommendations from implying a Recommendations section in the pipeline.

### Locked invariant

Narrative must never replace technical truth. Plain-English interpretation is provided first, and the technical breakdown remains available underneath.

### Release identity

v0.14.1 completes the shift from Explain Query as syntax documentation to Query Understanding as an investigation artifact. The Understanding Document becomes the reusable semantic layer for richer Query Doctor recommendations, future Mini RCA, Binder, Timeline Understanding, Cross Diff Understanding, and MCP-facing investigation context.

---

# DV Quick Run v0.14.0 --- Investigation Intelligence & Explain Engine v2.1

This release introduces Investigation Intelligence for DV Quick Run. Query Explain now transforms Dataverse query structure into operational investigation understanding using Explain Engine v2.1, structured observations, confidence assessment, investigation patterns, and evidence-backed guidance while keeping the existing command surface stable.

DV Quick Run now teaches investigation thinking, not just query syntax. It explains and recommends with evidence, while avoiding claims of root cause certainty, operational authority, or deployment correctness.

### Added
- Added neutral Explain Engine v2 foundation under `src/product/explainEngine`.
- Added `ExplainResult` schema v2.1 with structured observations, confidence factors, unknowns, evidence references, recommendations, and contributors.
- Added contributor-based OData Query Explain rendering for query structure, validation, relationship reasoning, Query Doctor diagnostics, execution evidence, and trust model sections.
- Added workspace-backed Query Explain markdown artifacts under `.dvforgelab/dvqr/explain`.
- Added Markdown Preview opening from the generated host-side `.md` file.
- Added structured teaching observations for pattern purpose, common use cases, trade-offs, and watch-outs.
- Added an Investigation Synthesizer that turns contributor observations into report sections.
- Added evidence-backed Confidence Assessment with supporting factors, limiting factors, and next steps to increase confidence.
- Added Investigation Stage and Investigation Profile sections to describe where the query sits in the investigation lifecycle.
- Added Investigation Pipeline rendering so end users see synthesized investigation components rather than internal contributor IDs.

### Changed
- Migrated OData Query Explain markdown generation through Explain Engine v2 while preserving the existing command and workflow entry points.
- Reordered Query Explain output around investigation summary, investigation stage, investigation profile, confidence assessment, operational implications, verification guidance, and investigation pattern teaching before clause-level analysis.
- Reframed Query Explain summary copy to teach operational intent rather than only describing parsed syntax.
- Merged teaching notes and pattern trade-offs into a synthesized `Investigation Pattern` section.
- Simplified contributor names in the report while preserving internal contributor IDs in the ExplainResult model.
- Reframed Query Doctor output as contributor-backed recommendations with confidence and actionability metadata.
- Debug-gated or removed raw host-side `console.log` diagnostics from investigation, traversal cache, and result-viewer action paths.
- Polished Explain Intelligence report prose so confidence, operational implications, and verification guidance read as bounded investigation advice.
- Updated Welcome screen, Hub copy, README, and changelog so Investigation Intelligence is the user-facing capability and Explain Engine v2.1 is the underlying implementation.

### Release identity

v0.14.0 marks the shift from syntax explanation to operational investigation understanding. It establishes the shared Investigation Pipeline that future Cross Diff Understanding, Timeline Understanding, and Mini RCA can reuse.

### Preserved
- Existing Query Explain command behaviour remains available from the editor.
- FetchXML explain continues to use the existing FetchXML explain pipeline.
- Query Doctor findings remain advisory and do not imply root cause certainty.
- v0.14.0 lays Mini RCA groundwork but does not ship Mini RCA as a user-facing RCA surface.

---

# DV Quick Run v0.13.5 --- Environment Variable Drift & DVEVM Reconstruction

This release adds Dataverse Environment Variable Current Value Drift investigation and DVEVM reconstruction artifact handoff support.

DV Quick Run investigates runtime configuration drift. DV Environment Variable Manager reconstructs supported current-value changes through its own preview-first workflow. Investigation and reconstruction remain separate concerns.

### Added
- Added Environment Variable Current Value Drift provider for Cross-Environment Diff.
- Added DVEVM-owned `.dvevm.json` reconstruction artifact export for eligible Environment Variable Current Value Drift findings.
- Added native DVEVM artifact v2.0 generation using `dvevm.environmentVariableDefinitions`.
- Added source-side DVEVM operation candidates for `SetCurrentValue`, `CreateCurrentValue`, and `DeleteCurrentValue`.
- Added workspace export support under `.dvforgelab/dvevm/exports`.
- Added DVEVM Reconstruction Artifact references in HTML and PDF reports.
- Added report wording for Component, Variable, Operation, Support, and Artifact fields.

### Changed
- Updated Reconstruction Artifact report cards to use `DVEVM Reconstruction Artifact` instead of candidate wording once an artifact is exported.
- Improved PDF reconstruction card layout so long variable names, reasons, and artifact filenames wrap cleanly without overlapping.
- Updated Welcome and Hub copy for v0.13.5 Environment Variable Drift and DVEVM reconstruction messaging.
- Updated DV ForgeLab ecosystem messaging to include DVEVM as the fourth reconstruction handoff utility alongside DVAF, DVIM, and DVCE.

### Security
- Secret environment variable values are never exported by DV Quick Run.
- Secret values remain masked in snapshots, reports, and reconstruction flows.
- Secret variables are intentionally excluded from value reconstruction because evidence cannot prove or safely transport the secret value.

### Release identity

v0.14.0 marks the shift from syntax explanation to operational investigation understanding. It establishes the shared Investigation Pipeline that future Cross Diff Understanding, Timeline Understanding, and Mini RCA can reuse.

### Preserved
- DV Quick Run remains investigation-only and does not apply Dataverse environment variable mutations.
- DV Environment Variable Manager owns import, validation, preview, apply, and execution-result review.
- Source-side reconstruction intent does not imply the source is correct or the target is wrong.
- Reconstruction artifacts remain external-review handoffs, not deployment authority.

---

# DV Quick Run v0.13.4 --- Choice Reconstruction & DVCE Integration

This release adds source-side choice reconstruction handoff support for eligible Choice Metadata Drift findings.

DV Quick Run investigates observed choice drift. DV Choice Editor reconstructs choice options through its own preview-first workflow. Investigation and reconstruction remain separate concerns.

### Added
- Added DVCE-owned `.dvce.json` reconstruction artifact export for eligible option-level Choice Metadata Drift findings.
- Added artifact generation using the DVCE-owned `dvce.choiceDefinition` v3.0 schema.
- Added source-side choice operation candidates for `AddOption`, `UpdateLabel`, and `DeleteOption`.
- Added workspace export support under `.dvforgelab/dvce/exports`.
- Added Cross-Environment Diff and Timeline Reconstruction export actions for supported DVCE choice artifacts.
- Added user-facing 14-day Pro Trial messaging on Welcome and Hub surfaces.

### Changed
- Updated reports to separate observed drift from reconstruction intent.
  - Example: a target-only `Added` drift remains reported as observed `Added` drift.
  - The matching source-side reconstruction artifact may stage `DeleteOption` because it preserves the source snapshot.
- Updated DVCE reconstruction references to use clearer source-side reconstruction strategy wording.
- Updated Welcome and Hub copy to describe user value.

### Fixed
- Fixed DVCE handoff scope classification so synthetic local option set names such as `account_accountratingcode` export as local choice artifacts instead of global choice artifacts.
- Improved unsupported wording for whole choice set additions, especially where no bounded DV ForgeLab utility currently owns whole global choice definition creation.

### Release identity

v0.14.0 marks the shift from syntax explanation to operational investigation understanding. It establishes the shared Investigation Pipeline that future Cross Diff Understanding, Timeline Understanding, and Mini RCA can reuse.

### Preserved
- DV Quick Run remains investigation-only and does not apply Dataverse choice mutations.
- DV Choice Editor owns import, stage, validate, preview, apply, and publish.
- Source-side reconstruction intent does not imply the source is correct or the target is wrong.
- Whole global choice definition creation remains intentionally unsupported until a bounded utility owns that workflow.

---

# DV Quick Run v0.13.3 --- Identity Reconstruction, DVIM Integration & Shared Workspace Evolution

This release introduces the first **Identity Participation Reconstruction** workflow within the DV ForgeLab ecosystem.

DV Quick Run can now identify source-side identity participation drift, generate bounded reconstruction intent artifacts, and hand those
artifacts directly to DV Identity Manager for external preview and application.

This release also establishes the shared DV ForgeLab workspace as the common integration point across investigation and reconstruction utilities.

DV Quick Run continues to investigate.

DV Identity Manager continues to reconstruct.

**Investigation and reconstruction remain separate concerns.**

---

## 👥 Identity Participation Reconstruction (Major)

Introduced Reconstruction Artifacts for eligible Identity Participation Drift findings.

DV Quick Run can now:

-   detect source-side identity participation drift
-   identify reconstruction candidates
-   generate DVIM-compatible reconstruction artifacts
-   preserve reconstruction intent alongside investigation evidence
-   maintain investigation boundaries

**Behaviour**

-   only source-side participation is exported
-   target-side additions do not generate reconstruction artifacts
-   exports remain explicitly user-triggered
-   reconstruction intent remains advisory-only

**Results**

-   stronger investigation-to-reconstruction continuity
-   reduced manual security role recreation
-   improved identity administration workflows
-   stronger ecosystem integration

---

## 🏗️ DVIM Export Integration

Added direct DVIM export support from:

-   Cross-Environment Diff
-   Timeline Reconstruction

Eligible findings now surface:

``` text
Export DVIM Artifact
```

DV Quick Run generates source-side identity participation definitions
suitable for external preview in DV Identity Manager.

**Behaviour**

-   exports preserve observed role participation
-   team memberships are retained where supported
-   artifacts remain externally reviewable
-   no automatic remediation occurs

---

## 📄 Reconstruction Artifacts in Reports

Timeline Reconstruction and Cross-Diff reports now include
**Reconstruction Artifacts** sections for DVIM exports.

Reports preserve:

-   artifact filename
-   identity context
-   reconstruction rationale
-   support status

**Results**

-   stronger operational handoff
-   clearer reconstruction continuity
-   improved investigation audit trail

---

## 🗂️ Shared DV ForgeLab Workspace Expansion

Expanded the shared workspace architecture.

``` text
.dvforgelab
├─ dvqr
│   ├─ snapshots
│   ├─ comparisons
│   └─ reports
├─ dvaf
│   └─ exports
└─ dvim
    └─ exports
```

**Behaviour**

-   investigation evidence remains isolated
-   reconstruction artifacts remain utility-owned
-   ecosystem integration becomes workspace-aware
-   shared conventions continue to evolve

---

## 💾 Workspace-First Report Exports

Timeline Reconstruction and Cross-Environment Diff report exports now
default to the shared DV ForgeLab workspace.

Supported exports include:

-   JSON
-   Markdown
-   HTML
-   PDF reports

**Behaviour**

-   reports save directly into the Evidence Workspace
-   manual Save dialogs are no longer required for normal workflows
-   evidence remains organised alongside comparisons and snapshots

**Results**

-   reduced export friction
-   improved investigation continuity
-   cleaner workspace organisation

---

## 🎨 Reconstruction Artifact Experience

Refined reconstruction workflows throughout investigation surfaces.

Improvements include:

-   reusable reconstruction artifact components
-   consistent export success messaging
-   shared report presentation
-   consistent reconstruction terminology across DVAF and DVIM
-   simplified ecosystem architecture

**Results**

-   improved consistency
-   reduced duplicated implementation
-   easier future ecosystem expansion

---

## 🧭 Architectural Invariants Reinforced

This release reinforces:

-   DVQR investigates observed evidence
-   DVIM reconstructs identity participation
-   reconstruction artifacts are handoffs, not authority
-   source-side evidence is preserved
-   target-side additions remain observational
-   human review remains mandatory
-   investigation and reconstruction remain separate concerns

---

## 🎯 Summary

DV Quick Run can now:

-   export DVIM reconstruction artifacts
-   preserve identity reconstruction candidates in reports
-   hand off identity participation findings to DV Identity Manager
-   organise reports automatically in the shared workspace
-   expand the shared DV ForgeLab ecosystem architecture

This release evolves DV Quick Run from:

``` text
Investigation
→ Metadata Reconstruction Handoff
```

towards:

``` text
Investigation
→ Metadata Reconstruction Handoff
→ Identity Reconstruction Handoff
```

while preserving DVQR's evidence-first investigation model.

---

# DV Quick Run v0.13.2 — Reconstruction Artifacts, DVAF Integration & Investigation-to-Reconstruction Handoff

This release introduces the first reconstruction handoff workflow within the DV ForgeLab ecosystem.

DV Quick Run can now identify eligible source-side metadata drift, generate bounded reconstruction intent artifacts, and hand those artifacts to DV Attribute Factory for external preview and application.

DV Quick Run continues to investigate.

DV Attribute Factory continues to reconstruct.

Investigation and reconstruction remain separate concerns.

---

## 🧩 Reconstruction Artifacts (Major)

Introduced Reconstruction Artifacts for eligible Column Metadata Drift findings.

DV Quick Run can now:

* detect source-side column metadata drift
* identify reconstruction candidates
* generate DVAF-compatible reconstruction artifacts
* preserve reconstruction intent alongside investigation evidence
* maintain investigation boundaries

Behaviour:

* only source-side definitions are exported
* target-side additions do not generate reconstruction artifacts
* exports remain user-triggered
* reconstruction intent remains advisory-only

Results:

* stronger investigation-to-reconstruction continuity
* reduced manual schema recreation effort
* improved ecosystem integration

---

## 🏗️ DVAF Export Integration

Added direct DVAF export support from:

* Cross-Environment Diff
* Timeline Reconstruction

Eligible findings now surface:

```text
Export DVAF Artifact
```

DV Quick Run generates source-side reconstruction definitions suitable for external preview in DV Attribute Factory.

Behaviour:

* exports preserve source-side metadata
* lookup targets and supported metadata are retained where available
* artifacts remain externally reviewable
* no automatic remediation occurs

---

## 📄 Reconstruction Artifacts in Reports

Timeline Reconstruction and Cross-Diff reports now include:

```text
Reconstruction Artifacts
```

sections when exports were generated before report creation.

Reports preserve:

* artifact filename
* entity context
* attribute context
* reconstruction rationale
* support status

Results:

* stronger handoff readiness
* improved review continuity
* clearer reconstruction audit trail

---

## 🗂️ DV ForgeLab Workspace Expansion

Expanded the Evidence Workspace model.

Artifacts now separate investigation evidence from reconstruction intent.

Example:

```text
.dvforgelab
├─ dvqr
│  ├─ snapshots
│  ├─ comparisons
│  └─ reports
└─ dvaf
   └─ exports
```

Behaviour:

* DVQR evidence remains isolated
* DVAF reconstruction artifacts remain isolated
* workspace organisation becomes ecosystem-aware

---

## ⏱️ Timeline Reconstruction Artifact Support

Timeline Reconstruction can now export reconstruction candidates from first-observed timeline events.

Behaviour:

* exports use the selected event interval's source-side definition
* exports do not represent latest timeline state
* exports do not merge timeline intervals
* timeline trust boundaries remain preserved

---

## 🎨 Investigation Playbook Expansion

Added dedicated Hub playbooks for:

* Investigate Environment Differences
* Reconstruct Change Over Time

These playbooks formalise recommended workflows for:

* Cross-Environment Diff
* Timeline Reconstruction
* Audit Evidence enrichment
* Reconstruction Artifact generation

Results:

* improved discoverability
* clearer operational guidance
* stronger onboarding experience

---

## 🧭 Architectural Invariants Reinforced

This release reinforces:

* DVQR investigates observed evidence
* DVAF reconstructs metadata definitions
* reconstruction artifacts are handoffs, not authority
* source-side evidence is preserved
* target-side additions remain observational
* human review remains mandatory

---

## 🎯 Summary

DV Quick Run can now:

* export DVAF reconstruction artifacts
* preserve reconstruction candidates in reports
* hand off investigation findings to DV Attribute Factory
* generate reconstruction intent from Cross-Diff and Timeline Reconstruction
* maintain bounded investigation and reconstruction responsibilities

This release evolves DV Quick Run from:

```text
Investigation
```

towards:

```text
Investigation
→ Reconstruction Handoff
```

while preserving DVQR's evidence-first investigation model.

---

# DV Quick Run v0.13.1 — Audit Evidence Enrichment, Timeline Context & Investigation Continuity

This release introduces the first generation of **Audit Evidence Enrichment** for Timeline Reconstruction and Cross-Environment Diff.

DV Quick Run can now query Dataverse audit history inside snapshot-bounded investigation windows and surface matching audit evidence directly alongside operational findings.

The goal is not audit forensics or historical certainty.

It is:

* operational context enrichment
* snapshot-bounded audit visibility
* explainable investigation continuity
* evidence-backed operational review
* calmer historical investigation workflows

DV Quick Run continues to reinforce:

```text
DVQR reconstructs observed evidence.

DVQR does not reconstruct historical certainty.
```

---

## 🔍 Audit Evidence Enrichment (Major)

Introduced Audit Evidence Enrichment across:

* Timeline Reconstruction
* Cross-Environment Diff

DV Quick Run can now:

* query Dataverse audit history inside snapshot windows
* correlate matching audit evidence
* surface audit context inline
* preserve captured snapshot evidence alongside audit observations

Audit evidence is treated as:

```text
Investigation enrichment
```

and not:

```text
Root cause proof
```

Behaviour:

* audit lookup remains explicitly bounded
* evidence remains snapshot-window constrained
* audit findings supplement captured evidence
* causality is never inferred

Results:

* stronger investigation context
* improved operational storytelling
* reduced manual audit searches
* richer historical review workflows

---

## ⏱️ Snapshot-Bounded Audit Queries

Audit retrieval is now constrained to:

```text
Source Snapshot
        ↓
 Investigation Window
        ↓
Target Snapshot
```

DV Quick Run only searches audit history occurring within the selected reconstruction interval.

Behaviour:

* audit evidence remains time-bounded
* unrelated historical records are excluded
* timeline findings remain explainable
* operational continuity is preserved

Results:

* reduced audit noise
* stronger evidence relevance
* improved timeline trustworthiness
* calmer audit interpretation

---

## 👥 Security Role & Relationship Audit Interpretation

Added first-generation support for interpreting common Dataverse security and relationship audit payloads.

DV Quick Run can now recognise patterns such as:

* role associations
* user-role participation
* security relationship changes
* entity association operations
* relationship-based audit activity

Where interpretation is possible, DV Quick Run surfaces:

* operation type
* relationship name
* related entity
* related record
* investigator context

Results:

* improved visibility into security-oriented changes
* stronger participation investigation workflows
* richer identity drift context

---

## 🧪 Experimental Audit Payload Decoder

Dataverse audit payloads vary significantly across:

* entity updates
* relationship associations
* security operations
* ownership changes
* platform-generated activity

DV Quick Run now preserves raw evidence whenever payloads cannot be confidently interpreted.

Behaviour:

* raw payloads remain available
* partial interpretations are explicitly marked
* unknown payloads are never silently discarded
* evidence preservation takes precedence over assumptions

Results:

* safer audit handling
* stronger investigation transparency
* improved future decoder evolution

---

## 📄 Audit-Aware HTML & PDF Reports

Timeline Reconstruction and Cross-Environment Diff reports now support embedded audit evidence.

Exports can now include:

* audit summaries
* audit windows
* interpreted audit records
* investigator-facing audit notes
* experimental interpretation warnings

Behaviour:

* audit sections only appear when evidence exists
* reports preserve investigation continuity
* audit evidence remains advisory-only

Results:

* richer executive review reports
* improved handoff quality
* stronger investigation portability

---

## 🚩 Audit Edge Case Reporting

Introduced audit edge-case reporting guidance.

Some Dataverse audit payloads expose undocumented or inconsistent structures.

DV Quick Run now surfaces:

```text
Report audit edge case
```

when unknown payloads are encountered.

Behaviour:

* raw evidence is preserved
* interpretation confidence is disclosed
* future releases can improve decoder coverage

Results:

* community-driven decoder evolution
* improved audit compatibility
* stronger long-term investigation accuracy

---

## 🗂️ Workspace Report Naming Standardisation

Standardised report naming across:

* Timeline Reconstruction
* Cross-Environment Diff

Reports now use consistent short-form identifiers:

```text
TR-{entity}-{timestamp}
CD-{entity}-{timestamp}
```

Examples:

```text
TR-account-20260622-1150.html
CD-contact-20260622-1430.pdf
```

Behaviour:

* shorter filenames
* improved workspace readability
* consistent Evidence Workspace organisation
* easier report navigation

---

## 🎨 Investigation & Audit UX Refinements

Refined audit presentation throughout investigation workflows.

Improvements include:

* inline audit evidence cards
* interval-aware audit summaries
* clearer audit disclaimers
* independent audit expand/collapse state
* timeline audit continuity
* audit interpretation warnings
* report export consistency

Results:

* improved investigation readability
* calmer audit review workflows
* stronger evidence transparency

---

## 🧪 Stability & Validation

Verified:

* Timeline Reconstruction audit enrichment
* Cross-Environment Diff audit enrichment
* audit evidence export workflows
* HTML audit rendering
* PDF audit rendering
* snapshot-window audit queries
* security role association interpretation
* relationship association interpretation
* audit edge-case preservation
* workspace report generation

No regression in:

* Timeline Reconstruction
* Cross-Environment Diff
* Snapshot Library
* Operational Profiles
* Evidence Workspace
* Report Exports
* Access Context
* Result Viewer

---

## 🎯 Summary

DV Quick Run can now:

* enrich investigations with Dataverse audit history
* surface audit evidence directly inside Timeline Reconstruction
* provide audit-aware Cross-Environment Diff analysis
* preserve unknown audit payloads safely
* export audit-enriched HTML and PDF reports
* standardise report naming across investigation workflows

This release evolves DV Quick Run from:

```text
Observed Evidence Reconstruction
```

towards:

```text
Observed Evidence Reconstruction
+
Audit Evidence Enrichment
```

while preserving DVQR's evidence-first investigation model.

## v0.13.0.1 — Purchase Path Consistency

- Added Direct Purchase buttons throughout Pro upgrade flows.
- Added Lemon Squeezy fallback purchase path for environments where dvquickrun.com is restricted.
- Improved Pro upgrade messaging for Timeline Reconstruction.

---

# DV Quick Run v0.13.0 — Operational Timeline Reconstruction, Evidence Evolution & Investigation Handoff

This release introduces the first complete **Operational Timeline Reconstruction** workflow inside DV Quick Run.

DV Quick Run can now move beyond point-in-time comparison and reconstruct how operational evidence evolved across multiple snapshots.

Investigators can now:

* reconstruct operational timelines across 3+ snapshots
* understand when drift was first observed
* visualise evidence evolution across capture windows
* generate timeline investigation reports
* preserve timeline continuity through Evidence Workspace artifacts
* coordinate historical operational investigations through Snapshot Library

The goal is not historical certainty.

It is:

* evidence evolution visibility
* bounded timeline reconstruction
* explainable operational history
* investigation continuity
* evidence-first operational reasoning
* calmer historical drift understanding

DV Quick Run continues to reinforce:

```text
DVQR reconstructs observed evidence.

DVQR does not reconstruct historical certainty.
```

---

## ⏱️ Timeline Reconstruction (Major)

Introduced the first complete Timeline Reconstruction workflow.

Investigators can now select:

```text
3 or more compatible snapshots
```

from the same:

* environment
* subject/entity

to reconstruct an operational timeline.

Timeline Reconstruction surfaces:

* snapshot-bounded intervals
* first-observed drift windows
* provider-owned timeline findings
* significance distribution
* evidence continuity
* timeline trust state

Behaviour:

* timeline evidence remains snapshot-bound
* no interpolation occurs
* no hidden historical reconstruction occurs
* operational authority is not inferred
* exact change times are not claimed

Results:

* dramatically improved historical investigation capability
* clearer operational evolution visibility
* stronger evidence continuity
* reduced manual timeline analysis effort

---

## 📈 Timeline Graph & Interval Analysis (Major)

Added dedicated Timeline Graph visualisation.

Timeline Graph displays:

* ordered snapshot progression
* interval boundaries
* event density by interval
* timeline range
* drift concentration
* evidence distribution

Intervals are bounded by adjacent snapshots.

Example:

```text
Snapshot A
    ↓
Interval 1
    ↓
Snapshot B
    ↓
Interval 2
    ↓
Snapshot C
```

Behaviour:

* events belong to capture windows
* findings are attributed to first-observed intervals
* graph remains evidence-backed
* no causality is inferred

Results:

* faster timeline orientation
* improved operational readability
* calmer investigation workflows
* stronger historical understanding

---

## 🔍 First-Observed Drift Detection (Major)

Timeline Reconstruction now identifies:

```text
When was this first observed?
```

for timeline-compatible providers.

Supported providers include:

* Operational Profile Drift
* Solution Participation Drift
* Workflow / Automation Participation Drift
* Plugin Runtime Behaviour Drift
* Identity Participation Drift
* Column Metadata Drift
* Relationship Metadata Drift
* Choice / Option Set Drift
* Entity Configuration Drift

Timeline findings surface:

* first observed interval
* first observed snapshot window
* provider context
* representative evidence
* significance classification

Results:

* stronger operational chronology
* improved drift triage
* clearer investigation narratives
* reduced manual comparison effort

---

## 📄 Timeline Findings Summary Report (New)

Added Timeline Findings Summary report generation.

Reports include:

* timeline overview
* interval summaries
* provider distribution
* significance distribution
* timeline trust state
* first-observed findings

Behaviour:

* report remains investigation-oriented
* strongest signals surface first
* evidence remains bounded and explainable

Results:

* faster executive review
* improved operational communication
* clearer historical summaries
* stronger investigation portability

---

## 📦 Timeline Investigation Handoff (Major)

Introduced Timeline Investigation Handoff exports.

Timeline handoff reports preserve:

* reconstructed timeline context
* interval evidence
* provider findings
* significance interpretation
* timeline trust information
* evidence continuity

Behaviour:

* timeline handoff remains advisory-only
* no remediation guidance is generated
* no operational authority is inferred

Results:

* stronger investigation continuity
* improved escalation workflows
* cleaner review handoffs
* enterprise-ready timeline reporting

---

## 📚 Snapshot Library Timeline Workflows

Expanded Snapshot Library into a timeline investigation workspace.

Added:

* timeline-ready selection states
* multi-snapshot evidence selection
* timeline reconstruction launch workflows
* timeline readiness indicators
* interval-aware investigation entry points
* compatibility validation for timeline reconstruction

Behaviour:

```text
2 snapshots
→ Comparison

3+ compatible snapshots
→ Timeline Reconstruction
```

Additional safeguards:

* timelines require snapshots from the same environment
* timelines require the same entity/subject
* incompatible snapshot combinations are blocked
* cross-environment timelines are not permitted

Results:

* clearer workflow progression
* stronger Evidence Workspace integration
* improved discoverability
* calmer operational UX

---

## 🎭 Free Timeline Preview

Added built-in:

```text
TIMELINE-MOCK
```

sample evidence packs.

Free users can now:

* explore timeline workflows
* generate sample timeline reports
* understand interval-based investigation
* preview Timeline Reconstruction before Pro activation

Included mock history:

* baseline operational profile
* identity participation drift
* column metadata drift
* relationship metadata drift
* choice metadata drift

Behaviour:

* mock timelines remain educational
* real timeline reconstruction remains Pro
* understanding remains visible before acceleration

Results:

* improved onboarding
* stronger feature discoverability
* clearer value demonstration
* preserved open-core philosophy

---

## 🛡️ Timeline Trust & Verification

Expanded Snapshot Trust into timeline workflows.

Timeline Reconstruction now evaluates:

* Verified snapshots
* Modified snapshots
* Legacy / Unverified snapshots
* Invalid snapshots

Timeline reports surface:

```text
Timeline Trust
```

including:

* verification counts
* modification counts
* timeline confidence boundaries

Behaviour:

* unverified evidence remains visible
* trust state remains explicit
* timeline reconstruction remains inspectable

Results:

* stronger investigation transparency
* improved evidence trustworthiness
* safer historical interpretation

---

## 🎨 Timeline Investigation UX

Added dedicated timeline investigation experiences across:

* Snapshot Library
* Timeline Graph
* Timeline Findings Summary
* Timeline Investigation Handoff
* Welcome Experience
* Operational Profile roadmap surfaces
* Hub roadmap surfaces

Improvements include:

* interval visualisation
* timeline-oriented terminology
* evidence evolution summaries
* first-observed narratives
* stronger historical readability
* calmer enterprise investigation workflows

Results:

* significantly improved historical investigation UX
* stronger operational storytelling
* clearer evidence evolution visibility
* reduced cognitive load

---

## 🧪 Stability & Validation

Verified:

* timeline reconstruction workflows
* interval generation
* first-observed finding detection
* timeline graph rendering
* provider distribution summaries
* significance distribution summaries
* timeline PDF exports
* timeline HTML exports
* timeline handoff reports
* mock timeline datasets
* same-environment compatibility validation
* same-entity compatibility validation

No regression in:

* Snapshot Library
* Cross-Environment Diff
* Operational Profiles
* Access Context
* Result Viewer
* Relationship Graph
* Capability Explorer
* Execution Insights
* Evidence Workspace workflows

---

## 🎯 Summary

DV Quick Run can now:

* reconstruct operational timelines across multiple snapshots
* identify when drift was first observed
* visualise evidence evolution through interval graphs
* generate timeline-focused investigation reports
* preserve evidence continuity across historical investigations
* coordinate multi-snapshot investigations through Snapshot Library

This release evolves DV Quick Run from:

```text
Operational Comparison
```

towards:

```text
Operational Timeline Investigation
```

while preserving DVQR's evidence-first investigation model.

---

# DV Quick Run v0.12.8 — Evidence Workspace & Snapshot Capture

This release evolves Snapshot Library from a saved-file list into a local Evidence Workspace for Dataverse investigation.

DV Quick Run can now:

* capture investigation snapshots directly from Snapshot Library
* organise evidence into a Git-friendly workspace structure
* manage snapshots by environment and subject
* compare selected snapshots directly from Snapshot Library
* prepare multi-snapshot investigation workflows
* search, organise, and revisit evidence more efficiently
* create Evidence Workspaces through a guided onboarding workflow

The release intentionally does not implement timeline reconstruction. v0.12.8 organises and prepares evidence. v0.13.x reconstructs timelines.

Core invariant:

```text
Snapshots are evidence artifacts.
Snapshots are not operational authority.
```

---

## 🏗️ Evidence Workspace Foundations (Major)

Introduced the Evidence Workspace.

DV Quick Run now organises investigation artifacts into a dedicated workspace structure:

```text
.dvqr
├─ snapshots
├─ comparisons
└─ reports
```

Evidence Workspace provides:

* local-first evidence storage
* Git-friendly investigation artifacts
* comparison continuity
* report continuity
* investigation replay foundations
* clearer evidence ownership

Behaviour:

* evidence remains local
* snapshots remain explicit artifacts
* workspace contents remain user-controlled
* evidence remains portable and inspectable

Results:

* stronger investigation continuity
* improved evidence organisation
* clearer operational workflows
* improved long-term snapshot management

---

## 📸 Snapshot Capture Workflow (Major)

Added Capture Snapshot directly inside Snapshot Library.

Users can now:

* select an environment
* select a subject/entity
* provide an optional label
* capture evidence directly into the active Evidence Workspace

Behaviour:

* snapshots are stored automatically in workspace structure
* environment and subject organisation is preserved
* snapshot identity is metadata-backed
* evidence remains replayable and comparable

Results:

* dramatically reduced snapshot capture friction
* stronger evidence continuity
* improved investigation repeatability
* faster comparison preparation

---

## 🆔 Metadata-Backed Snapshot Identity

Refined snapshot identity architecture.

Snapshots now use:

* deterministic short identifiers
* explicit snapshot metadata
* stable evidence identity
* filename-independent snapshot tracking

Behaviour:

* identity no longer depends on verbose filenames
* snapshot metadata remains authoritative
* comparison workflows remain more resilient

Results:

* cleaner evidence storage
* stronger long-term maintainability
* safer snapshot lifecycle management

---

## 📋 Evidence Selection & Comparison Workflow

Expanded Snapshot Library into a richer evidence-selection experience.

Added:

* multi-select snapshot workflows
* comparison-ready selection states
* compact selection mode
* detailed evidence review mode
* clickable compact selection rows
* selection counters
* scrollable evidence-selection panels

Behaviour:

* two selected snapshots become comparison-ready
* source and target selection remain explicit
* evidence remains visible during filtering and search

Results:

* reduced comparison setup effort
* improved investigation usability
* clearer comparison workflows
* stronger evidence-management experience

---

## ⏳ Timeline Reconstruction Readiness

Added timeline-oriented selection readiness.

When three or more snapshots are selected, Snapshot Library now surfaces timeline readiness states.

Behaviour:

* two selected snapshots remain comparison-ready
* three or more snapshots become timeline-ready
* timeline reconstruction remains deferred to v0.13.x
* no automatic timeline narrative is generated

This reinforces the roadmap direction:

```text
v0.12.8 organises evidence.
v0.13.x reconstructs timelines.
```

---

## 🔍 Search, Navigation & Workspace Refinement

Expanded Snapshot Library search and navigation capabilities.

Search now supports:

* labels
* entities
* environments
* providers
* capture dates
* favourite state
* snapshot identifiers
* file paths

Additional improvements include:

* active search visibility
* filtered-result counts
* compact evidence browsing
* scrollable evidence groups
* improved large-workspace usability

Results:

* faster evidence discovery
* calmer investigation workflows
* improved scalability
* stronger enterprise usability

---

## 🗂️ Evidence Workspace Navigation

Added dedicated Evidence Workspace navigation actions.

New capabilities include:

* Open Snapshot Folder
* Open Comparisons Folder
* Open Reports Folder
* Copy Workspace Path

Behaviour:

* investigation artifacts remain easy to locate
* evidence remains externally accessible
* Git-based workflows remain straightforward

Results:

* stronger workflow transparency
* easier artifact management
* improved integration with external tooling

---

## 🚀 Evidence Workspace Onboarding

Introduced guided Evidence Workspace creation.

Added:

```text
DV Quick Run: Create Evidence Workspace
```

DV Quick Run can now:

* create Evidence Workspace structures automatically
* create snapshot, comparison, and report folders
* generate VS Code workspace files
* prompt users to open the workspace immediately
* guide first-time users into Evidence Workspace workflows

Results:

* dramatically reduced setup friction
* faster onboarding
* stronger Evidence Workspace discoverability
* improved first-use experience

---

## 🎯 Summary

DV Quick Run can now:

* create Evidence Workspaces automatically
* capture snapshots directly from Snapshot Library
* organise investigation evidence more effectively
* compare selected snapshots directly from Snapshot Library
* prepare timeline-oriented workflows
* search and manage evidence at larger scale
* preserve investigation continuity through dedicated Evidence Workspaces

This release establishes the foundation for:

```text
Evidence Workspace
→ Snapshot Capture
→ Comparison
→ Timeline Reconstruction
```

while preserving DVQR's evidence-first investigation model.

---

# DV Quick Run v0.12.7 — Metadata Drift Expansion, Schema Investigation & Comparison Coverage

This release expands Cross-Environment Diff beyond operational participation and runtime behaviour into broader schema-level operational understanding.

DV Quick Run can now investigate:

* relationship metadata drift
* column metadata drift
* entity configuration drift
* schema-level operational evolution
* metadata configuration differences
* structural Dataverse changes alongside runtime changes

The goal is not deployment validation or schema governance.

It is:

* metadata-aware operational investigation
* explainable schema evolution visibility
* broader comparison coverage
* calmer structural drift understanding
* stronger investigation continuity

DV Quick Run continues to reinforce:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

---

## 🕸️ Relationship Metadata Drift (Major)

Introduced dedicated Relationship Metadata Drift comparison support.

DV Quick Run can now compare:

* relationship additions
* relationship removals
* relationship type changes
* relationship schema changes
* relationship navigation drift
* relationship participation differences

Examples include:

* Many-to-One relationships added
* One-to-Many relationships removed
* relationship schema name changes
* relationship topology evolution between environments

Relationship drift now surfaces:

* relationship name
* source entity
* target entity
* relationship type
* operational significance
* representative evidence

Behaviour:

* relationship interpretation remains observational
* topology changes remain evidence-backed
* relationship drift does not imply application failure
* strongest structural signals surface first

Results:

* clearer metadata topology visibility
* improved schema investigation continuity
* reduced manual metadata comparison effort
* broader operational comparison coverage

---

## 🧱 Column Metadata Drift (Major)

Introduced dedicated Column Metadata Drift comparison support.

DV Quick Run can now compare:

* column additions
* column removals
* datatype changes
* requirement-level changes
* display-name changes
* option-set evolution
* metadata configuration drift

Examples include:

* text → memo conversions
* optional → required changes
* new columns introduced
* choice metadata evolution
* renamed metadata surfaces

Behaviour:

* comparison remains metadata-focused
* no deployment recommendation is generated
* operational interpretation remains bounded
* evidence remains inspectable and explainable

Results:

* stronger schema-change visibility
* improved investigation readiness
* reduced manual metadata review effort
* broader comparison platform maturity

---

## ⚙️ Entity Configuration Drift (Major)

Introduced Entity Configuration Drift comparison support.

DV Quick Run can now compare:

* audit configuration
* change tracking
* ownership semantics
* activity enablement
* duplicate detection
* entity-level operational settings

Examples include:

* Audit Enabled: false → true
* Change Tracking: false → true
* configuration alignment differences
* operational capability changes between environments

Behaviour:

* configuration interpretation remains advisory-only
* configuration drift does not imply operational issues
* strongest operationally meaningful differences surface first

Results:

* clearer operational configuration visibility
* improved environment-alignment investigation
* stronger metadata coverage
* reduced configuration-review effort

---

## 📊 Comparison Coverage Expansion

Cross-Environment Diff now spans a broader set of operational investigation dimensions.

Comparison providers now include:

* Operational Profile Drift
* Solution Participation Drift
* Workflow / Automation Drift
* Plugin Runtime Behaviour Drift
* Identity Participation Drift
* Relationship Metadata Drift
* Column Metadata Drift
* Entity Configuration Drift

Results:

* broader operational understanding
* stronger comparison completeness
* improved investigation confidence
* richer evidence-backed drift interpretation

---

## 🎨 Metadata Investigation Readability Refinement

Refined metadata-oriented comparison rendering throughout Cross-Environment Diff.

Improvements include:

* clearer schema-oriented titles
* stronger metadata context visibility
* improved relationship readability
* cleaner configuration presentation
* refined metadata evidence summaries

Results:

* calmer schema investigation workflows
* stronger metadata scanability
* reduced structural-comparison fatigue
* improved enterprise readability

---

## 🧪 Stability & Validation

Verified:

* relationship drift rendering
* column metadata comparison
* entity configuration comparison
* export compatibility
* HTML report rendering
* PDF report rendering
* grouped metadata evidence
* significance classification
* mock comparison coverage

No regression in:

* Cross-Environment Diff
* Timeline Diff
* Snapshot Library
* Investigation Handoff
* Report Exports
* Access Context
* Result Viewer
* Relationship Graph Workspace
* DVBUR artifact workflows

---

## 🎯 Summary

DV Quick Run can now:

* investigate relationship topology drift
* compare schema-level metadata evolution
* surface entity configuration differences
* understand structural Dataverse changes alongside runtime drift
* broaden operational comparison coverage across metadata and runtime dimensions
* preserve evidence-backed metadata investigation workflows

This release continues DVQR's evolution into:

```text
a metadata-aware operational investigation,
comparison and evidence-handoff workbench
```

for enterprise Dataverse environments.

---

# DV Quick Run v0.12.6 — Relationship Graph Workspace & Command Palette Hardening

This release focuses on a small but meaningful usability improvement to everyday investigation workflows.

DV Quick Run now presents relationship exploration through a dedicated Relationship Graph workspace and resolves production-only command registration issues affecting editor CodeLens actions.

The goal is not new investigation authority.

It is:

* smoother metadata exploration
* improved relationship readability
* faster operational navigation
* calmer investigation continuity
* stronger production reliability
* reduced workflow friction

DV Quick Run continues to reinforce:

```text
DVQR investigates and explains.
DVQR does not perform hidden execution.
```

---

## 🕸️ Relationship Graph Workspace (Major)

Relationship exploration now opens in a dedicated Relationship Graph workspace.

Previously:

```text
View Relationships
→ Save .txt
→ Open externally
```

Now:

```text
View Relationships
→ Relationship Graph
```

The new workspace provides:

* relationship summary cards
* relationship counts by type
* Many-to-One exploration
* One-to-Many exploration
* Many-to-Many exploration
* cleaner relationship readability
* improved investigation continuity

Relationship information remains metadata-based and observational.

No relationship analysis or authority inference is performed.

Results:

* significantly improved relationship discoverability
* faster metadata exploration
* reduced context switching
* stronger investigation flow

---

## 🔍 Relationship Search & Navigation

Added dedicated relationship search inside the Relationship Graph workspace.

Capabilities include:

* live search
* match highlighting
* next match navigation
* previous match navigation
* automatic match focus
* match count visibility
* clear-search actions

Behaviour:

* search remains local to the current relationship graph
* no environment-wide metadata crawling
* no hidden relationship expansion

Results:

* faster navigation of large metadata surfaces
* improved enterprise-scale usability
* calmer relationship investigation workflows
* reduced scrolling fatigue

---

## 💾 Exact Artifact Preservation

Relationship Graph now preserves the original relationship export artifact.

Added:

* Save Exact Text
* Copy Exact Text

Behaviour:

* exported text remains identical to the underlying generated artifact
* relationship presentation does not alter exported evidence
* visual exploration and evidence export remain separate concerns

Results:

* stronger evidence continuity
* improved portability
* safer investigation sharing
* preserved trust in exported metadata

---

## ⚡ Result Viewer → Relationship Graph Continuation

Refined Result Viewer investigation continuity.

The Result Viewer action:

```text
View Relationships
```

now launches the Relationship Graph workspace directly.

Behaviour:

* investigation context remains preserved
* relationship exploration remains inside DVQR
* metadata understanding becomes more discoverable
* workflow continuity improves

Results:

* reduced workflow interruption
* improved operational investigation flow
* stronger Result Viewer continuity
* cleaner metadata exploration experience

---

## 🧯 Production CodeLens Command Registration Fix

Resolved an issue affecting Marketplace/VSIX builds where editor CodeLens actions could fail to execute.

Affected commands included:

* Run Query
* Explain Query

Behaviour:

* editor-support commands are now registered correctly in production builds
* development-only commands remain development-only
* public editor workflows remain available outside F5 sessions

Results:

* restored CodeLens reliability
* consistent behaviour between development and Marketplace installations
* improved production stability

---

## 🧪 Stability & Validation

Verified:

* Relationship Graph workspace rendering
* relationship search behaviour
* next/previous match navigation
* exact text export workflows
* Result Viewer relationship continuation
* Marketplace command registration
* VSIX command registration
* CodeLens execution behaviour

No regression in:

* Result Viewer
* Operational Profiles
* Access Context
* Execution Insights
* Guided Traversal
* Capability Explorer
* Cross-Environment Diff
* Timeline Diff
* DVBUR artifact export workflows

---

## 🎯 Summary

DV Quick Run can now:

* explore entity relationships through a dedicated workspace
* search and navigate large relationship surfaces more efficiently
* preserve exact relationship artifacts while improving readability
* launch relationship exploration directly from Result Viewer
* execute CodeLens actions reliably in Marketplace and VSIX installations

This release continues DVQR's focus on:

```text
operational understanding
through calmer investigation workflows
```

---

# DV Quick Run v0.12.5 — Commercial Boundary Hardening, Pro Activation & Capability Foundations

This release prepares DV Quick Run for commercial Pro activation while preserving the core product invariant:

```text
Operational understanding remains accessible.
Operational acceleration may be premium.
```

DVQR now supports Online Pro activation, Offline Pro signed-license import, Pathfinder recognition, capability-aware workflow gating, and calmer fallback-to-Free behaviour.

The goal is not aggressive monetisation.

It is:

* sustainable operational tooling
* explicit capability activation
* local-first trust
* Free understanding / Pro acceleration boundaries
* online and offline licensing readiness
* safer Marketplace commercial release foundations

DV Quick Run continues to reinforce:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

---

## 🔐 Online Pro Activation

Added Online Pro activation through:

```text
DV Quick Run: Activate Pro License
```

Users can now activate DVQR Pro by entering a DV Quick Run Pro license key.

Online activation supports:

* license-key activation
* device/instance naming
* local entitlement caching
* periodic validation
* graceful unavailable-state handling
* deactivation from the Command Palette
* license status inspection

Marketplace builds do not require embedded Lemon Squeezy Store API keys or local operator secret files.

---

## 🧭 License Status & Subscription Display

Added:

```text
DV Quick Run: License Status
```

The status command now shows:

* plan
* entitlement state
* activation source
* subscription status
* last verification
* refresh due date
* grace period
* enabled capabilities
* Pathfinder recognition where applicable

Online recurring subscriptions now display:

```text
Subscription: Active
```

instead of a misleading unspecified expiry date.

---

## 🟦 Pathfinder Early Supporter Recognition

Added Pathfinder recognition for eligible Early Bird licenses.

Eligible activations display:

```text
DVQR Pathfinder • Early Supporter
```

Pathfinder is recognition only.

It does not change operational evidence, investigation authority, or capability semantics.

---

## 📴 Offline Pro License Import

Added Offline Pro signed-license support through:

```text
DV Quick Run: Import Offline License
```

Offline Pro supports restricted, disconnected, and air-gapped environments through signed local license validation.

Offline licensing:

* validates locally
* does not require runtime internet access
* grants capability manifests from signed license payloads
* degrades calmly to Free if invalid or expired

---

## 🧩 Capability Runtime Foundations

Introduced capability-driven runtime foundations for Pro acceleration.

DVQR now resolves workflow availability through capability IDs such as:

* `crossEnvironmentDiff`
* `timelineDiff`
* `comparisonReportExport`
* `investigationHandoffExport`
* `snapshotReplay`
* `runtimeBehaviourDrift`
* `identityParticipationDrift`
* `exportDvburArtifact`

This reinforces the architecture:

```text
entitlement
→ capability manifest
→ runtime capability checks
```

instead of scattered plan checks.

---

## 🔒 Commercial Boundary Hardening

Strengthened Free vs Pro behaviour across commercial workflows.

Free remains focused on foundational operational understanding.

Pro enables accelerated workflows such as:

* real Cross-Environment Diff
* Timeline Diff
* Snapshot replay
* comparison report exports
* Investigation Handoff exports
* runtime behaviour drift
* identity participation drift
* DV Bulk Upsert Runner artifact export

Capability boundaries now use calmer wording and preserve Free investigation continuity.

---

## 📦 Result Viewer → DVBUR Artifact Export

Added a new Result Viewer export workflow for generating DV Bulk Upsert Runner artifacts from query results.

Result Viewer can now export selected/query result records into a DVBUR-compatible artifact for downstream bulk upsert workflows.

This supports the emerging DV ForgeLab ecosystem pattern:

```text
DVQR investigates
→ DVBUR executes focused bulk upsert workflows
```

The export remains explicit and user-triggered.

It does not perform bulk updates directly from DVQR.

Behaviour:

* export starts from Result Viewer evidence/results
* generated artifact is intended for DV Bulk Upsert Runner
* DVQR remains investigation-first
* DVBUR remains the focused execution utility
* no automatic remediation or hidden data mutation occurs

This reinforces the product boundary:

```text
DVQR observes and prepares.
DVBUR performs focused bulk upsert execution.
```

---

## 🧯 Fail-Closed Entitlement Behaviour

Improved entitlement failure handling.

Invalid, expired, unreadable, unavailable, or unknown entitlement states now degrade safely to Free behaviour.

DVQR avoids:

* fail-open Pro capability leakage
* aggressive lockout wording
* operational evidence loss
* subscription panic messaging
* hidden commercial branching

Foundational workflows remain available.

---

## 🛡️ Product Guard for License Activation

Online activation now validates that the license belongs to:

```text
DV Quick Run Pro
```

This prevents unrelated Lemon Squeezy license keys from unlocking DVQR Pro capabilities.

---

## 🧪 Internal Development Command Hardening

Internal entitlement seed/cache commands are no longer exposed as normal production Command Palette entries.

Developer support commands remain development-only and are not part of the public commercial activation surface.

---

## 🌐 Website & Pricing Readiness

Aligned extension commercial surfaces with the public DVQR pricing model:

* Free
* Pathfinder Early Bird
* Pro Monthly
* Pro Annual
* Offline Annual

Pricing links now point to the DV Quick Run pricing page rather than embedding payment-provider details throughout the extension.

---

## 🧭 Architectural Invariants Reinforced

This release reinforces:

* Free preserves operational understanding
* Pro accelerates serious workflows
* Pathfinder recognises support, not authority
* Offline Pro keeps restricted environments first-class
* entitlement failure must not become operational failure
* commercial activation governs acceleration, not operational truth
* DVQR observes operational drift and does not fix operational drift

---

## 🎯 Summary

DV Quick Run v0.12.5 establishes the commercial activation foundation for DVQR Pro.

DVQR can now:

* activate Online Pro licenses
* import Offline Pro signed licenses
* recognise Pathfinder early supporters
* resolve capabilities through entitlement manifests
* safely degrade to Free when entitlement state is unavailable
* preserve commercial boundaries without compromising operational trust
* export DVBUR artifacts for downstream DV Bulk Upsert Runner execution workflows

This release moves DVQR from:

```text
operational comparison and report maturity
```

toward:

```text
commercially sustainable operational acceleration
```

while preserving the core DVQR trust model.

# DV Quick Run v0.12.4 — Investigation Report Export Maturity, Verification Handoff UX & Operational Evidence Presentation

This release matures DV Quick Run’s operational comparison platform from:

```text
interactive operational verification
```

→ into:

```text
investigation-ready operational reporting and verification handoff
```

DV Quick Run can now:

* export calmer, investigation-oriented operational reports
* generate verification-ready PDF handoff packs
* preserve grouped evidence continuity across exported workflows
* support cleaner operational review coordination
* standardise operational evidence presentation across export surfaces
* separate operational investigation exports more coherently
* improve export discoverability without cluttering the comparison workspace

This release focuses heavily on:

* operational report maturity
* export workflow refinement
* PDF handoff readability
* evidence continuity presentation
* calmer enterprise verification UX
* operational report consistency
* investigation export discoverability

The goal is not static reporting or deployment certification.

It is:

* operational verification continuity
* explainable investigation exports
* calmer review workflows
* evidence-backed handoff semantics
* portable operational investigation context
* enterprise-scale investigation readability

DV Quick Run continues to reinforce:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

---

## 📄 Diff Findings Summary Report (Major)

Introduced a dedicated:

```text
Diff Findings Summary
```

operational export workflow.

The Diff Findings Summary provides:

* concise operational drift orientation
* grouped provider-backed findings
* significance breakdown summaries
* executive operational summaries
* verification-oriented operational interpretation
* calmer operational review readability

The report intentionally focuses on:

* strongest operational signals first
* grouped operational understanding
* review-oriented readability
* bounded operational evidence summaries

—not:

* exhaustive raw evidence dumping
* deployment certification
* remediation guidance
* authoritative root-cause claims

Behaviour:

* strongest operational meaning surfaces first
* grouped evidence remains explainable
* significance remains advisory-only
* operational interpretation remains evidence-backed

Results:

* dramatically improved executive review readability
* calmer operational triage workflows
* cleaner stakeholder-facing exports
* improved enterprise investigation portability

---

## 📦 Investigation Handoff Export Workflow (Major)

Expanded investigation export semantics into a dedicated:

```text
Investigation Handoff
```

workflow.

Investigation Handoff exports now better support:

* operational verification coordination
* escalation-oriented investigation continuity
* CAB/review-oriented workflows
* operational review checkpoints
* grouped operational evidence portability
* investigation replay context

Exports now preserve:

* grouped operational drift
* provider-backed evidence hierarchy
* operational significance interpretation
* verification boundary wording
* investigation continuity semantics

Behaviour:

* handoff remains advisory-only
* review state does not imply correctness
* operational evidence remains bounded and explainable
* strongest operational meaning remains prioritised

Results:

* stronger enterprise-scale review readiness
* improved investigation portability
* clearer operational verification workflows
* calmer operational escalation semantics

---

## 🧭 Export Workflow Consolidation & Toolbar Refinement

Refined export workflow discoverability throughout Cross-Environment Diff.

Previous export actions were:

* visually noisy
* operationally fragmented
* increasingly difficult to scale

Export workflows are now consolidated into:

```text
Reports
```

with structured export categories including:

* Diff Findings Summary
* Investigation Handoff
* HTML export
* PDF export

Behaviour:

* export workflows remain grouped and discoverable
* comparison workspace remains calmer
* report actions scale more coherently for future exports
* capability-aware export semantics remain preserved

Results:

* significantly cleaner comparison-toolbar UX
* reduced operational clutter
* improved export discoverability
* stronger enterprise polish

---

## 🧠 Operational Report Presentation Standardisation (Major)

Standardised operational evidence-card presentation across exported reports.

Refinements include:

* tighter grouped-card stacking
* consistent operational spacing
* standardised evidence rhythm
* calmer section separation
* compressed low-density card whitespace
* improved provider-title hierarchy
* cleaner representative evidence presentation

Operational report cards now render more consistently across:

* HTML exports
* PDF exports
* grouped provider sections
* representative evidence summaries
* high/medium/low significance rendering

Behaviour:

* grouped evidence remains visually coherent
* representative evidence remains readable under dense export scenarios
* strongest operational signals remain visually prioritised

Results:

* dramatically improved export readability
* cleaner enterprise report presentation
* calmer operational scanning
* stronger psychological trust

---

## 🖨️ PDF Layout & Pagination Refinement

Refined PDF export rendering behaviour throughout operational handoff workflows.

Improvements include:

* tighter evidence-card pagination
* reduced orphaned provider sections
* cleaner card-flow continuity
* improved section-break spacing
* more consistent footer positioning
* refined provider-summary spacing
* calmer operational print rhythm
* reduced visual dead-space

Behaviour:

* grouped operational evidence remains readable under print workflows
* representative evidence remains visually connected
* exported investigations preserve operational continuity more coherently

Results:

* significantly improved PDF readability
* cleaner printed investigation packs
* improved CAB/review usability
* stronger enterprise export quality

---

## 🎨 Operational Verification UX Refinement

Refined operational wording and export semantics throughout comparison-report workflows.

Improvements include:

* calmer export naming
* clearer report semantics
* improved verification-boundary wording
* refined executive-summary hierarchy
* cleaner comparison-scope visibility
* stronger operational evidence readability
* softer operational review posture wording

Additional refinements:

* operational interpretation remains visually prioritised
* grouped evidence summaries remain concise and explainable
* export workflows remain investigation-oriented rather than compliance-oriented

Results:

* stronger operational trust
* calmer enterprise verification UX
* improved report readability
* cleaner operational investigation flow

---

## 🔒 Capability-Aware Export Semantics Refinement

Refined export capability-awareness semantics for Free Preview and Pro workflows.

Behaviour:

* Free Preview can continue exporting mock/sample operational reports
* real operational export continuity remains capability-aware
* understanding remains visible before acceleration workflows
* operational export semantics remain calm and contextual

Results:

* stronger open-core consistency
* clearer workflow progression
* improved preview believability
* preserved DVQR investigation philosophy

---

## 🧪 Stability & Validation

Verified:

* Diff Findings Summary exports
* Investigation Handoff exports
* HTML report rendering
* PDF report rendering
* grouped evidence stacking
* provider spacing consistency
* export toolbar workflows
* report-menu interaction behaviour
* operational pagination continuity
* representative evidence rendering
* significance-card presentation
* export workflow consistency

Validated against:

* dense enterprise comparison datasets
* grouped operational drift scenarios
* replayed snapshot workflows
* long-form PDF exports
* multi-provider operational comparisons
* investigation-handoff review workflows

No regression in:

* Cross-Environment Diff
* Timeline Diff
* Snapshot Library
* Operational Profiles
* Access Context
* Result Viewer
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DV Quick Run operational investigation invariants:

* operational reporting remains observational
* exports preserve evidence continuity
* grouped evidence remains explainable
* strongest operational meaning surfaces first
* verification does not imply remediation authority
* exported evidence remains bounded and inspectable
* operational investigation continuity must remain calm and navigable

Operational reporting continues to prioritise:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* export calmer operational investigation summaries
* generate enterprise-grade investigation handoff reports
* preserve grouped operational evidence continuity across exports
* standardise operational report presentation more coherently
* coordinate operational verification workflows more cleanly
* improve enterprise-scale PDF readability
* consolidate export workflows into calmer comparison UX

This release further matures DV Quick Run’s evolution into:

```text
an operational investigation, verification and evidence-handoff workbench
```

for enterprise Dataverse environments.

---

# DV Quick Run v0.12.3 — Operational Verification Guidance, Evidence Continuation & Investigation Handoff

This release evolves DV Quick Run’s operational comparison platform from:

```text
calm operational drift triage
```

→ into:

```text
interactive operational verification and investigation continuity
```

DV Quick Run can now:

* investigate operational drift inline without losing comparison context
* continue investigation directly from evidence signals
* preserve grouped evidence continuity under dense enterprise comparisons
* capture operational review state across investigation workflows
* support calmer verification-oriented operational reasoning
* provide bounded live evidence continuation from comparison surfaces
* support investigation handoff semantics more coherently
* preserve explainable operational context during replay and export workflows

This release focuses heavily on:

* operational verification workflows
* inline evidence continuation
* grouped evidence continuity
* review-state persistence
* operational investigation handoff
* enterprise-scale comparison readability
* bounded live operational continuation
* calmer operational UX under dense comparison scenarios

The goal is not remediation, deployment automation, or authoritative security analysis.

It is:

* operational verification
* investigation continuity
* explainable operational drift reasoning
* bounded live operational exploration
* calmer review workflows
* evidence-backed investigation guidance

DV Quick Run continues to reinforce:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

---

## 🔎 Inline Evidence Continuation & Operational Verification (Major)

Introduced inline operational evidence continuation directly inside comparison workflows.

Operational drift evidence can now:

* continue into bounded live Dataverse investigation
* surface operational context inline
* preserve comparison continuity during exploration
* avoid disconnected investigation workflows
* retain operational evidence anchors during live continuation

Examples include:

* solution participation evidence
* workflow/runtime participation evidence
* identity participation evidence
* grouped operational drift evidence
* metadata-oriented operational evidence

Behaviour:

* inline continuation remains bounded and evidence-backed
* live continuation never replaces captured comparison evidence
* unavailable continuation paths degrade calmly
* investigation continuity remains local to the comparison workflow

Results:

* dramatically improved operational investigation flow
* reduced context switching
* stronger operational verification continuity
* clearer operational drift understanding

---

## 🧠 Grouped Evidence Continuation & Dense Drift Investigation (Major)

Expanded grouped operational drift rendering into interactive investigation surfaces.

Grouped operational sections can now:

* preserve representative evidence continuity
* continue investigation from grouped operational signals
* surface representative operational context inline
* retain grouped operational explainability under dense comparison scenarios

Examples include:

```text
Minor identity matching signals
```

```text
Microsoft Platform Solutions
```

```text
Minor workflow metadata signals
```

Behaviour:

* grouped operational evidence remains explainable
* representative operational signals remain inspectable
* grouped operational evidence never silently disappears
* grouped investigation remains bounded and provider-owned

Results:

* significantly improved dense enterprise investigation UX
* calmer operational triage workflows
* stronger grouped evidence trustworthiness
* improved operational continuity under high-density comparison scenarios

---

## 👥 Identity Participation Investigation Continuation Expansion

Expanded Identity Participation Drift into deeper operational investigation continuity workflows.

Identity participation evidence can now:

* continue into bounded live operational identity pivots
* preserve grouped identity continuity
* surface representative operational participation context inline
* support calmer identity-oriented verification workflows

Behaviour:

* identity continuation remains observational and advisory-only
* participation does not imply effective access
* operational identity context remains bounded
* grouped identity rendering remains progressively explorable

Results:

* clearer operational participation understanding
* calmer identity-oriented investigation workflows
* reduced repetitive identity evidence rendering
* stronger operational access-topology orientation

---

## ✅ Operational Review State & Verification Workflow Foundations (Major)

Introduced operational review-state semantics for comparison workflows.

Comparison investigations now support:

* reviewed operational drift tracking
* verification-oriented operational workflows
* review-state continuity
* grouped review persistence
* investigation reset workflows
* calmer operational review coordination

Behaviour:

* review state remains investigation-oriented only
* reviewed drift does not imply operational correctness
* operational verification remains advisory-only
* comparison evidence remains fully inspectable after review

Results:

* stronger operational review workflows
* clearer investigation progress visibility
* calmer verification-oriented UX
* improved investigation handoff readiness

---

## 🧭 Investigation Workspace Continuity & Handoff Refinement

Expanded operational comparison workflows into a more coherent investigation workspace model.

Comparison workflows now better support:

* Findings
* Verification
* Handoff
* operational investigation continuity
* review-oriented comparison coordination
* operational evidence portability

Behaviour:

* operational investigation remains evidence-first
* strongest operational meaning surfaces before raw evidence
* comparison continuity remains preserved during live pivots
* operational review context remains local and explainable

Results:

* stronger operational investigation coherence
* calmer enterprise-scale review workflows
* improved operational readability
* clearer investigation handoff semantics

---

## ⚙️ Live Evidence Continuation Hardening & Operational Stability

Refined live operational evidence continuation behaviour across dense comparison scenarios.

Improvements include:

* bounded live continuation routing
* calmer unavailable-state handling
* grouped evidence continuation hardening
* prefixed entity logical-name handling
* repeated evidence-row identity isolation
* inline result routing stabilisation
* grouped evidence interaction consistency

Behaviour:

* unavailable live pivots degrade calmly
* captured comparison evidence always remains available
* operational continuation never blocks comparison readability
* repeated evidence signals remain independently addressable

Results:

* significantly improved investigation reliability
* calmer operational UX under enterprise-scale comparisons
* stronger live-continuation trustworthiness
* reduced operational investigation ambiguity

---

## 🎨 Operational Verification UX Refinement

Refined operational comparison and verification presentation throughout comparison workflows.

Improvements include:

* calmer operational continuation wording
* stronger inline evidence readability
* improved grouped investigation hierarchy
* cleaner operational verification spacing
* refined review-state presentation
* softer operational investigation posture wording
* improved enterprise-scale comparison scanability

Results:

* stronger psychological trust
* calmer verification-oriented investigation UX
* improved operational readability
* clearer operational investigation flow

---

## 🧪 Stability & Validation

Verified:

* inline evidence continuation workflows
* grouped evidence continuation workflows
* live Dataverse continuation behaviour
* grouped identity investigation continuity
* operational review-state persistence
* review reset workflows
* Findings / Verification / Handoff workspace continuity
* repeated grouped evidence interaction
* prefixed entity logical-name continuation handling
* dense enterprise comparison rendering

Validated against:

* large enterprise solution drift datasets
* grouped identity participation drift
* workflow/runtime orchestration drift
* Microsoft/platform-layer comparison grouping
* dense operational comparison scenarios
* replayed snapshot investigation workflows
* real Dataverse dogfooding environments

No regression in:

* Snapshot Library
* Timeline Diff
* Cross-Environment Diff
* Operational Profiles
* Access Context
* Result Viewer
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DV Quick Run operational investigation invariants:

* operational drift remains observational
* verification does not imply remediation authority
* participation does not imply causality or effective access
* grouped evidence remains explainable and inspectable
* providers own operational comparison semantics
* live continuation remains bounded
* strongest operational meaning surfaces first
* operational investigation continuity must remain calm and navigable

Operational investigation continues to prioritise:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* continue operational investigations directly from comparison evidence
* preserve grouped evidence continuity under dense enterprise comparison workloads
* support calmer verification-oriented operational workflows
* coordinate operational review-state continuity
* maintain inline operational context during live investigation pivots
* preserve explainable operational drift semantics during investigation handoff workflows
* scale enterprise operational comparison workflows more coherently

This release further matures DV Quick Run’s evolution into:

```text
an operational investigation, verification and drift-triage workbench
```

for enterprise Dataverse environments.

---

# DV Quick Run v0.12.2 — Operational Drift Triage, Evidence Compression & Dense Investigation Readability

This release matures DV Quick Run’s operational comparison platform from:

```text
runtime-aware operational drift investigation
```

→ into:

```text
calm, evidence-backed operational drift triage
```

DV Quick Run can now:

* group dense operational drift surfaces more coherently
* compress lower-priority evidence without hiding it
* preserve evidence continuity under large comparison workloads
* prioritise operationally meaningful drift more intelligently
* reduce Microsoft/platform-layer comparison noise
* scale comparison readability more safely at enterprise density
* preserve bounded operational semantics during evidence compression

---

## 🧠 Grouped Operational Surface & Dense Investigation Continuity (Major)

Introduced grouped operational surface rendering for dense comparison scenarios.

Comparison providers can now:

* surface highest-priority operational drift first
* progressively group lower-priority evidence
* preserve representative evidence visibility
* retain export continuity for grouped drift
* reduce repetitive operational rendering noise

Behaviour:

* strongest operational signals remain expanded
* lower-priority evidence becomes progressively grouped
* grouped evidence remains inspectable and explainable
* JSON/HTML export preserves full operational continuity
* provider semantics remain bounded and provider-owned

Results:

* dramatically improved enterprise-scale readability
* calmer operational triage workflows
* reduced operational cognitive overload
* stronger signal-to-noise ratio

---

## 🏷️ Operational Significance Tuning & Platform Noise Reduction

Refined comparison significance semantics across dense operational providers.

DV Quick Run now more intelligently distinguishes:

* Microsoft/platform package drift
* patch/cumulative-layer drift
* backup/archive-oriented package drift
* custom operational solution drift
* runtime-impacting orchestration drift

Behaviour:

* Microsoft/platform-layer drift defaults lower operational priority
* patch/cumulative-layer evidence becomes progressively grouped
* custom operational drift remains visually prioritised
* runtime orchestration changes remain high visibility

Results:

* calmer operational comparison surfaces
* reduced false operational urgency
* clearer custom/runtime signal visibility

---

## 📦 Evidence-Backed Grouped Drift Cards (NEW)

Introduced evidence-backed grouped operational drift cards.

Grouped operational sections now surface:

* classification rationale
* grouped evidence summaries
* operational-priority explanation
* representative evidence signals
* grouped direction summaries
* evidence continuity semantics

Examples include:

```text
Microsoft Platform Solutions (18)
```

```text
Minor workflow metadata signals (3)
```

```text
Minor plugin configuration signals (2)
```

Behaviour:

* grouped cards remain evidence-backed
* grouped summaries remain explainable
* representative signals remain visible
* grouped evidence never silently disappears

---

## 👥 Identity Participation Drift Grouping Refinement

Expanded Identity Participation Drift rendering semantics.

Identity comparison workflows now support:

* lighter-touch grouped identity evidence
* grouped minor team/role matching drift
* representative identity continuity summaries
* calmer participation-density rendering

Behaviour:

* meaningful participation-density changes remain expanded
* lower-confidence/minor identity matching becomes grouped
* matching remains confidence-based and advisory-only

Results:

* cleaner operational identity comparison UX
* reduced repetitive identity rendering
* stronger participation-topology understanding

---

## ⚙️ Provider-Owned Dense Drift Semantics (Major)

Expanded provider-owned operational grouping semantics.

Dense rendering is now provider-specific across:

* Plugin Step Runtime Behaviour Drift
* Workflow / Automation Participation Drift
* Solution Participation Drift
* Identity Participation Drift
* Operational Profile Drift

Behaviour:

* providers own their own grouping thresholds
* sparse comparisons remain fully expanded
* dense comparisons become progressively curated

Results:

* stronger provider-level operational coherence
* calmer comparison scalability
* improved dense-report consistency

---

## 🎨 Operational Comparison UX & Spacing Refinement

Refined dense operational comparison presentation and grouped-card readability.

Improvements include:

* calmer grouped-card spacing
* stronger operational hierarchy
* improved grouped metadata readability
* cleaner evidence rhythm
* softer grouped investigation posture wording

Results:

* significantly improved operational readability
* calmer enterprise investigation UX
* stronger psychological trust

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DV Quick Run operational comparison invariants:

* grouped evidence remains evidence-backed
* operational drift remains observational
* providers own operational comparison semantics
* strongest operational meaning surfaces first
* evidence remains inspectable and explainable
* dense operational evidence must remain navigable

Operational comparison continues to prioritise:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* group dense operational drift more coherently
* preserve evidence continuity under grouped rendering
* reduce Microsoft/platform comparison noise safely
* prioritise runtime-impacting operational drift more intelligently
* scale enterprise comparison readability more calmly
* compress dense evidence without hiding operational context

This release further matures DV Quick Run’s evolution into:

```text
an operational investigation and drift triage workbench
```

for enterprise Dataverse environments.

---

# DV Quick Run v0.12.1 — Runtime Behaviour Drift, Investigation Replay & Operational Comparison Maturity

This release evolves DV Quick Run’s comparison platform from:

```text
comparison foundations
```

→ into:

```text
runtime-aware operational drift investigation
```

DV Quick Run can now:

* investigate runtime behaviour drift more meaningfully
* replay operational comparisons from Snapshot Library
* preserve investigation continuity across comparison sessions
* compare operational subjects with stronger scope awareness
* surface curated operational drift signals
* coordinate comparison workflows more calmly at enterprise scale
* preserve bounded operational semantics under dense drift scenarios

This release focuses heavily on:

* runtime behaviour drift
* operational replayability
* comparison continuity
* evidence compression
* operational readability
* investigation scalability
* calmer enterprise comparison UX

The goal is not deployment validation or remediation.

It is:

* operational drift understanding
* runtime-aware investigation
* replayable operational continuity
* explainable drift interpretation
* bounded comparison semantics
* scalable operational investigation workflows

DV Quick Run continues to reinforce:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

---

## ⚙️ Plugin Step Runtime Behaviour Drift (Major)

Introduced dedicated Plugin Step Runtime Behaviour Drift comparison support.

DV Quick Run can now compare:

* plugin step registration drift
* plugin step enable/disable state drift
* pipeline/stage drift
* synchronous vs asynchronous execution drift
* execution order drift
* managed/unmanaged drift
* plugin step participation additions/removals

Examples include:

* step enabled in DEV but disabled in SIT
* synchronous → asynchronous execution drift
* stage migration (Pre-operation → Post-operation)
* missing runtime participation in target environments
* newly introduced orchestration participation

Behaviour:

* runtime semantics remain observational
* plugin registration evidence remains explainable
* runtime interpretation remains bounded
* drift does not imply outage certainty
* provider semantics remain operationally contextual

Results:

* stronger runtime orchestration visibility
* clearer plugin execution understanding
* improved operational investigation continuity
* reduced manual registration comparison effort

---

## 🔄 Workflow / Automation Runtime Drift Expansion

Expanded Workflow / Automation comparison semantics.

Workflow comparison now surfaces:

* workflow additions/removals
* activation-state drift
* owner drift
* orchestration participation drift
* category/type drift
* operational automation participation changes

Examples include:

* disabled workflow in target
* orchestration ownership changes
* automation participation drift between environments
* missing automation participation

Behaviour:

* workflow comparison remains bounded
* no deep clientdata/designer payload diffing
* no deployment recommendation semantics
* orchestration interpretation remains advisory-only

Results:

* stronger orchestration visibility
* calmer workflow comparison semantics
* improved automation investigation readability
* clearer operational participation understanding

---

## 🧠 Curated Operational Drift Signals (NEW)

Introduced Top Operational Drift Signals.

Comparison surfaces now prioritise:

* highest-significance operational drift
* strongest runtime differences
* orchestration-impacting participation changes
* operationally meaningful comparison summaries

Behaviour:

* strongest signals surface first
* lower-priority evidence remains progressively explorable
* summaries remain provider-owned and explainable
* operational interpretation precedes raw evidence

Examples include:

* managed → unmanaged drift
* plugin execution pipeline drift
* orchestration participation changes
* broad operational density changes

Results:

* significantly improved scanability
* reduced operational cognitive overload
* stronger enterprise-scale comparison readability
* calmer operational prioritisation

---

## 📚 Investigation Replay & Recent Comparison History (Major)

Expanded Snapshot Library into a replayable operational investigation workspace.

Snapshot Library now supports:

* recent comparison replay
* grouped comparison history
* comparison replay continuity
* comparison-history cleanup
* comparison-scope grouping
* bounded replay history rendering

Recent comparisons are now grouped by:

* operational subject
* comparison scope
* environment comparison stream

Examples include:

```text
Account
├─ DEV → SIT
├─ DEV → DEV
└─ DEV → SIT
```

Behaviour:

* replay remains lightweight and explicit
* history cleanup does not delete snapshots
* replay history remains bounded and scrollable
* operational continuity remains preserved

Results:

* dramatically improved comparison replay UX
* stronger operational continuity
* calmer enterprise-scale history management
* reduced Snapshot Library clutter

---

### 🎭 Replayable Operational Workflow Preview (Expanded)

Refined Free Preview comparison workflows to support replayable mock operational investigations.

Free Preview now supports:

* replayable mock comparison sessions
* mock snapshot source/target selection
* sample operational drift exploration
* grouped sample replay history
* bounded replay-history rendering
* replay-history cleanup for sample investigations

Behaviour:

* mock/sample investigations remain explorable in Free Preview
* real operational comparison continuity remains Pro-only
* understanding remains visible before acceleration workflows
* replay history remains grouped and operationally scoped

Results:

* stronger operational workflow preview semantics
* more believable Free Preview experience
* clearer comparison mental-model onboarding
* improved operational continuity discoverability

---

## 🧭 Comparison Scope Awareness & Subject Validation (Major)

Introduced explicit operational comparison scope semantics.

Cross-Environment Diff now surfaces:

* operational comparison subject
* source/target comparison scope
* scope-aware comparison session identity
* scope-aware export naming

Examples include:

```text
Cross-Environment Diff: Contact • DEV → SIT
```

DV Quick Run now also detects:

* mismatched comparison subjects
* unrelated operational comparison scopes

Examples include:

```text
Appointment → Contact
```

Behaviour:

* mismatched scopes surface warnings before comparison
* users may still explicitly continue comparison
* operational scope remains visually reinforced during investigation

Results:

* safer operational comparison semantics
* reduced accidental invalid comparisons
* clearer investigation trust
* stronger comparison coherence

---

## 🏷️ Runtime Drift Title Tightening & Narrative Refinement

Refined operational drift wording throughout comparison providers.

Improvements include:

* tighter operational titles
* stronger actionability
* reduced wording redundancy
* clearer runtime drift summaries
* calmer provider descriptions

Examples:

Before:

```text
Plugin step state changed: Account Create Validation
```

After:

```text
Account Create Validation plugin state changed (Enabled → Disabled)
```

Before:

```text
Power Pages Runtime Core managed state changed
```

After:

```text
Power Pages Runtime Core changed from Managed → Unmanaged
```

Behaviour:

* strongest operational fact appears first
* evidence detail remains secondary
* summaries remain concise and scannable

Results:

* significantly improved operational readability
* stronger comparison scanability
* cleaner enterprise reporting UX
* reduced visual fatigue

---

## 🧩 Progressive Disclosure & Density Handling Refinement

Refined operational comparison rendering under dense drift scenarios.

Added/refined:

* default collapse behaviour for large result sets
* High-significance-first expansion
* grouped operational summaries
* back-to-top investigation anchors
* bounded comparison density rendering
* calmer provider-card spacing

Behaviour:

* High significance drift expands automatically
* Medium/Low drift remains collapsed by default
* provider summaries appear before detailed evidence
* dense comparison sessions remain navigable

Results:

* dramatically improved scalability
* calmer operational investigation flow
* reduced enterprise comparison overload
* stronger operational readability under 30–60+ drift scenarios

---

## 🔒 Snapshot Trust & Comparison Session Refinement

Expanded comparison session rendering and trust visibility.

Comparison sessions now surface:

* source snapshot identity
* target snapshot identity
* snapshot trust state
* comparison generation timestamps
* comparison continuity semantics

Examples include:

* Verified
* Modified
* Legacy / Unverified
* Invalid

Behaviour:

* modified snapshots remain inspectable
* trust state remains explicit
* operational continuity remains explainable

Results:

* stronger operational trustworthiness
* safer replay semantics
* clearer investigation provenance
* improved comparison transparency

---

## 🎨 Operational Comparison UX Maturity

Refined operational comparison UX across:

* Cross-Environment Diff
* Timeline Diff
* Snapshot Library
* provider rendering
* replay workflows
* operational summaries

Improvements include:

* calmer operational hierarchy
* cleaner provider grouping
* stronger significance readability
* improved runtime evidence compression
* bounded scroll regions
* cleaner replay workflow presentation
* reduced operational visual noise
* improved enterprise-scale comparison scanability
* grouped replay-history scalability improvements

Additional refinements:

* grouped replay continuity
* quieter replay-history cleanup semantics
* stronger operational summary framing
* cleaner provider-navigation labelling

Results:

* more mature enterprise operational UX
* stronger psychological trust
* calmer operational comparison experience
* clearer runtime investigation flow

---

## 🧪 Stability & Validation

Verified:

* plugin runtime drift workflows
* workflow/automation runtime drift
* replay comparison workflows
* grouped recent comparison history
* comparison-history removal
* comparison-scope mismatch warnings
* scope-aware export naming
* provider significance rendering
* dense comparison rendering
* default collapse behaviour
* top operational drift signal rendering
* back-to-top navigation
* snapshot trust rendering

Validated against:

* DEV/SIT orchestration drift
* plugin registration drift
* managed/unmanaged solution drift
* workflow participation drift
* mocked operational baselines
* historical replay workflows
* dense enterprise-scale comparison scenarios

No regression in:

* Snapshot Library
* Timeline Diff
* Cross-Environment Diff
* Operational Profiles
* Access Context
* Result Viewer
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DV Quick Run operational comparison invariants:

* operational drift remains observational
* runtime participation does not imply root cause
* providers own operational comparison semantics
* strongest operational meaning surfaces first
* evidence remains inspectable and explainable
* operational comparison remains bounded
* replay workflows preserve operational continuity
* dense operational evidence must remain navigable
* understanding remains available before acceleration

Operational comparison continues to prioritise:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* compare runtime plugin behaviour operationally
* replay operational investigations from Snapshot Library
* preserve comparison continuity across operational workflows
* detect mismatched comparison subjects safely
* surface curated runtime drift signals
* compress dense operational evidence more calmly
* preserve enterprise-scale comparison readability
* coordinate operational replay workflows more coherently

This release establishes the foundation for:

* plugin image drift comparison
* secure/unsecure configuration participation drift
* environment variable drift
* connection reference participation drift
* richer orchestration runtime comparison
* deeper operational replay workflows
* enterprise-scale operational investigation continuity

---

# DV Quick Run v0.12.0 — Cross-Environment Diff, Snapshot Library & Operational Comparison Foundations

This release introduces the first full operational comparison workflow inside DV Quick Run.

DV Quick Run can now:

* capture operational investigation snapshots
* compare snapshots across environments
* compare historical snapshots within the same environment
* investigate operational drift using evidence-backed providers
* preserve investigation continuity through snapshot workflows
* coordinate comparison workflows through Snapshot Library
* distinguish Timeline Diff vs Cross-Environment Diff automatically

This release establishes the first production-ready version of:

```text
Operational Comparison Workflows
```

The goal is not deployment automation, remediation, or topology governance.

It is:

* operational drift understanding
* evidence-backed comparison
* calmer investigation continuity
* bounded operational comparison
* explainable operational change visibility
* investigation replay foundations

DV Quick Run continues to reinforce:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

---

## 🔄 Cross-Environment Diff (Major)

Introduced the first complete Cross-Environment Diff workflow.

DV Quick Run can now compare operational investigation snapshots across environments.

Examples include:

* DEV → SIT
* SIT → PROD
* DEV → PROD
* mocked operational baselines
* operational drift snapshots

Cross-Environment Diff surfaces:

* operational drift providers
* grouped operational differences
* significance classification
* evidence-backed comparison summaries
* provider-specific operational interpretation
* exportable operational comparison evidence

Operational comparison providers currently include:

* Operational Profile Drift
* Solution Participation Drift
* Workflow / Automation Participation Drift
* Identity Participation Drift

Behaviour:

* comparisons remain bounded and observational
* provider semantics remain explainable
* comparison surfaces preserve evidence continuity
* operational interpretation remains advisory-only
* no deployment recommendation is generated
* no automatic remediation semantics exist

Results:

* clearer operational drift visibility
* stronger environment comparison understanding
* calmer operational investigation workflows
* reduced manual comparison effort
* stronger operational continuity across environments

---

## ⏱️ Timeline Diff (NEW)

Introduced Timeline Diff for same-environment historical comparison.

When snapshots originate from the same environment, DV Quick Run now automatically opens:

```text
Timeline Diff
```

instead of:

```text
Cross-Environment Diff
```

Timeline Diff focuses on:

* historical operational change
* investigation continuity
* orchestration drift over time
* operational density evolution
* operational participation changes

Behaviour:

* environment-aware comparison naming is automatic
* same-environment snapshots preserve timeline semantics
* different-environment snapshots preserve cross-environment semantics
* operational comparison providers remain reusable across both modes

Results:

* clearer comparison intent
* stronger historical investigation semantics
* calmer operational terminology
* improved operational mental model consistency

---

## 📚 Operational Snapshot Library (Major)

Introduced Snapshot Library — a dedicated operational comparison coordination surface.

Snapshot Library can now:

* store operational investigation snapshots locally
* group snapshots by environment
* group snapshots by subject/entity
* coordinate source/target comparison workflows
* launch Timeline Diff and Cross-Environment Diff workflows
* support operational snapshot comparison continuity

Snapshot Library surfaces:

* saved snapshot counts
* environment grouping
* subject grouping
* snapshot recency
* source/target selection
* latest vs previous comparison actions
* snapshot search and filtering

Behaviour:

* snapshots remain local operational investigation artifacts
* snapshots are not deployment authority
* comparisons remain explicit and user-triggered
* workflows preserve investigation continuity semantics

Results:

* stronger operational replay workflows
* easier comparison coordination
* calmer operational investigation continuity
* improved operational comparison discoverability

---

## 🧠 Operational Drift Providers (NEW)

Introduced provider-driven operational comparison semantics.

Comparison providers now own:

* domain-specific operational meaning
* significance interpretation
* grouped drift summaries
* evidence-backed operational interpretation
* operational comparison rendering

Examples include:

* DVQR Score changes
* orchestration participation drift
* workflow participation changes
* relationship density changes
* solution participation differences
* operational identity participation drift

Behaviour:

* providers remain bounded and explainable
* strongest operational signals surface first
* grouped summaries appear before raw evidence
* provider semantics remain reusable across comparison modes

Results:

* calmer operational comparison UX
* stronger operational readability
* improved signal-to-noise ratio
* foundation for future comparison providers

---

## 🏷️ Significance Classification & Operational Drift Semantics

Operational comparison surfaces now classify drift using bounded significance semantics.

Current classifications include:

* Low significance
* Medium significance
* High significance

Behaviour:

* significance remains heuristic and advisory-only
* operational drift is evidence-backed
* significance does not imply outage severity
* strongest operational changes surface first

Comparison summaries now surface:

* provider contribution counts
* grouped operational drift categories
* operational density changes
* orchestration participation drift
* evidence-backed operational summaries

Results:

* clearer operational prioritisation
* calmer operational interpretation
* improved investigation readability
* stronger comparison trustworthiness

---

## 🔒 Pro Preview & Capability Awareness Foundations

Introduced the first operational comparison capability-awareness flows.

Free workflows now support:

* mock snapshot exploration
* sample operational drift investigation
* Timeline Diff preview exploration
* Cross-Environment Diff preview exploration

Pro workflows unlock:

* real snapshot imports
* saved snapshot management
* full comparison workflows
* operational comparison exports
* operational snapshot continuity

Behaviour:

* capability awareness remains calm and contextual
* understanding remains visible in Free
* acceleration workflows remain capability-gated
* operational terminology remains subtle and non-disruptive

Examples include:

* `PRO PREVIEW · SNAPSHOT LIBRARY`
* `PRO PREVIEW · CROSS-ENVIRONMENT DIFF`
* `PRO · TIMELINE DIFF`
* `PRO · CROSS-ENVIRONMENT DIFF`

Results:

* stronger open-core consistency
* clearer workflow progression
* calmer capability awareness semantics
* preserved “never gate understanding” philosophy

---

## 🌐 DVQR GitHub Discussions Integration (NEW)

Added DV Quick Run GitHub Discussions integration into operational comparison workflows.

Operational comparison surfaces now include contextual community entry points.

Examples include:

* Snapshot Library footer links
* comparison workflow discussion prompts
* Hub community surfaces

Discussion guidance now supports:

* feature feedback
* operational drift workflow discussion
* bug reporting
* comparison-provider suggestions
* investigation workflow ideas
* roadmap discussion

Behaviour:

* community prompts remain lightweight
* operational workflows remain primary
* links appear contextually near comparison workflows

Results:

* stronger community discoverability
* improved operational feedback loops
* clearer roadmap participation pathways
* easier comparison-workflow discussion continuity

---

## 🎨 Operational Comparison UX Refinement

Refined operational comparison rendering and workflow presentation.

Improvements include:

* calmer comparison terminology
* stronger workflow hierarchy
* grouped operational drift presentation
* clearer source/target semantics
* provider grouping refinement
* snapshot comparison spacing improvements
* cleaner significance presentation
* reduced visual noise
* stronger operational readability

Additional refinements:

* Timeline Diff wording for same-environment workflows
* comparison subject semantics refinement
* improved operational grouping consistency
* cleaner operational evidence hierarchy
* calmer provider-card presentation

Results:

* more professional operational comparison UX
* reduced cognitive overload
* stronger operational investigation continuity
* clearer comparison readability

---

## 🧪 Stability & Validation

Verified:

* Snapshot Library workflows
* source/target snapshot selection
* Timeline Diff workflows
* Cross-Environment Diff workflows
* provider grouping behaviour
* significance classification rendering
* operational drift summaries
* mock snapshot workflows
* Pro Preview capability-awareness behaviour
* snapshot search/filter behaviour
* GitHub Discussions integration
* export workflows

Validated against:

* DEV/SIT operational drift scenarios
* mocked orchestration drift datasets
* workflow participation drift
* operational density changes
* historical timeline comparison scenarios
* environment-aware comparison semantics

No regression in:

* Operational Profiles
* Access Context
* Result Viewer
* Execution Insights
* Guided Traversal
* Capability Explorer
* Query Doctor
* `$batch` execution
* Hub workflows

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DV Quick Run operational comparison invariants:

* operational comparison remains observational
* providers own domain-specific comparison semantics
* operational drift does not imply root cause
* evidence remains inspectable and explainable
* strongest operational signals surface first
* comparison workflows remain bounded
* snapshot workflows preserve operational continuity
* capability awareness remains calm and contextual
* understanding remains available before acceleration

Operational comparison continues to prioritise:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* capture and coordinate operational investigation snapshots
* compare operational drift across environments
* investigate timeline-based operational change
* group operational drift into provider-backed investigation surfaces
* preserve operational investigation continuity across comparison workflows
* distinguish Timeline Diff vs Cross-Environment Diff automatically
* surface explainable operational comparison semantics
* coordinate operational comparison workflows through Snapshot Library
* integrate community feedback pathways directly into operational comparison workflows

This establishes the foundation for:

* richer operational drift providers
* historical operational replay workflows
* future operational comparison evolution
* comparison export/import continuity
* evidence-backed operational topology comparison
* broader DVQR comparison-platform capabilities

---

# v0.11.6 — Platform Stabilisation, Open-Core Foundations & Pre-Comparison Hardening

This release stabilises the v0.11.5 identity-context expansion and prepares DV Quick Run for the v0.12.x comparison arc.

## Changed

* Refined Hub and Quickstart wording for calmer operational orientation.
* Added Access Context guidance to Quickstart.
* Improved public product-direction wording for future comparison workflows.
* Added comparison snapshot foundations for future bounded operational comparison without introducing live diff UI yet.
* Added shared operational renderer primitives for grouped/signal-style surfaces.
* Added boundary regression coverage for future capability separation.

## Governance

DVQR continues to preserve the boundary:

```text
DVQR continues to preserve the boundary between operational understanding and future acceleration workflows.
```

Cross-environment comparison remains observational, not remediation or deployment tooling.

---

# v0.11.5 — Business Unit Context, Application User Context & Operational Identity Expansion

This release expands the Access Context investigation family beyond:

```text
User
→ Team
→ Role
```

into broader:

```text
Business Unit
→ Application User
→ Operational Identity Participation
```

understanding.

DV Quick Run can now investigate:

* Business Units
* Application Users
* automation-oriented identities
* operational service participation
* bounded organizational operational topology
* operational role participation density
* identity-centric operational structure

The goal is not organizational administration, RBAC simulation, or hierarchy exploration.

It is:

* operational participation understanding
* bounded operational orientation
* calmer enterprise-scale investigation
* explainable identity topology visibility
* evidence-backed operational reasoning
* progressive operational investigation continuity

This release reinforces DVQR’s operational investigation philosophy:

```text
understanding
before
authority
```

while extending Access Context into richer operational identity participation surfaces.

---

## 🏛️ Business Unit Context (Major)

Introduced Business Unit Context investigation support.

DV Quick Run can now investigate:

* business units
* bounded business-unit participation topology
* operational role density
* application/service identity participation
* nearby operational team participation
* operational identity composition

Business Unit Context surfaces:

* business unit identity
* parent business unit
* bounded child participation counts
* direct role participation
* application/service identity participation
* operational participation summaries
* operational grouping semantics

Behaviour:

* Business Unit Context remains explicitly bounded
* no recursive organization traversal
* no environment-wide hierarchy crawling
* no access-authority interpretation
* no RBAC simulation
* no organizational administration semantics

Results:

* stronger operational organizational understanding
* clearer visibility into automation-heavy business units
* calmer enterprise-scale investigation flow
* safer operational topology interpretation

---

## 🤖 Application User Context (Major)

Introduced dedicated Application User Context investigation support.

DV Quick Run now distinguishes operational automation identities from standard interactive users.

Application User Context can investigate:

* application users
* service principals
* integration identities
* synchronization identities
* non-interactive automation identities
* operational service participation

Application User Context surfaces:

* identity classification
* access mode
* operational participation
* direct role participation
* inherited operational participation
* operational identity interpretation

Behaviour:

* preserves observed operational identity semantics only
* avoids responsibility/ownership claims
* does not imply operational causality
* does not infer effective access

Examples include:

* Power Automate identities
* Copilot identities
* AI Builder identities
* integration service accounts
* synchronization/service principals

Results:

* clearer automation-oriented operational understanding
* improved runtime identity visibility
* safer operational reasoning around service identities
* stronger Dataverse operational ecosystem understanding

---

## ⚡ Result Viewer → Business Unit Context Continuation (NEW)

Added direct operational continuation from Result Viewer into Business Unit Context.

Available on:

```text
businessunits.businessunitid
```

New Result Viewer action:

```text
OPERATE
→ Check Business Unit Context
```

Behaviour:

* preserves operational investigation continuity
* launches Business Unit investigation directly from row context
* avoids disconnected organizational investigation workflows
* keeps Result Viewer as the operational investigation workspace

Results:

* smoother operational topology investigation
* reduced context switching
* stronger investigation continuity
* clearer organizational operational exploration

---

## 🤖 Result Viewer → Application User Context Continuation (NEW)

Added dedicated operational continuation into Application User Context.

Application-oriented identities now launch:

```text
OPERATE
→ Check Application User Context
```

instead of generic user investigation flows.

Behaviour:

* application users remain operationally distinct from interactive users
* automation-oriented semantics remain preserved
* service/runtime identities render using Application User interpretation paths

Results:

* clearer automation investigation semantics
* safer runtime identity interpretation
* stronger operational identity differentiation
* improved execution-oriented investigation continuity

---

## 🧠 Operational Grouping & Key Signal Interpretation (Major)

Introduced grouped operational participation rendering for dense Business Unit investigations.

Business Unit Context now groups operational participation into bounded operational categories such as:

* Microsoft / Platform Service Roles
* Automation / Integration Roles
* AI / Copilot Roles
* Data / Analytics Roles
* Human-facing / Business Roles
* Custom / Organizational Roles

Business Unit Context also introduces:

```text
Key Signals
```

Examples include:

* automation-oriented identity density
* AI/Copilot participation
* integration-oriented participation
* elevated operational role participation
* broad operational orchestration signals

Behaviour:

* grouping remains heuristic and bounded
* grouping does not imply privilege equivalence
* interpretation remains advisory-only
* strongest operational meaning appears before raw evidence

Results:

* dramatically reduced cognitive overload
* calmer enterprise-scale investigation UX
* stronger operational readability
* improved operational signal-to-noise ratio

---

## 🧩 Progressive Disclosure & Evidence Hierarchy Refinement

Refined Business Unit and Application User rendering hierarchy around:

```text
Operational Significance
→ Key Signals
→ Participation
→ Grouped Evidence
→ Audit/debug Evidence
```

Behaviour:

* strongest operational meaning appears first
* dense evidence remains progressively explorable
* raw verification evidence remains preserved
* grouped participation mirrors grouped evidence structure

Additional refinements include:

* collapsed operational role groups
* capped preview rendering
* grouped evidence sections
* reduced evidence duplication
* calmer enterprise-scale rendering behaviour
* audit/debug demotion for canonical flat evidence lists

Results:

* significantly cleaner operational UX
* stronger investigation readability
* improved enterprise-scale usability
* safer operational evidence interpretation

---

## 🔍 Searchable Operational Evidence Expansion

Expanded searchable evidence behaviour across Business Unit and Application User investigations.

Added/refined:

* grouped evidence rendering
* bounded evidence previews
* searchable operational participation evidence
* auto-expansion of matched operational evidence sections
* improved application/service identity evidence readability

Behaviour:

* search remains bounded to the current investigation context only
* no hidden organizational crawling
* no recursive operational expansion

Results:

* easier evidence inspection
* stronger operational readability
* calmer investigation workflows under dense identity participation
* reduced cognitive overload

---

## 🎨 Operational UX Refinement

Refined operational wording and hierarchy throughout Business Unit and Application User Context workflows.

Improvements include:

* calmer operational terminology
* tighter operational significance summaries
* cleaner participation grouping
* stronger operational hierarchy consistency
* reduced raw-evidence overload
* improved progressive disclosure semantics
* cleaner operational investigation flow

Additional refinements:

* operational interpretation remains visually prioritised ahead of raw evidence
* grouped operational participation improves enterprise-scale readability
* audit/debug evidence is visually separated from primary operational understanding

Results:

* stronger psychological trust
* calmer operational investigation UX
* improved scanability under dense enterprise participation
* stronger bounded operational semantics

---

## 🧪 Stability & Validation

Verified:

* Business Unit Context investigations
* Application User Context investigations
* Result Viewer Business Unit continuation flows
* Result Viewer Application User continuation flows
* grouped operational role rendering
* grouped evidence rendering
* Key Signals rendering
* enterprise-scale business unit participation rendering
* progressive disclosure behaviour
* searchable evidence behaviour
* export workflows

Validated against:

* automation-heavy business units
* Power Automate identities
* Copilot identities
* AI Builder identities
* synchronization/integration identities
* enterprise-scale access datasets
* operationally dense application-user participation

No regression in:

* User Access Context
* Team Access Context
* Role Access Context
* Result Viewer
* Operational Profiles
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution
* Query Doctor

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DVQR operational investigation invariants:

* Business Unit Context is operational orientation, not organizational administration
* Application User Context preserves automation-oriented semantics
* participation does not imply authority or causality
* operational investigation remains bounded
* evidence remains inspectable and explainable
* operational interpretation remains heuristic and advisory-only
* progressive disclosure takes precedence over topology dumping
* Result Viewer remains the operational investigation workspace
* operational continuity takes precedence over disconnected tooling

Access Context continues to prioritise:

```text
understanding
before
authority
```

---

## 🎯 Summary

DV Quick Run can now:

* investigate Business Unit operational participation safely
* investigate automation/service identities coherently
* continue Business Unit investigations directly from Result Viewer
* distinguish Application User operational semantics from interactive users
* group dense operational participation into calmer operational categories
* surface Key Signals ahead of raw operational evidence
* preserve bounded and explainable operational topology understanding
* search and export operational participation evidence safely

This establishes the foundation for:

* broader operational organizational investigation
* deeper automation/runtime identity understanding
* future audit-oriented operational investigation
* operational topology continuity
* richer operational participation interpretation
* future environment and integration operational context workflows

---

# v0.11.4 — Team Access Context, Role Access Context & Identity Participation Expansion

This release expands the Access Context investigation family beyond individual users into broader operational identity participation understanding.

DV Quick Run can now investigate:

* Teams
* Security Roles
* inherited role participation
* operational access topology
* identity participation relationships

The goal is not RBAC simulation or security administration.

It is:

* operational identity investigation
* bounded access-topology understanding
* explainable participation visibility
* calmer access-oriented operational reasoning
* investigation continuity
* evidence-backed identity interpretation

This release evolves Access Context from:

```text
user-centric investigation
```

→ to:

```text
identity-centric operational participation investigation
```

while preserving DVQR’s core operational investigation invariants.

---

## 👥 Team Access Context (Major)

Introduced Team Access Context investigation support.

DV Quick Run can now investigate:

* owner teams
* access teams
* Azure AD group teams
* business-unit aligned teams
* direct team role participation
* operational team identity topology

Behaviour:

* Team Access Context remains bounded
* does not simulate effective access
* does not calculate privilege matrices
* preserves operational participation semantics only

Team Access Context surfaces:

* team type
* business unit alignment
* team membership indicators
* direct role participation
* operational participation interpretation

Results:

* clearer understanding of operational team identities
* improved investigation of shared/team-owned operations
* safer operational reasoning around inherited participation
* stronger operational topology visibility

---

## 🛡️ Role Access Context (NEW)

Introduced Role Access Context investigation support.

DV Quick Run can now investigate:

* Dataverse security roles
* role participation topology
* inherited operational role visibility
* team-linked role participation
* broad administrative role context
* operational access participation patterns

Role Access Context focuses on:

* participation understanding
* operational significance
* contextual investigation guidance

—not:

* effective-access simulation
* privilege auditing
* permission matrix generation
* security administration

Behaviour:

* roles are treated as operational participation context
* interpretation remains heuristic and bounded
* investigation remains evidence-backed and explainable

Results:

* easier understanding of operational role significance
* clearer inherited-role investigation
* stronger operational access interpretation
* calmer identity-topology reasoning

---

## ⚡ Result Viewer → Role Access Context Continuation (NEW)

Added direct operational continuation from Result Viewer into Role Access Context.

Available on:

```text
roles.roleid
```

New Result Viewer action:

```text
OPERATE
→ Check Role Access Context
```

Behaviour:

* preserves operational investigation continuity
* launches Role Access Context directly from row context
* avoids disconnected operational workflows
* keeps Result Viewer as the operational investigation workspace

Results:

* smoother role investigation flow
* reduced operational context switching
* stronger investigation continuity
* clearer operational role exploration

---

## 🧠 Expanded Operational Significance Interpretation

Expanded Access Context interpretation semantics across:

* users
* teams
* roles

Examples now include:

* broad administrative participation
* operational coordination teams
* automation-oriented identities
* integration/synchronization participation
* operationally elevated role participation
* scoped operational identities

Behaviour:

* interpretations remain bounded and heuristic
* avoids effective-access claims
* avoids authority/risk scoring
* preserves explainability and evidence-backed semantics

Examples:

```text
This role appears broadly operational in nature and may participate across multiple execution or administration workflows.
```

```text
This team appears aligned to shared operational coordination rather than lightweight collaboration semantics.
```

Results:

* stronger operational understanding
* clearer investigation meaning
* safer interpretation boundaries
* reduced raw-evidence interpretation burden

---

## 🧩 Access Context Family Consistency Refinement

Refined the Access Context architecture to support a consistent investigation model across:

```text
User
→ Team
→ Role
```

Shared behaviour now includes:

* progressive disclosure
* searchable evidence
* operational significance interpretation
* raw verification evidence
* export semantics
* investigation continuity
* bounded operational context

Behaviour:

* all Access Context investigations preserve the same operational semantics
* renderer behaviour remains consistent across identity types
* operational interpretation remains explainable and inspectable

Results:

* calmer investigation UX
* stronger mental model consistency
* improved cross-identity investigation flow
* safer long-term extensibility

---

## 🔍 Searchable Operational Evidence Improvements

Expanded searchable evidence behaviour across Team and Role Access Context investigations.

Added/refined:

* local evidence search
* search highlighting
* find-next navigation
* auto-expansion of matched sections
* searchable inherited-role participation evidence

Behaviour:

* search remains bounded to the current investigation context only
* no environment-wide identity crawling
* no hidden access-topology expansion

Results:

* easier evidence inspection
* stronger operational readability
* calmer enterprise-scale investigation UX
* reduced cognitive overload

---

## 📦 Operational Evidence Export Refinement

Expanded export support across the full Access Context family.

Supported exports:

* Copy Markdown
* Copy JSON
* Save Markdown
* Save JSON
* Save HTML

Behaviour:

* exports preserve operational interpretation structure
* raw evidence remains portable
* investigation semantics remain bounded and explainable

Results:

* improved operational investigation portability
* easier escalation and sharing workflows
* stronger investigation continuity foundations
* reusable operational evidence capture

---

## 🎨 Operational UX Refinement

Refined operational wording and hierarchy throughout Team and Role Access Context workflows.

Improvements include:

* calmer operational terminology
* clearer interpretation hierarchy
* refined evidence readability
* improved section collapsing behaviour
* reduced disclaimer repetition
* cleaner operational grouping semantics

Additional refinements:

* governance boundaries now appear more consistently
* operational interpretation remains visually prioritised ahead of raw evidence
* dense role/team participation evidence remains progressively explorable

Results:

* stronger psychological trust
* cleaner operational investigation UX
* improved readability under dense identity topologies
* calmer enterprise investigation experience

---

## 🧪 Stability & Validation

Verified:

* Team Access Context investigations
* Role Access Context investigations
* Result Viewer role continuation flows
* inherited role participation rendering
* operational significance interpretation
* local evidence search behaviour
* export workflows
* progressive disclosure behaviour
* bounded evidence rendering

Validated against:

* owner teams
* Azure AD group teams
* administrative roles
* operational application roles
* integration-oriented identities
* enterprise-scale access datasets

No regression in:

* User Access Context
* Result Viewer
* Operational Profiles
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution
* Query Doctor

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DVQR operational investigation invariants:

* Access Context is operational investigation, not security administration
* participation does not imply effective access
* operational identity context remains bounded
* operational interpretation remains heuristic, not authoritative
* evidence remains inspectable and explainable
* investigation guidance remains advisory-only
* Result Viewer remains the operational workspace
* operational continuity takes precedence over disconnected tooling

Access Context continues to prioritise:

```text
understanding
before
authority
```

---

## 🎯 Summary

DV Quick Run can now:

* investigate operational participation across users, teams, and roles
* continue role investigations directly from Result Viewer
* interpret inherited participation more coherently
* preserve bounded and explainable access topology context
* search and export operational identity evidence safely
* investigate operational role significance without RBAC overreach

This establishes the foundation for:

* broader identity-topology investigation
* access-participation continuity
* future audit-oriented operational investigation
* runtime actor and role correlation
* deeper operational access-context workflows

---

# v0.11.3 — Access Context Foundations, Identity-Centric Operational Investigation & Bounded Access Topology

This release introduces the first complete **Access Context investigation workflow** inside DV Quick Run.

DV Quick Run can now investigate operational identity participation directly from:

* Command Palette workflows
* Result Viewer identity continuation flows
* execution/runtime identity pivots

The goal is not RBAC simulation or security administration.

It is:

* identity-centric operational investigation
* bounded access-topology understanding
* explainable operational participation visibility
* calmer operational context exploration
* investigation continuity
* evidence-backed identity interpretation

Access Context remains:

* bounded
* advisory-only
* investigation-oriented
* evidence-backed
* non-alarmist
* operationally contextual

---

## 🔐 Access Context Investigation (Major)

Introduced the first full Access Context investigation workflow inside DV Quick Run.

Access Context can now investigate:

* Dataverse users
* application users
* non-interactive users
* service identities
* operational participation topology
* direct role participation
* team participation
* inherited team role participation

Behaviour:

* Access Context remains explicitly bounded
* does not simulate RBAC
* does not infer effective record access
* preserves operational participation semantics only

Results:

* stronger operational identity understanding
* clearer service/app-user visibility
* calmer operational investigation workflows
* safer access-oriented operational reasoning

---

## 🧭 Identity-Centric Operational Investigation (NEW)

DV Quick Run now treats operational identity as a first-class investigation dimension.

Access Context surfaces:

* principal type
* access mode
* business unit
* application/service identity classification
* direct role participation
* team participation
* inherited team role participation

Examples include:

* Power Automate identities
* AI Builder identities
* Copilot Studio identities
* synchronization/integration service identities
* administrative application users

Results:

* easier understanding of operational platform identities
* improved runtime identity orientation
* stronger operational ecosystem visibility
* safer operational participation interpretation

---

## ⚡ Result Viewer → Access Context Continuation (NEW)

Added contextual operational continuation directly from Result Viewer.

Available on:

```text
systemusers.systemuserid
```

New Result Viewer action:

```text
OPERATE
→ Check User Access Context
```

Behaviour:

* preserves investigation continuity
* launches identity investigation directly from row context
* avoids disconnected operational workflows
* keeps Result Viewer as the operational investigation workspace

Results:

* smoother operational investigation flow
* reduced context switching
* stronger operational continuity
* clearer runtime identity exploration

---

## 🧠 Operational Significance Interpretation (NEW)

Introduced bounded operational interpretation summaries inside Access Context.

Examples include:

* broad administrative participation
* automation-oriented identities
* AI Builder participation
* integration/synchronization-oriented identities
* scoped operational participation

Behaviour:

* interpretations remain heuristic and evidence-backed
* avoids effective-access claims
* avoids security/risk scoring
* preserves explainability and bounded semantics

Examples:

```text
This application user has broad operational reach via observed System Administrator role participation.
```

```text
This identity appears aligned to integration or synchronization operations rather than broad interactive user access.
```

Results:

* stronger operational understanding
* clearer investigation meaning
* reduced “raw evidence only” interpretation burden
* calmer operational reasoning

---

## 🧩 Progressive Disclosure & Searchable Evidence UX (Major)

Refined Access Context presentation hierarchy around:

* meaning first
* operational signals second
* evidence third
* raw verification last

Access Context structure now follows:

```text
Access Context
├─ Operational Significance
├─ Observed Access Signals
├─ Searchable Evidence
└─ Raw Verification Evidence
```

Behaviour:

* strongest operational interpretation appears first
* raw evidence remains progressively explorable
* dense identity topology remains bounded and readable
* local evidence search remains available inside the current investigation context

Added:

* local Access Context evidence search
* search highlighting
* find-next navigation
* auto-expansion of matched sections

Results:

* calmer operational UX
* reduced cognitive overload
* stronger investigation readability
* safer enterprise-scale usability

---

## 📦 Access Context Export & Evidence Portability (NEW)

Access Context investigations can now be exported explicitly.

Added:

* Copy Markdown
* Copy JSON
* Save Markdown
* Save JSON
* Save HTML

Behaviour:

* preview opens directly without exposing intermediate markdown tabs
* exports preserve bounded operational semantics
* evidence remains portable and shareable
* raw verification context remains available when needed

Results:

* improved investigation portability
* easier operational sharing/escalation
* foundation for future investigation replay/export workflows
* stronger operational evidence continuity

---

## 🎨 Access Context UX Refinement

Refined operational presentation and wording throughout Access Context.

Improvements include:

* reduced disclaimer repetition
* calmer operational wording
* stronger operational hierarchy
* clearer separation between meaning/signals/evidence
* improved section collapsing behaviour
* refined operational terminology consistency
* cleaner raw evidence organisation

Additional refinements:

* governance boundaries now appear prominently once instead of repeatedly
* evidence wording shortened to reduce fatigue
* operational interpretation prioritised ahead of raw topology detail

Results:

* cleaner operational UX
* stronger psychological trust
* reduced defensive/noisy wording
* improved operational scanability

---

## 🧪 Stability & Validation

Verified:

* Command Palette identity investigation
* Result Viewer operational continuation
* application user investigation
* non-interactive user investigation
* service identity investigation
* local evidence search behaviour
* export workflows
* progressive disclosure behaviour
* bounded raw evidence rendering

Validated against:

* Power Automate identities
* AI Builder identities
* Copilot Studio identities
* integration service identities
* administrative application users
* enterprise-scale identity datasets

No regression in:

* Result Viewer
* Operational Profiles
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution
* Query Doctor

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DVQR operational investigation invariants:

* Access Context is operational investigation, not security administration
* participation does not imply effective access
* operational identity context remains bounded
* investigation guidance remains advisory-only
* evidence remains inspectable and explainable
* operational interpretation remains heuristic, not authoritative
* Result Viewer remains the operational workspace
* operational continuity takes precedence over disconnected tooling

Access Context prioritises:

```text
understanding
before
authority
```

---

## 🎯 Summary

DV Quick Run can now:

* investigate Dataverse identity participation operationally
* continue identity investigations directly from Result Viewer
* interpret operational access topology more meaningfully
* preserve bounded and explainable identity context
* search and export operational identity evidence safely
* investigate service/app-user participation coherently

This establishes the foundation for:

* runtime actor continuity
* audit-oriented operational investigation
* execution identity correlation
* future access-topology investigation workflows
* identity-aware operational replay and reconstruction

---

# v0.11.1 and v0.11.2 — DVQR Score, Operational Density Calibration & Evidence-Backed Complexity Semantics

This release evolves Operational Profiles from:

* operational context visibility

→ to:

* calibrated operational density interpretation
* evidence-backed complexity scoring
* explainable density decomposition
* trustworthy investigation guidance

DV Quick Run now introduces the first production-ready version of:

```text
DVQR Score
```

The goal is not risk scoring, health scoring, or root-cause prediction.

It is:

* operational density understanding
* contextual complexity visibility
* orchestration awareness
* investigation prioritisation
* evidence-backed interpretation
* explainable scoring semantics

DVQR Score remains:

* bounded
* advisory-only
* evidence-backed
* entity-scoped
* investigation-oriented

---

## 📊 DVQR Score (NEW)

Introduced the first full DVQR Score model inside Operational Profiles.

DVQR Score represents:

```text
operational density
+
contextual investigation complexity
```

—not:

* system health
* runtime quality
* security severity
* performance scoring
* deployment correctness
* root-cause certainty

DVQR Score currently evaluates evidence such as:

* relationship surface area
* plugin/runtime participation
* workflow/orchestration density
* ownership complexity
* solution participation
* metadata customisation footprint

Behaviour:

* evidence is compressed using bounded soft-cap normalization
* signals contribute weighted operational density points
* final score is calibrated into a bounded 0–100 scale
* interpretation remains advisory-only

Results:

* clearer operational investigation prioritisation
* stronger orchestration visibility
* easier identification of operationally dense entities
* more believable operational complexity interpretation

---

## 🧠 Explainable Density Calculation (NEW)

Operational Profiles now expose explainable score decomposition.

Added:

* `How is DVQR Score calculated?`
* evidence-backed contribution breakdowns
* soft-cap normalization visibility
* weighted evidence summaries
* raw evidence vs normalized ratio visibility
* calculation explanation versioning

Example decomposition includes:

* Broad Relationship Surface
* Heavy Runtime Participation
* Significant Orchestration Density
* Ownership Complexity
* Operational Packaging Participation
* Customisation Footprint

Each signal now surfaces:

* raw evidence count
* soft cap
* normalized ratio
* weighted contribution

Behaviour:

* strongest contributors remain visible first
* deeper calculation semantics are progressively disclosed
* operational interpretation remains separate from calculation detail

Results:

* stronger operational trust
* explainable investigation semantics
* reduced "magic score" ambiguity
* clearer understanding of why entities score differently

---

## ⚖️ Operational Density Calibration Refinement (Major)

Refined operational density calibration to better match real-world Dataverse operational complexity.

Adjusted:

* density weighting balance
* orchestration weighting
* relationship normalization
* metadata density interpretation
* ownership participation semantics
* packaging participation weighting

Calibration goals:

* lightweight entities should remain clearly low-density
* common business entities should not immediately appear alarming
* orchestration-heavy entities should feel meaningfully distinct
* density distribution should remain believable across environments

Examples:

| Entity Type                  | Example Behaviour |
| ---------------------------- | ----------------- |
| Lightweight helper table     | Low density       |
| Vanilla account/contact      | Moderate density  |
| Plugin-heavy business entity | High density      |
| Deep orchestration entity    | Very high density |

Results:

* more believable operational scoring
* reduced false alarm semantics
* stronger psychological trust in score interpretation
* calmer operational investigation UX

---

## 🧭 Progressive Disclosure UX Refinement

Refined Operational Profile presentation hierarchy around:

* strongest operational signal first
* investigation interpretation second
* scoring decomposition third

Operational Profile structure now follows:

```text
DVQR Score
├─ Primary Contributors
└─ How is DVQR Score calculated?
```

Behaviour:

* Primary Contributors collapsed by default
* Calculation details collapsed by default
* strongest operational interpretation remains immediately visible
* deeper scoring detail remains explorable on demand

Results:

* calmer operational UX
* reduced visual overload
* faster operational scanning
* stronger investigation readability

---

## 🎨 Operational Profile UX Polish

Refined visual structure and operational readability throughout Operational Profiles.

Improvements include:

* calmer score presentation
* contributor hierarchy refinement
* cleaner evidence decomposition layout
* reduced duplicated graphical density visuals
* improved section spacing and alignment
* improved contributor readability
* stronger progressive disclosure behaviour
* refined operational terminology consistency

Additional refinements:

* contributor sections now use consistent operational iconography
* calculation semantics remain visually secondary to investigation guidance
* decomposition visuals simplified to reduce redundancy

Results:

* more professional operational presentation
* cleaner investigation flow
* stronger visual trustworthiness
* reduced cognitive overload

---

## 🧪 Density Validation & Dogfooding

DVQR Score calibration and Operational Profiles were validated against:

* lightweight metadata entities
* plugin-dense business entities
* workflow-heavy operational entities
* managed platform entities
* sparse helper/system entities

Examples validated include:

* `contact`
* `account`
* `workflow`
* `plugintracelog`
* `sdkmessageprocessingstep`

Validation focused on:

* operational believability
* advisory correctness
* score consistency
* psychological trust
* density distribution realism
* evidence explainability
* avoiding implied root-cause certainty

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical DVQR operational reasoning invariants:

* operational density is not root cause
* evidence remains inspectable and explainable
* strongest signal appears first
* interpretation remains advisory-only
* participation does not imply causality
* scoring must remain explainable
* operational context remains bounded
* operational guidance remains calm and investigation-oriented

DVQR Score prioritises:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* surface explainable operational density scoring
* decompose operational complexity transparently
* expose weighted evidence contribution semantics
* calibrate density more realistically across entity types
* provide calmer and more trustworthy investigation guidance
* preserve evidence-backed operational interpretation

This establishes the foundation for:

* future DVQR Score evolution
* operational density comparison workflows
* operational drift analysis
* evidence-backed operational ranking
* future investigation continuity and replay workflows

---

## v0.11.0 — Operational Context Foundations, Evidence Continuity & Investigation Context Expansion

This release establishes the first complete Operational Context foundation layer inside DV Quick Run.

Operational Profiles now move beyond density-only signals into:

* bounded operational context
* evidence continuation
* contextual participation visibility
* identity-aware investigation surfaces
* deployment/layering visibility
* ownership and runtime actor understanding

The goal is not environment crawling or speculative RCA.

It is:

* calmer operational understanding
* evidence-backed investigation context
* bounded contextual expansion
* explainable operational participation
* continuity-safe investigation workflows

---

## 🧭 Operational Context Foundations (Major)

Introduced the first complete Operational Context framework inside Operational Profiles.

Operational Profiles now surface bounded contextual investigation cards including:

* Solution Context
* Access Context
* Runtime Actor Context
* Ownership / Participation Context

Behaviour:

* all contexts remain explicitly bounded
* contextual expansion is limited to one-hop provider-owned evidence
* contextual evidence remains advisory-only
* participation does not imply causality

Results:

* stronger operational understanding
* clearer deployment/layering awareness
* improved investigation orientation
* calmer context-driven troubleshooting

---

## 🧩 Solution Context (NEW)

Operational Profiles now surface curated solution participation evidence.

Behaviour:

* detects solutioncomponent participation
* resolves participating solutions
* ranks and curates highest-signal packages
* surfaces deployment/layering context inline

Examples surfaced:

* System Solution
* Application Common
* Power Pages Runtime Core
* AIPlatformExtensionsCore
* Power Automate Workflow Table Extensions

Operational semantics:

* participation only
* not deployment blame
* not runtime causality
* not full topology reconstruction

Additional behaviour:

* inline expandable solution details
* managed/unmanaged visibility
* solution version visibility
* copyable evidence query paths
* copyable raw evidence JSON

Results:

* significantly improved operational layering visibility
* easier understanding of platform/application participation
* better deployment-context investigation flow
* reduced need for separate manual solution queries

---

## 🔐 Access Context (NEW)

Operational Profiles now preserve Dataverse access/principal investigation context.

Surfaces:

* current Dataverse principal
* actor classification
* access mode
* Azure object id
* request principal evidence

Behaviour:

* preserves observed identity context only
* does not simulate RBAC
* does not infer remediation
* missing privileges only shown when Dataverse explicitly returns them

Results:

* clearer operational trust context
* better understanding of execution identity
* stronger investigation continuity
* safer access-related operational reasoning

---

## 👤 Runtime Actor Context (NEW)

Added Runtime Actor Context to preserve execution identity distinctions.

Operational Profiles now distinguish:

* human user
* app user
* service principal
* workflow owner
* impersonated actor

Behaviour:

* preserves observed identity semantics
* does not imply runtime responsibility
* preserves identity evidence separately from causality reasoning

Results:

* stronger execution identity understanding
* safer operational investigation semantics
* better future execution-correlation foundation

---

## 🏛️ Ownership / Participation Context (NEW)

Operational Profiles now surface ownership and metadata participation context.

Examples include:

* ownership model
* managed metadata state
* activity-table participation
* custom-table classification

Behaviour:

* ownership remains structural context only
* no runtime responsibility inference
* metadata participation remains bounded and explainable

Results:

* clearer table semantics
* easier operational interpretation
* stronger metadata-aware investigation continuity

---

## 📋 Evidence Continuation UX (Major)

Operational Context surfaces now support investigation continuation directly inline.

Added:

* `View details`
* inline contextual detail expansion
* inline evidence continuation
* copyable diagnostic query patterns
* copyable raw evidence JSON

New UX actions:

* `Copy query`
* `Copy JSON`

Behaviour:

* investigation continuity remains inside the same operational surface
* avoids context-loss from launching disconnected query tabs
* preserves operational orientation during exploration

Results:

* significantly smoother investigation workflows
* less operational disorientation
* improved evidence portability
* calmer debugging experience

---

## 🧠 Ranked Context Curation (NEW)

Introduced ranked contextual evidence curation for operational context providers.

Behaviour:

* providers may now return larger bounded evidence sets internally
* UI curates and prioritises highest-signal evidence
* additional evidence remains available via raw evidence continuation

Example:

* top-ranked solution participation surfaces first
* lower-signal/system-heavy packages deprioritised
* raw evidence still preserved transparently

Results:

* cleaner operational UX
* stronger signal-to-noise ratio
* improved operational readability
* foundation for future contextual ranking systems

---

## 🧪 Stability & Validation

Verified:

* Solution Context evidence continuation
* inline detail expansion
* Access Context rendering
* Runtime Actor Context rendering
* Ownership Context rendering
* copy query behaviour
* copy raw JSON behaviour
* ranked contextual evidence presentation
* bounded one-hop continuation semantics

No regression in:

* Operational Profiles
* Result Viewer
* Execution Insights
* Guided Traversal
* Capability Explorer
* `$batch` execution
* Query Doctor

---

## 🧭 Architectural Invariants Reinforced

This release reinforces critical v0.11.x invariants:

* participation does not imply causality
* operational context remains bounded
* contextual expansion remains provider-owned
* no recursive topology crawling
* no audit chronology reconstruction
* no speculative RCA narratives
* evidence remains inspectable and explainable
* operational guidance remains advisory-only

Operational Context continues to prioritise:

```text
understanding
before
automation
```

---

## 🎯 Summary

DV Quick Run can now:

* preserve operational context directly inside investigations
* expose deployment/layering participation safely
* preserve runtime identity distinctions
* surface ownership and metadata semantics clearly
* continue investigations inline without losing context
* provide copyable evidence and diagnostic paths
* curate operational context more intelligently

This establishes the foundation for:

* contextual operational ranking
* DVQR Score evolution
* future operational comparison workflows
* richer execution-aware contextual investigation
* cross-surface operational continuity

---

# DV Quick Run v0.10.5 — Result Viewer Action Execution, Operational Capability Trust & Access-Aware UX

This release completes the first full operational execution loop between the Result Viewer and Capability Explorer.

DV Quick Run can now:

* launch bound Dataverse Actions directly from Result Viewer row context
* preserve preview-first execution workflows
* classify operational execution trust more clearly
* capture execution investigation context from Result Viewer interactions
* degrade gracefully under restricted Custom API permissions
* preserve calm operational UX even when execution capability is unavailable

This release focuses heavily on:

```text
operational execution trust
+
access-aware UX
+
investigation continuity
```

The goal is not unrestricted execution.

It is:

* explicit operational execution
* preview-first investigation workflows
* trustworthy execution affordances
* graceful degradation under restricted environments
* metadata-backed operational understanding
* calmer operational exploration

---

## ⚡ Result Viewer Bound Action Execution (Major)

Result Viewer rows can now launch entity-bound Dataverse Actions directly from operational investigation context.

Added:

* `Bound Actions on this record`
* row-context Action previews
* target-row execution binding
* preview-first operational execution flows

Behaviour:

* Result Viewer supplies explicit entity + row context
* execution still requires preview and confirmation
* preview surfaces preserve environment-bound authority semantics
* bound route generation remains metadata-aware

Examples:

```text
/workflows(<guid>)/Microsoft.Dynamics.CRM.SomeBoundAction
```

Results:

* tighter investigation → execution workflow continuity
* reduced context switching
* operational execution directly from investigation surfaces
* clearer entity-bound Action semantics

---

## 🧭 Result Viewer → Capability Explorer Operational Bridge (NEW)

Introduced a structured bridge between:

```text
Result Viewer
→
Capability execution preview
→
Operational execution result
```

Behaviour:

* Result Viewer now acts as an operational execution launch surface
* execution previews preserve investigation anchors
* execution results retain operational context and captured identifiers

Captured context includes:

* source surface
* target entity
* target row id
* execution identifiers
* execution duration
* operation binding metadata

Results:

* stronger investigation continuity
* clearer operational execution lineage
* safer execution understanding
* execution-aware operational workflows

---

## 🛡️ Access-Restricted Capability Explorer UX (Major)

Capability Explorer now degrades gracefully when users lack Custom API discovery permissions.

Previously:

* discovery failures surfaced as raw Output errors
* Capability Explorer launch could feel broken or incomplete

Now:

* Capability Explorer opens in restricted-access mode
* operational messaging remains calm and explicit
* discovery restrictions are surfaced structurally inside the UI

Restricted surfaces now display:

* principal user
* missing privilege
* restricted entity
* HTTP status

Examples:

```text
Missing privilege:
prvReadCustomAPI
```

Behaviour:

* no execution is attempted
* no misleading capability state is shown
* operational trust remains preserved

Results:

* calmer operational UX
* reduced confusion under restricted environments
* clearer remediation guidance
* safer enterprise dogfooding experience

---

## 🔒 Access-Aware Result Viewer Action Behaviour (NEW)

Result Viewer operational actions now adapt to Custom API discovery availability.

Behaviour:

* Bound Action launch remains visible but unavailable
* restricted execution surfaces provide explicit operational explanation
* unavailable actions no longer fail silently

Examples:

```text
Bound Actions unavailable.
Missing prvReadCustomAPI privilege on customapi.
```

Additional behaviour:

* missing privilege names are extracted dynamically from Dataverse responses
* avoids misleading hardcoded privilege assumptions
* preserves accurate remediation guidance

Results:

* stronger execution trust
* clearer operational semantics
* reduced ambiguity around disabled operational actions
* more truthful capability behaviour

---

## 🎨 Operational Execution UX Refinement

Refined execution affordances throughout Result Viewer and Capability Explorer.

Changes include:

* improved bound Action wording
* clearer operational grouping semantics
* calmer disabled-state presentation
* execution-warning consistency across environments
* improved preview/result visual continuity

Environment trust semantics now align consistently with:

* DEV / GREY environments
* SIT / AMBER environments
* PROD / RED environments

Behaviour:

* execution warnings remain contextual
* preview-first trust framing remains visible
* operational authority boundaries remain explicit

Results:

* more cohesive operational UX
* stronger environment-awareness
* cleaner execution mental model
* reduced operational friction

---

## 🧠 Investigation Context & Execution Continuity (Expanded)

Bound Action execution from Result Viewer now captures richer operational investigation context.

Captured execution metadata includes:

* execution route
* bound entity information
* row-context authority
* request identifiers
* execution timestamps
* execution duration
* execution source surface

Execution result surfaces now preserve:

* operational trust context
* execution investigation anchors
* execution-aware diagnostics continuity

Results:

* stronger operational traceability
* safer execution understanding
* clearer investigation lineage
* improved future execution diagnostics foundation

---

## 🧪 Stability & Validation

Verified:

* Result Viewer bound Action launch
* entity-bound execution previews
* preview → execute workflows
* restricted-access Capability Explorer rendering
* dynamic privilege extraction
* disabled action behaviour
* environment-aware warning presentation
* execution investigation context capture

No regression in:

* Capability Explorer
* Execution Insights
* Guided Traversal
* `$batch` execution
* Operational Profiles
* Query Doctor
* Result Viewer interaction workflows

---

## 🧭 Notes

Key principles reinforced:

* graceful degradation over noisy failure
* operational transparency over hidden execution state
* investigation continuity over disconnected execution workflows
* accurate capability semantics over optimistic execution assumptions
* environment-aware operational trust

---

## 🎯 Summary

DV Quick Run can now:

* launch bound Actions directly from Result Viewer rows
* preserve operational execution continuity
* degrade gracefully under restricted capability access
* surface accurate privilege remediation guidance
* maintain preview-first operational execution trust
* capture richer execution investigation context

This establishes the foundation for:

* deeper execution-aware investigation workflows
* operational capability trust refinement
* richer execution diagnostics correlation
* future operational execution intelligence

---

## DV Quick Run v0.10.4 — Entity-Bound Action Execution & Preview-First Operational Execution

This release completes the next major phase of Capability Explorer by introducing safe, preview-first execution support for **entity-bound Dataverse Actions**.

DV Quick Run can now:

* resolve bound entity execution routes
* generate executable entity-bound OData invocation paths
* support explicit target-row execution
* execute bound Actions safely through preview-first workflows
* capture execution diagnostics and operational investigation context
* preserve governance-aware execution trust semantics

This marks a major transition:

```text
Capability discovery
→
operational execution infrastructure
```

The goal is not unrestricted execution.

It is:

* explicit operational execution
* metadata-backed execution understanding
* safe execution confirmation
* execution investigation continuity
* governance-aware execution trust
* operational transparency

---

## ⚡ Entity-Bound Action Execution (Major)

Capability Explorer now supports execution of eligible entity-bound Dataverse Actions.

Supported:

* entity-bound Actions
* collection-bound Actions
* explicit target-row execution
* metadata-backed route resolution
* preview-first execution workflows

Behaviour:

* bound execution requires explicit target row context
* execution routes are generated using OData metadata semantics
* execution remains environment-bound and confirmation-driven
* request shape is validated before execution

Examples:

```text
/workflows(<guid>)/Microsoft.Dynamics.CRM.SomeBoundAction
```

Results:

* operational execution directly from Capability Explorer
* safer execution semantics
* reduced manual REST tooling dependency
* clearer understanding of Dataverse Action invocation models

---

## 🧭 Bound Route Resolution (NEW)

Introduced metadata-aware bound route generation.

Capability Explorer now resolves:

* entity-bound routes
* collection-bound routes
* executable OData invocation paths
* target entity set semantics

Behaviour:

* entity-bound operations now correctly require explicit row context
* collection-bound operations resolve against entity collections
* invalid preview routes are prevented before execution

Results:

* trustworthy execution previews
* safer operational execution
* stronger alignment with real Dataverse OData semantics

---

## 🧠 Execution Capability Semantics Refinement

Refined operational execution semantics for bound operations.

Capability Explorer now distinguishes:

* inspect-only
* preview-only
* preview-ready
* executable
* bound-context-required execution

New operational semantics include:

* `Inspect only — target row required`
* `Preview bound request`
* `Ready to run bound Action`

Behaviour:

* entity-bound Actions no longer appear ambiguously executable
* missing bound context is surfaced explicitly
* preview surfaces explain why execution is or is not currently possible

Results:

* calmer operational UX
* stronger execution trust
* reduced execution ambiguity
* clearer Dataverse execution understanding

---

## 🛡️ Preview Payload Validation Improvements

Refined Action parameter validation and preview generation behaviour.

Changes include:

* parameter metadata treated as execution contract authority
* entity metadata choice values now treated as advisory hints only
* execution validation now prioritises actual Custom API parameter metadata
* preview payload validation better aligns with Dataverse runtime expectations

Behaviour:

* primitive execution types remain strongly typed
* advisory metadata no longer incorrectly overrides Action parameter contracts
* execution previews remain editable before confirmation

Results:

* safer preview generation
* fewer false validation failures
* stronger compatibility with real-world Dataverse Actions
* clearer distinction between metadata hints and execution contracts

---

## 🔍 Execution Diagnostics & Investigation Context (Expanded)

Bound Action execution now captures structured operational investigation context.

Captured execution context includes:

* execution route
* execution identifiers
* execution duration
* request metadata
* operation binding metadata
* execution capability state
* execution investigation notes

Execution result surfaces now provide:

* request shape visibility
* execution summary
* response payload inspection
* captured execution anchors
* raw execution context

Results:

* stronger operational traceability
* clearer execution understanding
* foundation for deeper execution diagnostics
* execution-aware investigation continuity

---

## 🧪 Stability & Validation

Verified:

* entity-bound Action execution
* collection-bound Action execution
* explicit GUID target execution
* OData route generation
* preview → execute workflows
* execution diagnostics capture
* request/response rendering
* execution context persistence
* metadata-backed route validation

No regression in:

* Capability Explorer
* Function execution
* Execution Insights
* Result Viewer
* Guided Traversal
* `$batch` execution
* Operational Profiles
* Query Doctor

---

## 🧭 Notes

This release reinforces a major DV Quick Run invariant:

```text
execution capability
must remain:
explicit
metadata-aware
preview-first
investigation-oriented
```

Key principles reinforced:

* explicit confirmation over silent execution
* operational transparency over hidden behaviour
* metadata-backed execution trust
* environment-bound execution authority
* investigation continuity after execution
* execution diagnostics as operational evidence

---

## 🎯 Summary

DV Quick Run can now:

* execute entity-bound Dataverse Actions safely
* resolve executable bound OData routes automatically
* support target-row operational execution
* capture structured execution diagnostics
* preserve preview-first governance semantics
* maintain execution investigation continuity

This establishes the foundation for:

* deeper execution diagnostics
* execution-aware investigation workflows
* orchestration correlation
* runtime execution reconstruction
* future operational execution intelligence

---

## DV Quick Run v0.10.3 — Execution Support Classification & Operational Capability Semantics

Refined operational execution semantics throughout Capability Explorer to establish a clearer and more trustworthy execution classification model.

Capability surfaces now distinguish between:

* Preview-ready
* Partially preview-ready
* Ready to run
* Run with caution
* Inspect only
* Internal/private operations
* Unsupported parameter scenarios

Behaviour:

* execution capability is now separated from execution recommendation
* preview support is classified independently from execution eligibility
* private/internal APIs remain inspectable while preventing unsafe execution workflows
* unsupported parameter scenarios surface bounded preview-only behaviour instead of misleading execution affordances

New operational UX semantics include:

* `Preview / Run Action`
* `Preview Request`
* `Inspect only — internal/private Action`
* `Inspect only — unsupported parameters`
* `AI-generated content warning`

Capability Explorer now adapts operational affordances based on:

* parameter support complexity
* OData execution eligibility
* governance classification
* AI-related execution policy
* private/internal visibility
* preview-safe parameter analysis

Results:

* clearer operational capability understanding
* more predictable execution behaviour
* reduced execution ambiguity
* stronger governance transparency
* calmer operational UX under complex metadata scenarios
* improved trustworthiness during capability exploration

This refinement also establishes a reusable operational capability taxonomy for future:

* execution governance layers
* capability-aware diagnostics
* execution policy expansion
* governed operational automation
* metadata-driven operational reasoning

---

## DV Quick Run v0.10.2 — Action Execution, AI Governance & Operational Execution Trust

This release expands Capability Explorer from previewable Functions into controlled Action execution workflows.

It introduces:

* explicit Action execution
* execution governance foundations
* AI-related execution policy enforcement
* operational trust advisories
* execution safety refinement
* preview-first Action workflows

The goal is not unrestricted execution.

It is:

* controlled operational execution
* transparent execution behaviour
* explicit user confirmation
* metadata-backed execution trust
* safe operational experimentation
* governance-ready execution foundations

---

## ⚡ Custom API Action Execution (NEW)

Capability Explorer now supports execution of eligible Dataverse Actions.

Supported:

* bound Actions
* unbound Actions
* preview-ready parameter surfaces
* metadata-validated execution routes

Behaviour:

* execution remains explicit and preview-first
* Actions require manual confirmation before execution
* preview payloads are generated before runtime invocation
* execution remains environment-bound

Execution previews include:

* HTTP method
* invocation route
* request headers
* request body template
* execution notes
* execution readiness state

Results:

* safer operational execution workflows
* clearer understanding of Action semantics
* reduced guesswork during execution
* improved operational experimentation

---

## 🧭 Action Preview & Execution UX Refinement

Refined Action execution surfaces throughout Capability Explorer.

Improvements include:

* clearer execution readiness presentation
* improved spacing and hierarchy between readiness cards
* calmer execution affordances
* cleaner preview-to-execution flow
* stronger distinction between:

  * preview-ready
  * inspect-only
  * AI-governed execution

Behaviour:

* execution cards remain visually grouped
* operational warnings remain contextual instead of disruptive
* execution confirmation remains explicit

Results:

* cleaner operational UX
* reduced cognitive overload
* stronger execution trust
* more professional execution presentation

---

## 🛡️ AI Execution Governance Foundation (NEW)

Introduced the first execution governance foundation for AI-related operations.

DV Quick Run now classifies certain operations as:

```text
AI-related execution
```

Examples include:

* AIReply
* AISentiment
* AITranslate
* AISummarize
* similar AI Builder / generated-content operations

Behaviour:

* AI execution is denied by default
* execution requires explicit configuration opt-in
* governance state is surfaced directly inside execution previews

New configuration:

```json
"dvQuickRun.execution.aiPolicy": "deny"
```

Supported values:

* `deny`
* `allow`

Results:

* safer default operational posture
* stronger enterprise governance readiness
* clearer execution boundaries
* reduced accidental AI execution risk

---

## ⚠️ AI-Generated Content Advisory (NEW)

Added explicit AI-generated content advisories for AI-related operations.

When AI execution is allowed, Capability Explorer now surfaces:

* AI-generated content warnings
* probabilistic output guidance
* human-review recommendations
* operational trust advisories

Examples include warnings such as:

* generated responses may be inaccurate
* responses may be incomplete or non-deterministic
* AI-generated content should not be trusted blindly for operational decisions
* external AI processing may occur depending on Dataverse configuration

Behaviour:

* advisories remain contextual and bounded
* warnings are visible during preview and execution result inspection
* advisory wording avoids alarmism while remaining explicit

Results:

* stronger operational transparency
* clearer execution expectations
* improved governance posture
* safer AI-assisted operational workflows

---

## 🧠 AI Execution Diagnostics & Investigation Context

Execution result surfaces now capture AI-related operational context.

Captured execution context includes:

* AI-related execution classification
* execution policy state
* advisory notes
* captured execution metadata
* execution identifiers
* operational investigation anchors

Diagnostics now distinguish:

* standard operational execution
* AI-related execution context
* governed execution behaviour

Results:

* clearer investigation traceability
* stronger operational auditability
* improved execution understanding
* governance-aware diagnostics foundation

---

## 🔒 Governance-Oriented Execution Philosophy

This release reinforces an important operational invariant:

```text
execution capability
≠
execution recommendation
```

DV Quick Run intentionally:

* preserves explicit user control
* avoids autonomous execution behaviour
* reinforces preview-first operational workflows
* surfaces governance boundaries visibly
* prefers safe denial over implicit execution

Key principles reinforced:

* explicit execution over silent execution
* preview-first operational trust
* environment-bound execution authority
* governance-aware operational UX
* human-reviewed AI output
* operational transparency over automation

---

## 🧪 Stability & Validation

Verified:

* Action execution preview generation
* bound/unbound Action execution
* AI policy deny behaviour
* AI policy allow behaviour
* execution advisory rendering
* AI warning UX spacing and hierarchy
* execution result advisory rendering
* execution diagnostics capture
* environment-bound execution continuity

No regression in:

* Capability Explorer
* Function execution
* Execution Insights
* Result Viewer
* Guided Traversal
* Query Doctor
* `$batch` execution
* Operational Profiles

---

## 🎯 Summary

DV Quick Run can now:

* execute supported Dataverse Actions safely
* classify and govern AI-related operations
* deny AI execution by default
* surface AI-generated content advisories
* capture governed execution diagnostics
* maintain preview-first operational execution trust

This establishes the foundation for:

* future execution governance layers
* enterprise operational controls
* execution policy expansion
* governed operational automation
* deeper execution trust workflows

---

## DV Quick Run v0.10.1 — Execution Safety, Capability Continuity & Preview Trust Hardening

This release hardens the operational execution model introduced in v0.10.0.

It focuses on:

- execution safety
- environment-bound operational context
- preview trustworthiness
- capability execution continuity
- investigation consistency
- operational UX refinement

The goal is not adding more execution capability.

It is:

- preventing unsafe operational behaviour
- reinforcing explicit environment ownership
- strengthening execution trust
- reducing stale operational context risk
- aligning preview surfaces with real execution authority

---

### 🛡️ Environment-Bound Capability Execution (Major)

Capability execution context is now strictly bound to the active environment.

Behaviour changes:

- changing environments now invalidates active capability execution context
- stale execution previews can no longer execute against prior environments
- capability execution surfaces are closed automatically during environment transitions

Affected surfaces include:

- Capability Explorer
- Custom API execution previews
- Capability execution insights
- preview-backed execution workflows

Results:

- prevents stale-environment execution
- avoids accidental SIT/PROD execution drift
- strengthens operational trust boundaries
- aligns execution authority with active environment ownership

---

### 🔒 Preview Trust Hardening (NEW)

Execution previews now enforce stronger operational continuity guarantees.

Behaviour:

- stale previews are no longer treated as executable authority
- execution context must originate from the currently active environment
- preview execution continuity resets safely after environment changes

This prevents scenarios where:

- a SIT preview remains executable after switching to DEV
- stale capability metadata survives environment transition
- investigation anchors leak across operational contexts

Results:

- safer operational execution
- stronger preview correctness
- reduced cross-environment execution risk
- clearer operational mental model

---

### 🧠 Capability Execution Continuity Refinement

Capability execution flows now behave more coherently during operational transitions.

Behaviour improvements:

- execution previews remain environment-scoped
- capability execution insights remain tied to captured execution anchors
- reopening previews after environment changes regenerates fresh operational context

Results:

- clearer operational continuity
- safer investigation behaviour
- reduced stale-context ambiguity
- stronger alignment between preview, execution, and diagnostics

---

### 🧭 Capability Explorer UX Refinement

Refined execution affordances and operational capability UX.

Improvements include:

- consistent execution button sizing
- improved spacing/alignment for execution actions
- cleaner execution preview affordances
- stronger visual consistency between:
  - Preview / Run Function
  - Execution Insights

Results:

- calmer operational UX
- more professional execution surface presentation
- clearer execution interaction hierarchy
- improved readability under dense operational layouts

---

### ⚡ Execution Insight Workflow Refinement

Execution Insight flows now align more tightly with capability execution behaviour.

Behaviour:

- execution insights continue using captured request/correlation context
- investigation surfaces remain execution-anchor bounded
- execution diagnostics remain tied to originating capability execution

Results:

- stronger execution investigation coherence
- safer operational traceability
- clearer investigation lineage
- reduced diagnostic ambiguity

---

### 🧩 Preview-Only Workflow Wording Refinement

Refined preview-only operational wording throughout Capability Explorer.

Changes include:

- removed internal implementation/workstream wording from user-facing UX
- simplified preview-only operational messaging
- improved distinction between:
  - executable capabilities
  - preview-only capabilities
  - inspect-only capabilities

Results:

- cleaner operational language
- reduced internal terminology leakage
- more polished capability exploration experience
- stronger operational professionalism

---

### 🧪 Stability & Validation

Verified:

- environment transition invalidation
- stale preview prevention
- execution surface closure on environment change
- safe regeneration of execution previews
- execution insight continuity
- Hub recovery behaviour after environment transition
- capability execution button UX consistency

No regression in:

- Capability Explorer
- Execution Insights
- Result Viewer
- Guided Traversal
- Operational Profiles
- `$batch` execution
- Query Doctor
- Hub workflows

---

### 🧭 Notes

This release reinforces a critical operational invariant:

```text
active environment
=
execution authority boundary
```

DV Quick Run now treats operational environment transitions as authoritative context changes.

Key principles reinforced:

- fail closed over stale continuity
- execution authority must remain environment-bound
- previews are operational context, not persistent authority
- operational investigation must remain trustworthy
- execution safety takes precedence over convenience

---

### 🎯 Summary

DV Quick Run now:

- invalidates stale execution context safely
- prevents cross-environment execution drift
- closes unsafe preview surfaces automatically
- strengthens capability execution trustworthiness
- aligns execution continuity with operational environment ownership

This establishes a safer foundation for:

- future capability execution workflows
- deeper operational diagnostics
- execution-aware investigation continuity
- environment-safe operational exploration

---

## DV Quick Run v0.10.0 — Capability Explorer, Custom API Execution & Operational Capability Discovery

This release introduces the first version of **Capability Explorer** — a new operational surface for discovering, understanding, previewing, and executing Dataverse Custom APIs directly inside DV Quick Run.

It marks the beginning of DV Quick Run’s evolution from:

- query + investigation tooling

→ to:

- operational capability discovery
- execution investigation
- metadata-backed operational understanding

The goal is not becoming an API builder.

It is:

- exposing operational capabilities safely
- understanding execution surfaces
- preview-first operational workflows
- execution-aware investigation
- metadata-backed operational discovery

---

## 🧭 Capability Explorer (NEW)

Introduced **Capability Explorer** — a dedicated operational discovery surface for Dataverse Custom APIs.

Capability Explorer now provides:

- Custom API catalogue
- Action vs Function classification
- Bound vs Unbound visibility
- Public vs Private visibility
- Execution readiness classification
- OData metadata eligibility detection
- Parameter inspection
- Operational execution previews

Behaviour:

- capability discovery is metadata-driven
- catalogue loads directly from Dataverse Custom API metadata
- execution remains explicit and preview-first

Users can now:

- inspect operational APIs safely
- understand execution complexity
- identify executable Web API operations
- distinguish previewable vs inspect-only capabilities

Results:

- operational capability visibility
- safer API exploration
- stronger Dataverse operational understanding
- reduced guesswork around Custom API execution

---

## ⚡ OData Metadata Execution Validation (NEW)

Added explicit validation against the Dataverse OData `$metadata` surface before execution.

Capability Explorer now validates:

- FunctionImport
- ActionImport
- operation definitions
- invocation routes
- OData eligibility

Behaviour:

- APIs discovered in Custom API metadata are cross-checked against executable OData metadata
- execution is allowed only when a matching OData operation surface exists
- non-exposed or internal APIs remain inspect-only

Examples surfaced in UI:

- Executable via OData metadata
- Preview-only / Inspect-only
- Not exposed through Web API

Results:

- prevents invalid execution attempts
- avoids misleading preview surfaces
- increases execution trustworthiness
- aligns execution with actual Dataverse runtime capability

---

## 🔍 Execution Readiness Classification (NEW)

Introduced structured execution readiness classification.

Capability Explorer now distinguishes:

- Preview-ready
- Inspect-only
- Executable via OData metadata

Readiness reasoning includes:

- parameter support complexity
- preview-safe parameter types
- OData operation visibility
- metadata validation state

Behaviour:

- simple primitive parameters can be previewed safely
- unsupported/complex parameters remain inspectable
- execution readiness is explicit and explainable

Results:

- clearer operational expectations
- safer execution workflows
- reduced accidental misuse
- stronger preview-first trust model

---

## 🧾 Custom API Execution Preview (NEW)

Added dedicated execution preview workflows for executable Functions.

Execution preview includes:

- HTTP method
- invocation path
- executable route
- request headers
- parameter templates
- execution values
- operational notes

Behaviour:

- execution requires explicit user confirmation
- generated routes now correctly use executable invocation syntax
- Functions automatically append `()`
- parameterised Functions generate executable parameter payloads safely

Results:

- transparent execution workflows
- easier operational experimentation
- safer Dataverse API interaction
- clearer request semantics

---

## 🧠 Execution Result Surface (NEW)

Introduced dedicated **Execution Result Webview** for Custom API execution workflows.

Execution results now surface:

- execution summary
- HTTP status
- duration
- request ID
- correlation context
- operation metadata
- request information
- execution values
- response payload
- raw execution context
- diagnostics notes

Behaviour:

- execution metadata is captured structurally
- result rendering remains investigation-oriented
- response inspection is separated from raw JSON-only output

Results:

- cleaner execution understanding
- operational execution traceability
- foundation for future execution diagnostics
- stronger execution investigation workflows

---

## 🧪 Capability Explorer Operational UX (NEW)

Added operational UX refinement throughout Capability Explorer.

Improvements include:

- environment-aware capability surfaces
- execution readiness cards
- operation overview summaries
- parameter inspection panes
- capability statistics
- explicit operational notes
- preview-first execution affordances

Hub integration:

- Capability Explorer now appears inside DV Quick Run Hub
- Quickstart updated with operational capability discovery guidance
- actionable Hub buttons now visually differentiate executable workflows

Results:

- calmer operational UX
- stronger discoverability
- clearer execution affordances
- more cohesive operational workflow guidance

---

## 🧩 Metadata Registry Foundation (NEW)

Introduced reusable metadata registry foundations for operational capability validation.

Capability Explorer now reuses and extends:

- metadata discovery pipelines
- operational metadata registries
- execution validation seams
- metadata-backed operation reasoning

Behaviour:

- avoids isolated execution logic
- prepares future operational metadata expansion
- keeps renderer surfaces thin and metadata-driven

Establishes foundation for:

- future execution diagnostics
- execution capability reasoning
- operation investigation workflows
- cross-surface operational intelligence

---

## 🧪 Stability & Validation

Verified:

- executable Function validation
- non-executable API suppression
- OData metadata operation matching
- parameterised Function preview generation
- execution preview rendering
- execution result rendering
- request/response metadata capture
- Hub integration flows

No regression in:

- Result Viewer
- Guided Traversal
- Execution Insights
- Operational Profiles
- Query Doctor
- `$batch` execution
- Investigation workflows

---

## 🧭 Notes

This release establishes DV Quick Run as:

> an operational capability exploration and investigation workbench for Dataverse and Power Platform engineering

—not a Custom API authoring platform.

Key principles reinforced:

- preview-first operational execution
- metadata-backed capability reasoning
- explicit execution confirmation
- execution transparency
- operational understanding before execution
- investigation-oriented operational UX

---

## 🎯 Summary

DV Quick Run can now:

- discover Dataverse Custom APIs
- classify executable vs inspect-only capabilities
- validate execution eligibility against OData metadata
- preview executable requests safely
- execute supported Functions explicitly
- capture structured execution diagnostics
- inspect operational execution results in dedicated investigation surfaces

This establishes the foundation for:

- execution diagnostics
- capability-aware investigation workflows
- operational execution reasoning
- future runtime correlation analysis
- deeper Dataverse operational exploration

---

## v0.9.17 — Operational Investigation Fluency & Hub Experience

This release makes DV Quick Run easier to discover and use as an operational investigation workflow.

Added:

- DV Quick Run Hub for in-app investigation guidance.
- Workflow-oriented investigation playbooks.
- Capability Explorer for released DV Quick Run features.
- Lightweight product direction and philosophy sections.
- Initial extension-session InvestigationContext foundation.
- Quickstart integration updates for operational investigation workflows.
- Hub entry points for:
  - Query execution workflows
  - Guided Traversal workflows
  - Execution Insights
  - Operational Profiles
  - Investigation continuation patterns

Behaviour:

- Hub content remains static, typed, and renderer-thin.
- InvestigationContext is memory-backed only for the current extension session.
- Guidance is framed as contextual operational orientation, not AI recommendations.
- Quickstart remains available as onboarding; Hub complements it as operational fluency guidance.
- Hub and Quickstart now align more closely around:
  - operational investigation workflows
  - result-driven exploration
  - investigation continuity
  - execution-aware operational reasoning

---

## v0.9.16 — Investigation Continuity, Context Surfaces & Operational Exploration

This release evolves DV Quick Run from a collection of operational tooling surfaces into a more cohesive operational investigation platform.

It focuses on:

- investigation continuity
- operational context awareness
- traversal-aware exploration
- calmer investigation UX
- continuity-safe execution workflows
- operational adjacency visibility

The goal is not adding more telemetry.

It is:

- preserving investigation flow
- reducing operational disorientation
- making exploration reversible
- exposing operational context progressively
- strengthening investigation trust

---

### Investigation Context Surface (NEW)

Introduced a dedicated **Investigation strip** inside the Result Viewer.

The strip acts as a lightweight operational context surface for the current investigation session.

Examples include:

- traversal continuity
- expanded investigation scopes
- operational adjacency
- execution context indicators
- investigation-linked entity pivots

Behaviour:

- remains lightweight and non-invasive
- preserves operational orientation
- avoids dashboard-style noise

Results in:

- clearer investigation continuity
- better operational awareness
- smoother transition between exploration steps

---

### Traversal Continuity & Recovery (Major)

Guided Traversal workflows now preserve investigation continuity more reliably.

Added:

- Back navigation
- Route reselection
- traversal continuation
- dead-end recovery guidance
- sibling expand continuity support

Behaviour:

- traversal state remains recoverable
- users can pivot without restarting workflows
- failed/no-result branches no longer terminate investigation flow

Results in:

- calmer traversal UX
- reduced exploration friction
- safer multi-hop investigation workflows

---

### Expanded Investigation Scope Awareness (NEW)

Expanded entities and sibling expands now participate in the operational investigation surface.

Examples:

- `account`
- `contact`
- `systemuser`
- sibling-expanded entities

Behaviour:

- expanded scopes appear as clickable operational investigation pills
- allows fast contextual profile pivots
- maintains entity-scoped investigation boundaries

The primary/root entity continues to use the main Profile surface.

Results in:

- easier operational adjacency exploration
- faster context switching
- stronger relationship investigation workflows

---

### Execution Context Orientation (NEW)

Added lightweight execution context cues directly into investigation workflows.

Examples include:

- active traversal state
- execution-aware investigation hints
- continuity-safe guidance
- traversal-active operational indicators

Behaviour:

- only shown when operationally relevant
- suppresses unnecessary noise
- guidance remains advisory-only

Results in:

- clearer understanding of active investigation state
- improved workflow orientation
- stronger operational coherence

---

### Batch Investigation Continuity Fixes

Fixed investigation continuity issues affecting `$batch` workflows.

Resolved:

- incorrect batch query extraction
- traversal continuity loss after batch execution
- sibling expand continuity inconsistencies
- investigation state resets during batch transitions

Behaviour:

- batch execution now preserves operational context correctly
- traversal-aware investigation survives execution pivots
- continuity surfaces remain stable across batch results

Results in:

- more reliable operational workflows
- safer multi-query investigation
- stronger batch/traversal integration

---

### Guidance Refinement & Noise Reduction

Refined contextual investigation guidance behaviour.

Changes include:

- suppression of redundant investigation hints
- calmer traversal messaging
- context-aware recommendation visibility
- reduced operational duplication

Examples:

- removed redundant “Opened from Guided Traversal”
- simplified traversal-active semantics
- guidance shown only when confidence is meaningful

Results in:

- cleaner operational UX
- lower cognitive overload
- stronger recommendation trust

---

### Investigation Surface Stability

Validated across:

- traversal workflows
- sibling expands
- nested expands
- `$batch` execution
- operational profile pivots
- dead-end traversal scenarios
- empty-result recovery flows

Verified:

- traversal continuity preservation
- investigation strip stability
- operational profile pivot correctness
- batch-aware investigation context handling

No regression in:

- Result Viewer
- Guided Traversal
- Operational Profiles
- Execution Insights
- Query Doctor
- `$batch` execution

---

## Notes

This release reinforces DV Quick Run’s direction as:

```text
an operational investigation workbench for Dataverse and Power Platform engineering
```

—not a disconnected collection of tooling surfaces.

Key principles reinforced:

- investigation continuity over restart workflows
- operational context over telemetry overload
- reversible exploration over procedural execution
- advisory-only guidance
- evidence-backed operational context
- calmer investigation UX

---

## Summary

DV Quick Run can now:

- preserve investigation continuity across traversal workflows
- expose expanded operational investigation scopes
- maintain operational orientation during exploration
- recover more gracefully from dead-end investigations
- integrate traversal and batch execution more coherently

Establishes a stronger foundation for:

- persistent investigation workflows
- cross-surface operational reasoning
- future investigation export/import experiences
- deeper operational exploration tooling

---

## v0.9.15 — Operational Profile Investigation Surfaces & UX Refinement

This release refines Operational Profiles into a more complete operational investigation surface for Dataverse engineering workflows.

It focuses on:

- tighter operational density presentation
- investigation-first UX refinement
- evidence-backed operational guidance
- clearer next-step investigation actions
- roadmap visibility for future operational capabilities

The goal is not to overwhelm users with telemetry.

It is:

- faster operational understanding
- clearer investigation prioritisation
- calmer investigation workflows
- stronger operational trust

---

### Suggested Investigation Actions (NEW)

Operational Profiles now surface actionable investigation entry points directly inside the profile.

Examples:

- View plugin registrations
- Investigate async operations
- Review relationship footprint
- View business rules

Actions are:

- entity-scoped
- bounded
- evidence-backed
- investigation-oriented

Results in:

- faster transition from signal to investigation
- less manual query construction
- clearer operational workflow guidance

---

### Progressive Disclosure UX Refinement (NEW)

Operational Profile sections now open in a calmer, investigation-first state.

Changes include:

- Evidence collapsed by default
- Suggested Investigation Actions collapsed by default
- Investigation Guidance collapsed by default

Behaviour:

- strongest operational signals remain immediately visible
- deeper operational evidence becomes progressively explorable
- avoids overwhelming users during first scan

Results in:

- faster visual comprehension
- cleaner operational scanning
- reduced cognitive overload

---

### Investigation Guidance Refinement

Refined investigation guidance wording to reinforce:

- advisory-only reasoning
- evidence-backed interpretation
- operational context over root-cause implication

Guidance now better explains:

- why a signal may matter
- when it becomes investigation-relevant
- what operational context it represents

Examples:

- plugin touchpoint density
- relationship footprint implications
- metadata surface considerations
- auditing context
- managed-state governance context

Results in:

- stronger user trust
- clearer operational semantics
- reduced risk of misleading interpretation

---

### Future Investigation Surfaces (NEW)

Operational Profiles now introduce roadmap visibility for upcoming investigation capabilities.

Current roadmap surfaces include:

Free roadmap:

- Custom API Discovery
- Cross-surface investigation pivots

Pro roadmap:

- Operational Profile drift comparison
- Cross-environment operational comparison
- Deployment operational impact analysis

Behaviour:

- roadmap items are informational only
- hover descriptions explain future capability intent
- no hidden execution or inaccessible behaviour

Results in:

- clearer product direction
- stronger platform identity
- better user understanding of future operational workflows

---

### Relationship Investigation Workflow Refinement

Improved relationship investigation handling:

- safer relationship export workflow
- save dialog prompt support
- cleaner transition into Relationship Explorer workflows

Results in:

- more predictable export behaviour
- smoother relationship investigation flow
- better compatibility across environments

---

### Operational Profile UX Polish

Refined:

- section spacing
- hierarchy consistency
- item count alignment
- collapsed section readability
- operational signal scanning flow

Improved consistency between:

- Suggested Investigation Actions
- Investigation Guidance
- Future Investigation Surfaces

Results in:

- more coherent operational UX
- improved visual balance
- cleaner investigation flow progression

---

## Notes

This release reinforces Operational Profiles as:

```text
an operational investigation surface for Dataverse and Power Platform engineering
```

—not a telemetry dashboard or speculative scoring system.

Key principles reinforced:

- strongest signal first
- investigation before explanation
- evidence before interpretation
- advisory-only operational guidance
- progressive disclosure over overload

---

## Summary

DV Quick Run can now:

- guide users toward concrete operational investigations
- present operational context more calmly
- surface roadmap investigation directions
- reduce operational scanning noise
- improve investigation workflow coherence

Establishes a stronger foundation for:

- operational comparison workflows
- deployment-aware operational analysis
- future DVQR operational density evolution
- cross-surface investigation experiences

---

## v0.9.14 — Operational Profiles, Evidence Density & Entity Investigation Guidance

This release introduces **Operational Profiles** — a new entity-scoped investigation surface designed to help engineers quickly understand the operational complexity surrounding a Dataverse table.

Operational Profiles do not attempt root-cause analysis.

Instead, they surface:

* operational density
* orchestration participation
* metadata complexity
* automation involvement
* execution investigation starting points

using bounded, evidence-backed signals.

The goal is not telemetry overload.

It is:

* faster operational understanding
* clearer investigation prioritisation
* trustworthy evidence presentation
* safer interpretation boundaries

---

### 🧭 Operational Profiles (NEW)

* Added **Operational Profile** view inside the Result Viewer

* Profiles summarise operational characteristics for an entity using bounded evidence signals:

  * Automation (Plugin Steps)
  * Relationships
  * Columns
  * Async Load
  * Managed State
  * Power Automate / Flow
  * Workflows

* Profiles are:

  * entity-scoped
  * user-triggered
  * advisory-only
  * evidence-backed

👉 Results in:

* faster understanding of operationally dense entities
* easier identification of likely investigation entry points
* improved visibility into orchestration-heavy tables

---

### 📊 Operational Density Classification (NEW)

* Introduced bounded density classifications:

  * Low Operational Density
  * Moderate Operational Density
  * High Operational Density

* Signal thresholds were tuned to avoid over-classifying normal entities as “high complexity”

Examples:

* `<50` → Low

* `50–70` → Moderate

* `70–120` → High

* `130+` → Very High

* Behaviour:

  * lightweight entities remain green/low-density
  * orchestration-heavy entities surface more prominently
  * classification remains advisory, not authoritative

👉 Results in:

* stronger trustworthiness
* lower false-positive complexity signals
* clearer differentiation between normal and operationally dense entities

---

### 🔗 Evidence-Backed Investigation Links (NEW)

* Added direct evidence navigation links:

  * View plugin steps
  * View relationships
  * View columns
  * View async operations
  * View flows
  * View workflows

* Links launch concrete Dataverse investigation queries directly inside DV Quick Run

Examples:

* `sdkmessageprocessingsteps`

* `asyncoperations`

* `workflows`

* Queries are:

  * metadata-aware
  * entity-scoped
  * bounded

👉 Results in:

* smoother investigation flow
* less manual query construction
* direct transition from operational signal → evidence inspection

---

### ⚡ Async Load Signal Refinement (NEW)

* Introduced bounded async operation investigation:

  * scoped to recent execution windows
  * avoids unbounded asyncoperation scans

* Async signals now distinguish:

  * no evidence observed
  * low async participation
  * elevated async activity

* Async investigation queries now:

  * use bounded date windows
  * avoid misleading broad historical scans

👉 Results in:

* safer operational interpretation
* reduced noise from historical async activity
* more trustworthy operational signals

---

### 🧠 Managed State Interpretation (NEW)

* Managed state is now surfaced as:

  * governance/deployment context
  * not operational quality judgement

* Behaviour:

  * managed entities show “Managed”
  * unmanaged entities show “No evidence observed”
  * avoids implying managed = good/bad

👉 Results in:

* clearer operational semantics
* reduced interpretation ambiguity
* safer governance signalling

---

### 🧩 Operational Profile UX Refinement

* Refined visual hierarchy:

  * strongest signals appear first
  * supporting evidence remains secondary
  * guidance remains advisory-only

* Improved:

  * density wording
  * evidence readability
  * investigation guidance phrasing
  * operational terminology consistency

* Removed:

  * misleading implied causality
  * exaggerated operational language
  * unnecessary visual noise

👉 Results in:

* stronger user trust
* faster operational scanning
* more believable investigation guidance

---

### 🧪 Dogfooding & Validation

Operational Profiles were validated against:

* lightweight entities
* orchestration-heavy healthcare entities
* plugin-heavy custom entities
* sparse/system entities
* metadata-driven entities
* async-heavy investigation scenarios

Examples tested:

* `contact`
* `plugintracelog`
* `sdkmessageprocessingstep`
* `msemr_medicalidentifier`
* `bu_task`
* lightweight metadata/helper tables

Validation focused on:

* operational truthfulness
* advisory correctness
* evidence consistency
* avoiding false root-cause implication
* balanced density thresholds

---

## 🧭 Notes

Operational Profiles reinforce DV Quick Run’s direction as:

```text
an operational investigation workbench for Dataverse and Power Platform engineering
```

—not a speculative scoring or telemetry platform.

Key principles reinforced:

* evidence before interpretation
* advisory-only investigation guidance
* bounded operational reasoning
* no hidden scanning behaviour
* strongest operational signals first
* operational density is not root cause

---

## 🎯 Summary

DV Quick Run can now:

* surface operational density for entities
* expose orchestration participation clearly
* provide direct evidence-backed investigation links
* distinguish lightweight vs operationally dense entities
* guide investigation without making root-cause claims

👉 Establishes the foundation for:

* future operational reasoning layers
* execution-aware entity profiling
* cross-source operational investigation
* deeper Power Platform operational diagnostics

---

## v0.9.13 — Execution Investigation Coherence & FlowSession Truthfulness

This release focuses on **execution investigation coherence**, **architectural tightening**, and **evidence-backed signal presentation**.

It refines how Execution Insights are ordered, reasoned about, and presented — without expanding feature surface area or introducing speculative diagnostics.

The goal of v0.9.13 is not more telemetry.

It is:
- clearer investigation flow
- more truthful supporting evidence
- stronger reasoning boundaries
- cleaner long-term architecture

---

### 🧠 Shared Execution Insight Ordering (NEW)

- Centralised Execution Insight ordering semantics into a shared model

- Ordering now consistently prioritises:
  1. primary investigation signal
  2. investigation priority
  3. confidence
  4. deterministic fallback ordering

- Behaviour improvements:
  - primary investigation patterns appear first consistently
  - supporting signals remain visible but subordinate
  - ordering remains stable across reruns

👉 Results in:
- more predictable investigation flow
- clearer “start here” guidance
- reduced diagnostic fragmentation

---

### 🧩 Reasoning Seam Extraction (NEW)

- Refactored execution investigation reasoning into lightweight shared reasoning seams

- Extracted:
  - primary signal interpretation
  - summary generation
  - guided investigation generation
  - related-signal reasoning

- Preserves:
  - thin renderer architecture
  - explicit orchestration
  - deterministic investigation behaviour

👉 Results in:
- cleaner architectural boundaries
- reduced reasoning drift inside builders
- safer foundation for future execution intelligence work

---

### 🔗 Related Signal Guardrails (Expanded)

- Refined supporting signal behaviour to reinforce:
  - investigation hints
  - supporting evidence
  - contextual linkage

- Supporting signals:
  - no longer compete visually with stronger evidence
  - avoid implied causality
  - remain clearly secondary to the primary investigation signal

👉 Results in:
- stronger investigation trust
- lower risk of misleading execution narratives
- clearer separation between evidence and interpretation

---

### ⚡ FlowSession Evidence Truthfulness (Major)

- Refined FlowSession insight generation to require **real FlowSession evidence**

- FlowSession insight cards now require concrete FlowSession-identifying evidence such as:
  - `flowsessionid`
  - `flowid`
  - `runid`
  - `environmentid`

- Behaviour now correctly distinguishes:

  - no FlowSession evidence
  - partial FlowSession context
  - actionable Power Automate run linkage

👉 Results in:
- no more synthetic FlowSession context
- improved evidence honesty
- reduced misleading Power Automate implications

---

### 🧾 FlowSession Wording & Investigation Hierarchy Refinement

- Refined FlowSession wording and signal prominence

- Improved behaviour:
  - weak/non-actionable FlowSession context uses softer wording
  - actionable Flow navigation only appears when runnable evidence exists
  - asyncoperation investigation patterns now correctly lead investigation ordering

- Reduced:
  - over-prominent weak signals
  - misleading Flow run implications
  - false investigation weight

👉 Results in:
- stronger operational truthfulness
- more coherent investigation hierarchy
- better alignment between evidence strength and UI prominence

---

### 🧪 Stability & Behaviour

- Verified:
  - primary signal ordering stability
  - asyncoperation-led investigation flow
  - supporting signal visibility
  - FlowSession suppression when no evidence exists
  - partial FlowSession context handling
  - deterministic ordering behaviour
  - `$batch` sub-result isolation

- Added regression coverage for:
  - synthetic FlowSession prevention
  - ordering consistency
  - partial FlowSession evidence handling

- No regression in:
  - Result Viewer
  - Execution Insights
  - `$batch` investigation
  - plugin trace insights
  - asyncoperation insights
  - Guided Traversal
  - Query Doctor

---

## 🧭 Notes

This release reinforces DV Quick Run’s direction as:

```text
an investigation workbench for Dataverse and Power Platform engineering
```

—not a speculative telemetry platform.

Key principles reinforced:
- strongest signal first
- supporting evidence remains contextual
- investigation must remain explainable
- renderer surfaces stay thin
- execution diagnostics remain bounded and deterministic
- evidence strength must match UI prominence

---

## 🎯 Summary

DV Quick Run now:
- orders execution investigations more coherently
- separates reasoning from rendering more cleanly
- prevents misleading FlowSession evidence
- presents supporting signals more truthfully
- improves investigation trust without increasing feature complexity

👉 Establishes a stronger foundation for:
- future execution intelligence layers
- guided investigation workflows
- controlled cross-source reasoning
- deeper Power Platform investigation capabilities

---

## v0.9.12 — Guided Execution Investigation & Primary Signal Reasoning

This release evolves Execution Insights from:

- runtime signal detection

→ to:

- guided execution investigation

DV Quick Run now identifies the **primary execution pattern first**, then stitches together supporting evidence from async operations, plugin traces, and workflows into a more coherent investigation flow.

The result is a significantly clearer debugging experience for complex Dataverse and Power Platform execution chains.

---

### 🧠 Primary Execution Signal Prioritisation (NEW)

- Execution Insights now identify and prioritise a **primary execution signal**

- Behaviour:
  - strongest/highest-confidence execution pattern is surfaced first
  - supporting signals appear afterward as secondary investigation cards
  - avoids fragmented or competing diagnostic narratives

- Examples:
  - repeated async background execution
  - repeated cross-request execution patterns
  - nested plugin execution chains

👉 Results in:
- clearer mental model of execution behaviour
- easier investigation starting point
- less cognitive overload during debugging

---

### 🔗 Guided Investigation Flow (NEW)

- Introduced structured investigation guidance directly inside insight cards

- New sections include:
  - **Primary signal**
  - **Summary**
  - **Guided investigation**
  - **Related signals**

- Behaviour:
  - explains why DV Quick Run considers a signal important
  - links related evidence together
  - provides concrete next investigation steps

👉 Results in:
- more coherent execution reasoning
- smoother investigation workflow
- reduced need to mentally correlate raw signals manually

---

### ⚡ AsyncOperation → Plugin Trace Correlation (Expanded)

- Async operation insights can now surface related plugin trace investigation context

- Provides:
  - correlation-aware follow-up guidance
  - related trace investigation suggestions
  - supporting execution signal linkage

- Behaviour:
  - async operations remain the primary source
  - plugin traces act as supporting evidence
  - avoids source confusion between execution types

👉 Enables:
- easier debugging of recurring background executions
- better understanding of execution chains
- clearer Dataverse ↔ Power Platform runtime visibility

---

### 🧾 Execution Narrative Refinement (Major)

- Refined execution insight wording and structure for readability

- Improved:
  - titles
  - summaries
  - investigation guidance
  - supporting evidence grouping

- Reduced:
  - noisy repetitive phrasing
  - fragmented investigation flow
  - disconnected signal presentation

👉 Results in:
- faster comprehension
- more trustworthy diagnostics
- better alignment with real troubleshooting workflows

---

### 🔍 Raw Investigation Context Improvements

- Expanded raw asyncoperation detail rendering

- Provides:
  - concise execution summaries
  - grouped correlation/request context
  - expandable raw JSON evidence

- Behaviour:
  - preserves transparency
  - maintains bounded execution behaviour
  - avoids overwhelming the primary investigation narrative

👉 Results in:
- deeper debugging capability when needed
- cleaner default insight experience
- stronger balance between abstraction and evidence

---

### 🛠 Execution Insight Ordering Improvements

- Improved insight ordering behaviour:
  - primary execution investigation cards now appear first
  - secondary/plugin-specific investigation cards follow afterward

- Prevents:
  - primary signal being buried later in the insight sequence
  - fragmented execution investigation flow

👉 Results in:
- more natural debugging progression
- stronger “main issue first” experience
- clearer investigation hierarchy

---

### 🧪 Stability & Behaviour

- Verified:
  - asyncoperation primary signal prioritisation
  - plugin trace correlation guidance
  - mixed execution insight ordering
  - raw investigation detail rendering
  - grouped identifier investigation flows

- No regression in:
  - Result Viewer
  - Execution Insights
  - `$batch` investigation
  - plugin trace insights
  - workflow-linked async insights

---

## 🧭 Notes

This release marks an important evolution:

DV Quick Run moves from:
- detecting execution signals

→ to:
- guiding execution investigation

Key principles reinforced:
- prioritise strongest signal first
- supporting evidence should reinforce, not compete
- investigation flow should feel coherent
- execution diagnostics must remain explainable and bounded

---

## 🎯 Summary

DV Quick Run can now:

- prioritise primary execution patterns automatically
- guide users through execution investigation flows
- correlate async operations with supporting plugin traces
- present execution diagnostics as a coherent investigation narrative

👉 Establishes the foundation for:
- cross-source execution reasoning
- execution timeline reconstruction
- future insight prioritisation systems
- deeper Power Platform execution diagnostics

---

## v0.9.11 — Execution Insights: Batch Investigation & Flow Run Navigation

This release closes the next part of the Execution Insights loop by making insights easier to act on directly from the Result Viewer.

It adds grouped `$batch` investigation, batch-aware Execution Insights, and Power Automate run navigation when FlowSession evidence is available.

---

### 🔍 Grouped Identifier Investigation (NEW)

- Added **Query all** for grouped execution identifiers:
  - `CorrelationId (3)`
  - `AsyncOperationId (3)`
  - plugin trace identifiers

- Behaviour:
  - executes one `$batch` request
  - creates one sub-request per identifier
  - renders each response independently in the Batch Result Viewer

👉 Results in:
- faster investigation of repeated executions
- cleaner follow-up from insight cards
- no need to manually copy and run each identifier query

---

### 📦 Batch-Aware Execution Insights (NEW)

- Execution Insights now work from selected `$batch` sub-results

- Behaviour:
  - each batch sub-result keeps its own insight context
  - insights run against the selected sub-response, not the batch root
  - switching batch sub-results does not leak insight output between responses

👉 Results in:
- clearer debugging of multi-request workflows
- safer per-request diagnosis
- stronger `$batch` investigation loop

---

### 🔗 Power Automate Run Navigation (NEW)

- Added FlowSession-based Power Automate run navigation when available

- Provides:
  - **Open Flow Run**
  - **Copy Run URL**

- Behaviour:
  - FlowSession evidence is treated as context only
  - no flow internals are parsed
  - no root-cause claim is made

👉 Enables:
- quicker jump from Dataverse execution context to Power Automate run history
- easier sharing of run links during troubleshooting

---

### 🛠 Execution Insight Fixes & Refinements

- Fixed source mismatch between async operation evidence and plugin trace insights
- Prevented asyncoperation-shaped rows from producing misleading plugin trace cards
- Improved grouped identifier action labels:
  - `Copy all`
  - `Query all`
- Preserved separate plugin trace and asyncoperation query behaviour

👉 Results in:
- fewer misleading insights
- more trustworthy follow-up actions
- better alignment between insight source and executed query

---

### 🧪 Stability & Behaviour

- Verified:
  - grouped `$batch` investigation
  - asyncoperation grouped queries
  - plugintracelog grouped queries
  - `$batch` sub-result insights
  - no-noise behaviour when `flowsessions` has no records

- FlowSession support is fixture-validated where live environments do not expose FlowSession records.

- No regression in:
  - Result Viewer
  - Execution Insights
  - `$batch` execution
  - plugin trace insights
  - asyncoperation insights

---

## 🧭 Notes

This release extends Execution Insights from:

- detecting execution signals

→ to:

- investigating grouped execution paths
- analysing batch sub-results independently
- navigating to Power Automate run context when available

Key principles reinforced:
- explicit, user-triggered diagnostics
- source-aware insight actions
- batch results remain separated
- FlowSession is context, not root cause

---

## 🎯 Summary

DV Quick Run can now:

- investigate grouped identifiers with `$batch`
- inspect Execution Insights per batch sub-result
- navigate to Power Automate runs when FlowSession evidence exists
- avoid misleading cross-source insight actions

👉 Completes the v0.9.11 execution investigation loop and prepares the platform for future insight prioritisation, timeline reconstruction, and cross-source reasoning.

---

## v0.9.10 — Execution Insights (AsyncOperation + Workflow) 

This release expands Execution Insights beyond plugin traces to include **async operations and workflows**, bringing clearer, more concrete visibility into backend execution behaviour.

It also focuses on **signal clarity, noise suppression, and visual consistency**, making insights faster to understand and act on.

---

### ⚡ AsyncOperation Insights (NEW)

- Introduced detection of **async operation signals** directly from Result Viewer

- Detects:
  - failed / cancelled async operations
  - waiting / suspended states
  - long-running executions
  - repeated executions (same request / cross-request)

- Surfaces:
  - execution duration
  - state + status labels
  - correlationId / requestId
  - related workflow context (when available)

👉 Results in:
- direct visibility into background processing issues
- faster identification of delays and failures
- no need to manually query `asyncoperations`

---

### 🔗 Workflow Context Integration (NEW)

- Async operations now surface **related workflow information**

- Provides:
  - workflow name
  - primary entity
  - activation state

👉 Enables:
- clearer understanding of what triggered execution
- better context for debugging background jobs

---

### 🧠 Improved Signal Interpretation (Major)

- Refined interpretation of execution signals:

- Differentiates:
  - repeated execution within a single request (normal retry / behaviour)
  - repeated execution across requests (potential pattern)

- Suppresses:
  - low-signal “normal” cases (e.g. completed + successful)
  - background noise from healthy executions

👉 Results in:
- higher signal-to-noise ratio
- avoids alarming users unnecessarily
- insights feel intentional and trustworthy

---

### 🧾 Insight Card UX Refinement (Major)

- Improved card structure for faster scanning:

Each insight now emphasises:
- **clear title (what happened)**
- **what’s happening (evidence)**
- **impact (why it matters)**

- Improved readability:
  - simplified wording
  - reduced verbosity
  - better alignment with real debugging language

👉 Results in:
- faster comprehension (2–3 second scan)
- clearer decision-making
- more practical debugging experience

---

### 🧩 Identifier Grouping & Actions (NEW)

- Introduced **grouped identifier display**:
  - e.g. `AsyncOperationId (3)`
  - shows multiple related IDs compactly

- Added actions:
  - **Copy** (all identifiers)
  - **Query** (follow-up investigation)

- Layout improvements:
  - identifiers displayed first
  - actions placed consistently below
  - avoids wrapping and visual clutter

👉 Results in:
- cleaner presentation of multi-record insights
- easier follow-up investigation
- consistent interaction model

---

### 🧪 Stability & Behaviour

- Verified:
  - asyncoperation queries (direct + derived)
  - workflow-linked executions
  - failed / slow / repeated scenarios
  - large datasets and mixed result sets

- Ensures:
  - no regression to Result Viewer performance
  - insights remain bounded and safe
  - graceful behaviour under low-signal conditions

- No regression in:
  - Query Doctor
  - Guided Traversal
  - `$batch` execution
  - Result Viewer interactions
  - Smart PATCH workflows

---

## 🧭 Notes

This release extends Execution Insights from:

- **plugin-level diagnostics**

→ to:

- **end-to-end execution awareness (async + workflow)**

Key principles reinforced:
- concrete over abstract signals
- suppress noise, surface only meaningful insights
- fast comprehension over completeness
- consistent, predictable interaction model

---

## 🎯 Summary

DV Quick Run can now:

- detect async execution issues automatically
- surface workflow-backed context
- differentiate normal vs concerning behaviour
- present insights in a clean, actionable format

👉 Establishes the foundation for:
- insight prioritisation
- deeper execution intelligence

---

## v0.9.9 — Execution Insights, Raw Trace Access & Signal-Driven Diagnostics

This release introduces **Execution Insights**, bringing **runtime awareness directly into the Result Viewer**.

DV Quick Run now goes beyond query correctness — it can **detect, surface, and explain real execution issues** such as slow plugins, repeated executions, and nested chains.

This establishes the foundation for **execution-aware debugging and future intelligent diagnostics**.

---

### ⚡ Execution Insights (NEW)

- Introduced **Execution Insights** in the Result Viewer

- Enables detection of:
  - slow plugin execution
  - repeated plugin execution
  - nested execution depth
  - exception signals

- Works across:
  - direct `plugintracelogs` queries

👉 Results in:
- immediate visibility into backend execution behaviour
- early detection of performance and reliability issues
- no need to manually query `plugintracelogs`

---

### 🔗 Correlation-Based Trace Detection (NEW)

- DV Quick Run now captures:
  - `correlationId`
  - `requestId`

- Uses captured metadata to:
  - retrieve matching plugin trace logs
  - analyse execution signals automatically

- Behaviour:
  - bounded lookup (safe execution)
  - gracefully handles timeout scenarios

👉 Enables:
- execution insights from **any query**, not just trace queries
- foundation for cross-request diagnostics

---

### 🧠 Signal-Based Insight Engine (NEW)

- Introduced structured detection of execution signals:

Detected signals include:
- slow execution (duration-based)
- repeated execution patterns
- nested execution depth
- exception presence

- Signals are:
  - grouped by plugin
  - ranked by impact
  - converted into a single high-quality insight per plugin

👉 Results in:
- high-signal, low-noise insights
- avoids overwhelming users with raw trace spam
- prioritises actionable findings

---

### 🧾 Structured Insight Cards (Major)

- Refined insight presentation into clear sections:

Each insight now includes:
- **Detected**
- **Impact**
- **Recommended next steps**

- Improved readability:
  - shortened plugin names
  - structured bullet points
  - clearer separation of concerns

👉 Results in:
- faster comprehension
- clearer decision-making
- better alignment with real debugging workflows

---

### 🔍 Raw Trace Details (NEW)

- Added **“View raw trace details”** section per insight

- Provides:
  - trace summary list
  - expandable raw JSON payload
  - **Copy raw JSON** action

- Raw trace includes:
  - pluginTraceLogId
  - correlationId / requestId
  - duration
  - depth
  - messageName
  - entityName

👉 Ensures:
- no loss of low-level detail
- supports deep debugging scenarios
- balances abstraction with transparency

---

### 🧠 Insight Consolidation (NEW)

- Multiple trace signals are now:
  - grouped per plugin
  - merged into a single insight card

- Preserves:
  - strongest signals (e.g. slow + repeated)
  - raw trace evidence

👉 Results in:
- reduced noise
- clearer prioritisation
- avoids duplicate or fragmented insights

---

### ⏱️ Bounded Execution & Timeout Handling (Improved)

- Execution Insights now operate under:
  - strict time budget
  - bounded query scope

- Behaviour:
  - stops safely when timeout reached
  - surfaces clear messaging:
    - “lookup timed out”
    - “no signals found”

👉 Prevents:
- UI blocking
- long-running trace scans
- unstable behaviour on large datasets

---

### 🧪 Stability & Behaviour

- Verified:
  - plugintracelogs direct queries
  - correlation-based insight retrieval
  - large datasets (e.g. 5000 records)
  - timeout scenarios
  - raw trace rendering and copy

- Ensures:
  - no impact to Result Viewer performance
  - insights remain optional and controlled
  - graceful degradation under heavy load

- No regression in:
  - Query Doctor
  - Guided Traversal
  - `$batch` execution
  - Result Viewer interactions
  - Smart PATCH workflows

---

## 🧭 Notes

This release marks a major evolution:

DV Quick Run moves from:
- **query correctness and refinement**

→ to:
- **execution-aware diagnostics and insight-driven debugging**

Key principles:
- signal over noise
- bounded, safe execution
- insight-first, raw-data-available
- no hidden or automatic behaviour

---

## 🎯 Summary

DV Quick Run can now:

- detect backend execution issues automatically
- surface meaningful plugin-level insights
- provide actionable next steps
- expose full trace details when needed

👉 Establishes the foundation for:
- execution timeline reconstruction
- insight model export
- re-run and compare workflows
- MCP-driven debugging capabilities

---

## v0.9.8 — Fast-First Result Viewer & Safe Insight Execution (Stability Release)

This release focuses on **stability, responsiveness, and trust**, ensuring DV Quick Run remains reliable under **wide and large Dataverse queries**.

It introduces a **fast-first execution model** and refactors the insight system to be **safe, bounded, and user-triggered**, preventing extension host crashes and performance degradation.

---

### ⚡ Fast-First Result Viewer (Major)

- Enforced **fast-first rendering model**
  - Result Viewer now prioritises immediate display of results
  - Insight generation no longer blocks or delays rendering

- Eliminated crash scenarios caused by:
  - wide entities (e.g. `contacts`)
  - large payloads without `$select`
  - heavy result-driven analysis during initial load

👉 Results in:
- consistent responsiveness
- no extension host crashes under broad queries
- predictable performance in enterprise environments

---

### 🛡️ Safe Mode for Broad Queries (NEW)

- Introduced **Safe Mode** for potentially unsafe queries

Triggered when:
- no `$select` present
- wide payload detected
- large result sets returned

- Behaviour:
  - Result Viewer opens immediately
  - result-driven insights are **paused**
  - user is prompted to run insights manually

- Messaging:
  - clearly communicates system behaviour
  - explains performance protection

👉 Ensures:
- broad queries are handled safely
- users understand why insights are limited
- system feels intentional, not broken

---

### 🧠 Deferred Insights (NEW)

- Result-driven insights are now **user-triggered**

- Introduced:
  - **Get Insights** action in Insight Drawer

- Behaviour:
  - insights run only when explicitly requested
  - initial query execution remains fast

👉 Establishes:
- explicit control over analysis
- separation between data retrieval and intelligence

---

### 🔍 Sample-Based Insight Analysis (NEW)

- Insights now operate on a **bounded sample of the current result page**

- Default limits:
  - max 20 rows
  - max 40 columns

- Preserves:
  - formatted values (e.g. Choice labels)
  - field relationships within sampled rows

- Messaging includes:
  - sample size
  - total result context

👉 Results in:
- fast insight generation
- representative (but safe) analysis
- no full-table scanning

---

### ⏱️ Insight Execution Budget (NEW)

- Introduced **soft execution budget for insights**

- Guards:
  - time budget (~2.5s soft limit)
  - row/column sampling limits

- Behaviour:
  - insights stop early if budget exceeded
  - partial results returned safely

👉 Prevents:
- runaway computations
- UI freezes
- performance degradation

---

### 🧩 Insight Execution Context (Foundation)

- Introduced central **Insight Execution Context**

- Provides:
  - shared time budget
  - sampling limits
  - execution tracking

- Enforces:
  - all result-based insights operate within safe bounds

---

### 🧪 Stability & Guardrails

- Added safeguards for:
  - wide dataset handling
  - sampled insight correctness
  - formatted value preservation
  - partial insight scenarios

- Introduced fail-safe behaviour:
  - insight failures degrade gracefully
  - Result Viewer never crashes due to insights

- Verified:
  - large datasets
  - wide schemas
  - repeated insight triggering
  - interaction stability under stress

- No regression in:
  - Result Viewer rendering
  - Query Doctor
  - Guided Traversal
  - `$batch` execution
  - Smart PATCH workflows

---

## 🧭 Notes

This is a **stability and trust-focused release**.

Key architectural shift:

- Insights move from:
  - **implicit + eager**
→ to:
  - **explicit + bounded + safe**

Core principles reinforced:
- fast-first execution
- user-controlled intelligence
- safe handling of enterprise-scale data
- graceful degradation over failure

---

## 🎯 Summary

This release ensures DV Quick Run:

- remains **fast under all query conditions**
- avoids crashes from wide or large datasets
- provides insights **only when needed**
- establishes a **safe foundation for future intelligence features**

👉 Prepares the platform for:
- deeper result analysis

— without compromising performance or stability

---

## v0.9.7 — Insight Drawer, Multi-Insight Query Doctor & Command Surface Foundation

This release introduces the first **result-aware insight system inside the Result Viewer**, evolving DV Quick Run from a query tool into a **guided, insight-driven Dataverse workbench**.

It focuses on:
- surfacing **multiple, evidence-based insights from Query Doctor**
- introducing a **dedicated Insight Drawer with actionable recommendations**
- establishing **Pro vs Free capability boundaries**
- reinforcing the Result Viewer as a **command surface for intelligent workflows**

---

### 💡 Insight Drawer (NEW)

- Introduced **Insight Drawer**
  - Accessible via lightbulb / Insights button
  - Displays **context-aware recommendations** for the current result

- Each insight includes:
  - recommendation text
  - reasoning (when available)
  - source (Query Doctor / Binder)
  - confidence level
  - optional action (Apply for Pro)

- Clear capability boundary:
  - **Free** → “Suggestion only”
  - **Pro** → “Actionable insight” with Apply

👉 Establishes:
- a dedicated surface for understanding and acting on insights
- a clean separation between explanation and execution

---

### 🧠 Multi-Insight Query Doctor (Major)

- Result Viewer now supports **multiple concurrent insights**

Examples:
- missing `$top`
- missing `$select`
- result-driven suggestions:
  - e.g. `statecode = Active` when distribution is uneven

- Insights are:
  - **deduplicated**
  - **ranked**
  - **rotatable via navigation**

👉 Results in:
- richer, result-aware guidance
- more realistic “next best action” workflows

---

### 🔄 Insight Navigation & Rotation

- Added manual navigation:

`[‹] Insight X of Y [›]`


- Behaviour:
- no auto-rotation (avoids noise)
- user-controlled exploration
- Binder still surfaces the **primary recommendation**

👉 Ensures:
- clarity over automation
- predictable interaction model

---

### ⏱️ Insight Snoozing (NEW)

- Applied insights are **temporarily snoozed (60s)**

Behaviour:
- Apply → insight disappears temporarily
- next eligible insight is shown
- prevents stale or repetitive suggestions

👉 Solves:
- stale Result Viewer vs editor state mismatch
- repeated “add $top” or similar guidance

---

### ⚡ Actionable Insights (Pro)

- Insights can now expose **Apply action**

- Behaviour:
- uses existing **preview-first Binder execution path**
- no direct mutation
- respects safe execution model

- After Apply:
- insight is snoozed
- drawer updates to next suggestion
- maintains preview-first invariant

👉 Establishes:
- execution from insight surface
- without breaking safety guarantees

---

### 🧩 Result Viewer → Command Surface (Expanded)

- Further reinforces Result Viewer as:
- analysis surface
- action surface
- refinement surface

- Insights now integrate with:
- Binder suggestions
- Query Doctor outputs
- preview-first mutation pipeline

👉 Moves DV Quick Run toward:
```
Query → Result → Insight → Action → Refine
```

---

### 🖱️ Context Menu Control (Foundation)

- Suppressed default browser context menu across:
  - table area
  - toolbar area
  - blank/result areas
  - Insight Drawer

- Preserved for:
  - input / textarea / editable fields

👉 Establishes foundation for:
- table-driven actions
- right-click command surface
- future slice-and-dice workflows

---

### 🧭 Traversal UX Fix

- Removed hardcoded schema reference:
  - ❌ “Tighten with chosen contactid”
  - ✅ replaced with schema-neutral wording

👉 Ensures:
- traversal UI remains metadata-driven
- no entity-specific leakage into UI

---

### 🧪 Guardrails & Stability

- Added guardrails for:
  - multi-insight rendering
  - snoozed insight behaviour
  - `$top` duplication prevention
  - preview-first Apply invariants
  - context menu suppression boundaries

- Verified:
  - Insight Drawer lifecycle
  - Free vs Pro behaviour
  - multi-insight navigation
  - Apply → snooze → next insight flow

- No regression in:
  - Result Viewer rendering
  - Guided Traversal
  - Query Doctor
  - `$batch` execution
  - Smart PATCH workflows

---

## 🧭 Notes

This release marks a major evolution:

- DV Quick Run moves from:
  - **query + result tool**
→ to:
  - **insight-driven workflow assistant**

Key principles reinforced:
- insight-first guidance
- preview-first execution
- result-aware reasoning
- minimal, high-confidence recommendations

---

## 🎯 Summary

This is the first version where DV Quick Run begins to:

- understand results
- suggest meaningful next steps
- allow controlled execution from those insights

👉 Establishes the foundation for:
- deeper Query Doctor intelligence
- slice-and-dice result analysis
- fully interactive data workflows

--

## v0.9.6 — Enterprise Stability: Large Dataset Handling & Result Viewer Reliability

This release focuses on **stability, predictability, and correctness under large datasets**, making DV Quick Run suitable for **real-world enterprise usage**.

It is not a feature-heavy release — instead, it hardens the **Result Viewer architecture**, fixes critical edge cases, and ensures consistent behaviour across large and complex result sets.

---

### 📊 Large Dataset Handling (Major)

- Introduced **session-backed Result Viewer model**
  - Full dataset stored once per execution
  - UI renders only a **controlled window** (default 100 rows)

- Added **row window controls**
  - Users can choose:
    - 100 / 200 / 500 / 1000 rows
  - Dynamic options based on dataset size
  - Prevents unsafe rendering of excessively large windows

- Enforced **safe rendering cap**
  - Recommended maximum: **1000 rows per window**

👉 Results in:
- stable rendering even for 5000+ row datasets
- predictable performance across environments

---

### 🔍 Full Dataset Search (Correctness Fix)

- Reworked search to operate on **entire dataset (not current page)**

- Behaviour:
  - search scans full result set
  - result count reflects **true matches across dataset**
  - UI shows:
    - “X matching rows across Y total rows”

- Fixed issues:
  - missing matches on non-visible pages
  - incorrect match counts due to paging
  - inconsistent search behaviour

👉 Results in:
- trustworthy search
- correct data discovery across large datasets

---

### 📄 Pagination & Navigation Improvements

- Added **sub-page navigation**
  - `[<] [>]` to move across row windows

- Smart visibility:
  - hidden when:
    - total rows < page size
    - single-page datasets

- Improved row indicators:
  - `Rows X–Y of Z`
  - reflects current window accurately

👉 Results in:
- clearer navigation
- reduced UI noise for small datasets

---

### ⚡ Progressive Rendering & Stability

- Improved **progressive rendering behaviour**
  - incremental row rendering for smoother UX

- Fixed rendering issues:
  - blank screen on execution
  - stuck “Loading rows...” state for large windows
  - inconsistent render completion

- Improved resilience:
  - avoids UI lockups under heavy datasets
  - ensures viewer always reaches a stable state

👉 Results in:
- reliable rendering lifecycle
- no more “dead” viewer states

---

### 📊 UX Clarity & Feedback

- Improved large dataset messaging:
  - performance warnings for large row windows
  - clearer “shown vs total” indicators

- Added:
  - render progress messaging (for large windows)
  - better loading state feedback

- Removed misleading states:
  - loading with no feedback
  - partial rendering without explanation

👉 Results in:
- better user trust
- clearer system behaviour under load

---

### 🧠 Architecture (Key Upgrade)

- Introduced **session as source of truth for Result Viewer**
  - decouples:
    - data retrieval
    - rendering
    - interaction (search, paging)

- Eliminated:
  - re-computation per page
  - inconsistent state between UI and dataset

👉 Establishes foundation for:
- future result analysis features
- slice-and-dice workflows
- Query Doctor improvements

---

### 🧪 Stability

- Verified:
  - large datasets (1000–5000 rows)
  - wide schemas (many columns)
  - search across full dataset
  - paging + navigation behaviour
  - progressive rendering lifecycle

- No regression in:
  - Smart PATCH workflow
  - Result Viewer actions
  - Guided Traversal
  - Query Doctor
  - `$batch` execution

---

## 🧭 Notes

This release marks an important shift:

- Result Viewer evolves from:
  - **UI rendering layer**
→ to:
  - **session-backed data interaction layer**

Key principles reinforced:
- predictable behaviour under load
- correctness over convenience
- clear system feedback
- safe defaults for enterprise datasets

---

This release is primarily aimed at:
- **enterprise environments**
- **large Dataverse tables**
- **real-world production usage**

---

## v0.9.5 — Smart PATCH, Result Viewer Refinement & Workflow Completion

This release completes the **end-to-end query → refine → PATCH → refresh workflow**, establishing DV Quick Run as a **true interactive Dataverse workbench**.

It focuses on:
- introducing **Smart PATCH (preview-first, safe mutation)**
- refining **Result Viewer as a command surface**
- stabilising **PATCH → Result Viewer refresh loop**
- tightening **UX consistency, guardrails, and interaction behaviour**

---

### ✏️ Smart PATCH (Preview → Apply → Refresh)

- Introduced **Smart PATCH workflow**
  - Update Dataverse records directly from Result Viewer interactions

- Full workflow:
  1. user triggers update (cell / row action)
  2. PATCH preview document opens
  3. confirmation dialog shown
  4. PATCH executed on confirmation
  5. Result Viewer refreshes using original query context

- Preview includes:
  - entity + record ID
  - PATCH path
  - payload (typed correctly)
  - HTTP representation
  - cURL example

- Supports:
  - **boolean fields (true/false QuickPick)**
  - **choice / OptionSet fields (label + value selection)**

👉 Results in:
- safe, transparent data mutation
- no malformed payloads (no free-text errors)
- consistent preview-first mutation behaviour

---

### 🧠 Typed PATCH Input (NEW)

- Replaced free-text PATCH input with **metadata-aware selection**

- Behaviour:
  - Boolean → QuickPick (true / false)
  - Choice → QuickPick (label + numeric value)
  - Prevents invalid payload formats

👉 Eliminates:
- incorrect string payloads (e.g. `"e"`)
- Dataverse 400 errors due to type mismatch

---

### 🔁 PATCH → Result Viewer Refresh (Stabilised)

- Result Viewer now refreshes **automatically after PATCH**

- Behaviour:
  - uses **Insight Model (original query context)**
  - re-runs query to reflect updated data

- Improved resilience:
  - refresh failures → **warning (non-blocking)**
  - PATCH success not lost due to UI issues

👉 Ensures:
- reliable edit → verify loop
- consistent post-update visibility

---

### 🧠 Insight Model as Source of Truth

- Enforced architectural invariant:

> Insight Model is the **single source of truth** for:
- query execution
- PATCH context
- Result Viewer refresh
- rerun actions

- Removed reliance on:
  - editor reconstruction
  - ad-hoc query rebuilding

👉 Results in:
- consistent workflow behaviour
- strong foundation for future features

---

### 📊 Result Viewer UX Refinement (Major)

#### Null Handling Improvements

- Null values now rendered as:
  - `∅` (visual indicator)
  - tooltip: **"Null value"**

- Behaviour safeguards:
  - copy actions → return `null` (not `∅`)
  - prevents accidental PATCH corruption

#### Filter / Slice Consistency Fix

- Enforced **single-condition-per-column rule (non-date fields)**

- Behaviour:
  - applying new filter/slice replaces existing condition for same field
  - prevents:
    - duplicate `eq null`
    - conflicting `eq null` + `ne null`

👉 Fixes:
- broken query states
- invalid logical combinations

---

### 🔍 Result Viewer Actions (Improved)

- **Filter by this value**
  - now fully wired and functional
  - supports null values correctly (`eq null`)

- **Slice behaviour refinement**
  - `is null` / `is not null` now mutually exclusive
  - behaves predictably across repeated actions

- **Column header actions**
  - moved sorting + filter actions to header-level where appropriate

---

### 📦 Copy Actions (Optimised)

- Added:
  - Copy display value
  - Copy raw value
  - Copy row JSON

- Performance optimisation:
  - **row JSON no longer precomputed for all rows**
  - generated **on-demand only**

- UX refinement:
  - **Copy row JSON only available on primary key column**

👉 Results in:
- faster table rendering
- reduced memory overhead
- cleaner action surface

---

### ⚡ Result Viewer Performance Improvements

- Removed eager row JSON construction
- Reduced per-cell payload overhead
- Deferred heavy operations to interaction time

👉 Results in:
- faster initial render
- smoother scrolling
- improved responsiveness on large datasets

---

### 🧩 Expand Field Guardrails

- Prevented invalid PATCH on expanded fields

- Behaviour:
  - expanded fields show:
    - **“Update expanded field unavailable”**
  - avoids invalid mutation paths

👉 Ensures:
- safe mutation boundaries
- clearer UX expectations

---

### 📊 Result Viewer Workflow Completion

DV Quick Run now supports full loop:
```
Query → Result → Refine → PATCH → Refresh → Continue
```

- Result Viewer acts as:
  - command surface
  - mutation entry point
  - verification layer

👉 Establishes:
- full interactive Dataverse workflow inside VS Code
- reduced need for external tools

---

### 🧾 Logging & UX Improvements

- Improved execution logs:
  - clearer success/failure states
  - reduced noise
  - consistent formatting

- Error handling:
  - PATCH failures → clear diagnostic output
  - refresh failures → warning only

👉 Results in:
- better clarity
- improved trust in system behaviour

---

### 🧪 Stability

- Verified:
  - Smart PATCH (boolean + choice)
  - PATCH preview → apply flow
  - Result Viewer refresh via Insight Model
  - filter/slice deduplication logic
  - null handling + copy safety
  - performance improvements (row JSON deferral)

- No regression in:
  - Guided Traversal
  - Query Doctor
  - Result Viewer interactions
  - `$batch` execution
  - preview-first mutation pipeline

---

## 🧭 Notes

This release marks a major milestone:

Key principles reinforced:
- preview-first safety
- metadata-aware mutation
- insight-driven execution
- result-driven refinement

--

## v0.9.4 — Smart PATCH, Insight Model Alignment & Workflow Completion

This release completes the **end-to-end query → refine → PATCH → refresh workflow**, establishing DV Quick Run as a **true interactive Dataverse workbench**.

It focuses on:
- introducing **Smart PATCH (preview-first, safe mutation)**
- aligning all post-execution behaviour with the **Insight Model as source of truth**
- stabilising **PATCH → Result Viewer refresh loop**
- tightening UX, logging, and interaction consistency

---

### ✏️ Smart PATCH (Preview → Apply → Refresh)

- Introduced **Smart PATCH workflow**
  - Update Dataverse records directly from Result Viewer interactions

- Full workflow:
  1. user triggers update (e.g. from cell)
  2. PATCH preview document opens
  3. confirmation dialog shown
  4. PATCH executed on confirmation
  5. Result Viewer refreshes using original query context

- Preview includes:
  - entity + record ID
  - PATCH path
  - payload
  - HTTP representation
  - cURL example

👉 Results in:
- safe, transparent data mutation
- no hidden updates
- consistent preview-first behaviour across DV Quick Run

---

### 🔁 PATCH → Result Viewer Refresh (Stabilised)

- Result Viewer now refreshes **automatically after PATCH**

- Behaviour:
  - uses **original query context**
  - re-runs query to reflect latest data

- Improved resilience:
  - refresh failures do **not break workflow**
  - surfaced as warning instead of hard error

👉 Ensures:
- consistent feedback loop
- reliable post-update visibility
- smoother edit → verify experience

---

### 🧠 Insight Model as Source of Truth

- Introduced architectural invariant:

> Insight Model is the **single source of truth** for:
- query execution
- PATCH context
- Result Viewer refresh
- rerun actions

- Removed reliance on:
  - editor text reconstruction
  - ad-hoc query rebuilding

👉 Results in:
- consistent behaviour across workflows
- stronger foundation for future features

---

### 📊 Result Viewer Workflow Completion

- DV Quick Run now supports full loop:
  ```
  Query → Result → Refine → PATCH → Refresh → Continue
  ```

- Result Viewer continues to act as:
  - **command surface**
  - **mutation entry point**
  - **verification surface**

👉 Establishes:
- a complete, iterative data workflow
- reduced need to leave VS Code for updates

---

### 🧾 Logging & UX Improvements

- Improved execution logs:
  - clearer success states
  - reduced noise
  - consistent formatting

- Error handling improvements:
- PATCH failures → clear error messaging
- refresh failures → warning (non-blocking)

👉 Results in:
- better developer clarity
- less confusion during workflows
- improved trust in execution

---

### 🧪 Stability

- Verified:
- PATCH preview → apply flow
- Result Viewer refresh using Insight Model
- query path correctness across environments
- error handling for failed refresh scenarios

- No regression in:
- Guided Traversal
- Result Viewer interactions
- Query Doctor
- `$batch` execution
- preview-first mutation pipeline

---

## 🧭 Notes

This release marks a major milestone:

- DV Quick Run evolves from:
- **query tool**
→ to:
- **interactive Dataverse workflow environment**

Key principles reinforced:
- preview-first safety
- insight-driven execution
- result-driven refinement
- consistent interaction loop

---

## v0.9.3 — Result Viewer Command Surface & Preview-First Refinement

This release completes the transition of the **Result Viewer into a primary interaction surface**, enabling **preview-first, context-aware query refinement directly from data**.

It focuses on:
- unifying **Result Viewer actions** into a consistent system
- strengthening **preview-first mutation workflows**
- improving **UX clarity through disabled states and guardrails**
- reinforcing a predictable **inspect → preview → apply loop**

---

### 📊 Result Viewer as Command Surface (Expanded)

- Result Viewer now acts as the **primary query interaction surface**
  - users can refine queries directly from returned data
  - reduces reliance on manual query editing

- Supported interactions:
  - add `$select` from column
  - filter by value
  - order by column
  - investigate records

👉 Results in:
- tighter feedback loop between data and query
- more intuitive refinement workflow
- reduced cognitive load when building queries

---

### ✨ Add to `$select` from Column (NEW)

- Added **“Add this column to $select”** action
  - available from column/cell context menu

- Behaviour:
  - detects correct scope:
    - root query
    - `$expand`
    - nested `$expand`
  - updates `$select` accordingly

- Uses **preview-first workflow**:
  - generates preview query
  - allows confirmation before applying

👉 Results in:
- faster field selection
- safer query mutation
- consistent with Query-by-Canvas philosophy

---

### 👁️ Preview-First Mutation (Standardised)

- All Result Viewer actions now follow a **consistent preview-first pattern**

Workflow:
1. user triggers action
2. preview document opens
3. confirmation dialog shown
4. query updated only on explicit confirmation

- No silent mutations
- No hidden side effects

👉 Ensures:
- full user control
- predictable behaviour
- safe experimentation

---

### 🚫 Disabled Actions with Clear UX (NEW)

- Actions that are not valid are now:
  - visibly **disabled**
  - styled consistently across menus

- Examples:
  - `$orderby` on invalid scopes (e.g. single-valued expand)
  - unsupported mutation scenarios

- Disabled actions:
  - do not execute
  - do not trigger preview
  - communicate limitation clearly via UI

👉 Results in:
- reduced confusion
- better discoverability of supported operations
- stronger UX consistency

---

### ⚠️ Guardrail & Scope Validation Improvements

- Strengthened validation for query mutations:
  - prevents invalid `$orderby` usage
  - ensures correct scope application
  - avoids malformed queries

- Query mutation now:
  - respects entity boundaries
  - avoids incorrect nesting
  - merges safely with existing clauses

👉 Prevents:
- runtime Dataverse errors
- incorrect query generation
- unintended query side effects

---

### 🧠 Behaviour Improvements

- Result Viewer actions now:
  - use unified mutation pipeline
  - align with preview system
  - respect scope-awareness consistently

- Improved consistency across:
  - Result Viewer
  - editor mutations
  - preview pipeline
  - traversal outputs

- Cleaner interaction model:
  - no mixed behaviours between actions
  - no partial or silent updates

---

### 🧪 Stability

- All unit tests passing
- Verified:
  - `$select` mutation across scopes
  - preview → apply workflow
  - disabled action behaviour
  - Result Viewer interactions
- No regression in:
  - Guided Traversal
  - Graph rendering
  - `$batch` execution
  - Query Doctor

---

## 🧭 Notes

This release marks an important shift:

- Result Viewer evolves from:
  - **data display**
→ to:
  - **interactive query workspace**

DV Quick Run now:
- enables **data-driven query refinement**
- enforces **preview-first safety**
- provides **clear action boundaries via UI**

This establishes the foundation for:
- deeper Query-by-Canvas workflows
- result-aware Query Doctor actions
- richer table-driven analysis capabilities

---

## 🚀 v0.9.2 — Guided Traversal Graph, Context-Aware Query Mutation & Result Viewer Actions

This release expands **Guided Traversal** with a stronger **graph reasoning surface**, while also introducing **scope-aware query mutation** and enhancing the Result Viewer as an **interactive command surface**.

It focuses on:
- improving **visual traversal understanding**
- applying query changes in the **correct scope**
- enabling **data-driven refinement directly from results**
- improving **safety and guardrails** for OData operations

---

### 🧭 Guided Traversal Graph (Expanded)

- Significantly improved the **Guided Traversal Graph** experience
  - graph now acts as a clearer reasoning surface for route selection
  - focuses on **path-level understanding**, not full-schema noise

- Graph behaviour improvements:
  - highlights only the **selected traversal path**
  - dims non-selected nodes and edges to reduce confusion
  - prevents highlight leakage from unrelated visible routes
  - improves route focus consistency during graph interaction

- Search and filtering improvements:
  - graph search now filters to **searched paths**
  - selected route remains visually coherent after filtering
  - graph only keeps relevant route context instead of mixing unrelated paths

- Route selection UX improvements:
  - route chips remain the primary selection mechanism
  - selected route panel now better explains:
    - rank
    - hop count
    - confidence
    - warnings
    - route variants

- Confidence / variant presentation improvements:
  - route variants are grouped more clearly
  - confidence is surfaced in a more readable way
  - selected route remains the primary visual emphasis

👉 Results in:
- clearer route comparison
- stronger path reasoning
- less graph confusion
- better transition from visual selection → query action

---

### ✨ Context-Aware Query Mutators

- `$select`, `$filter`, and `$orderby` mutators are now **scope-aware**
  - Detects whether the cursor is inside:
    - root query
    - `$expand`
    - nested `$expand`
  - Applies mutations to the **correct entity scope**

- Example:
  - Right-click inside:
    ```
    $expand=owninguser(...)
    ```
  - `Add Select Fields` now updates:
    ```
    owninguser($select=...)
    ```
  - Instead of incorrectly modifying root `$select`

👉 Results in:
- correct query construction
- reduced manual fixes
- safer multi-entity queries

---

### 🔍 Scoped Filter 

- Added **scope-aware `$filter` mutation**
  - Filters can now be applied at:
    - root level
    - nested expand level

- Automatically:
  - detects correct scope
  - merges with existing filters using `and`

👉 Enables:
- precise filtering of expanded entities
- cleaner multi-entity query refinement

---

### 📊 Result Viewer → Filter by Value 

- Added **“Filter by this value”** action in Result Viewer
  - Available via kebab menu on cell values

- Supports:
  - OData → `$filter`
  - FetchXML → `<condition>`

- Workflow:
  - click value → preview filter → apply

👉 Results in:
- inspect → refine → rerun loop
- zero manual typing for common filters

---

### ↕️ Add Order By from Column Header 

- Right-click on **column headers** to add `$orderby`
  - Default:
    - ascending order

- Behaviour:
  - Applies only to **root-level fields**
  - Prevents invalid nested usage

👉 Results in:
- fast sorting from Result Viewer context
- improved discoverability of ordering

---

### ⚠️ Order By Guardrails 

- Added validation for `$orderby` usage inside `$expand`

- Behaviour:
  - ❌ blocks `$orderby` on **single-valued expands**
    - e.g. `owninguser`, `primarycontactid`
  - ⚠️ shows warning with guidance

👉 Prevents:
- invalid OData queries
- runtime API errors

---

### 🧠 Result Viewer Interaction Improvements

- Result Viewer evolves further into a **query command surface**
  - filter from values
  - order from headers
  - investigate records

- Improved UX:
  - consistent action naming:
    - “Filter by this value (OData)”
    - “Filter by this value (FetchXML)”
  - better action grouping under kebab menus

- Fixed:
  - header right-click positioning (z-index layering)
  - action menu visibility over table
  - suppression of default browser-style context menu on table headers

---

### 🧱 Behaviour Improvements

- Query mutation now:
  - respects entity scope
  - avoids overwriting unrelated clauses
  - merges intelligently with existing query options

- Graph rendering now:
  - keeps selected route visually intact
  - avoids misleading emphasis on unrelated nodes
  - better aligns with actual traversal reasoning

- Improved consistency between:
  - traversal graph
  - editor mutators
  - Result Viewer actions
  - preview pipeline

---

### 🧪 Stability

- Verified:
  - traversal graph rendering across route selections
  - searched-path graph filtering
  - scoped `$select`, `$filter` mutation
  - Result Viewer filter actions
  - header-based `$orderby`
  - guardrail behaviour

- No regression in:
  - Guided Traversal
  - `$batch` execution
  - Query Doctor
  - Result Viewer rendering

---

## 🧭 Notes

This release strengthens DV Quick Run in two major directions:

- **Guided Traversal** becomes a clearer **visual reasoning tool**
- **query mutation** becomes **context-aware and result-driven**

DV Quick Run now:
- helps users understand relationships more clearly through graph-assisted traversal
- understands **where** a change should be applied
- enables **data-driven refinement directly from results**
- prevents invalid query patterns through guardrails

---

## 🚀 v0.9.1 — Guided Traversal Graph & Result Viewer Stability

This release focuses on **visual traversal selection** and **webview stability fixes**, building on top of the Guided Traversal foundation introduced in v0.9.0.

It introduces a **graph-assisted reasoning surface** and resolves a critical **Result Viewer rendering issue** observed in newer VS Code environments.

---

### 🧭 Guided Traversal Graph (NEW)

- Added **Guided Traversal Graph** as a visual companion to traversal
  - Opens a dedicated graph panel for route exploration
  - Displays:
    - grouped traversal paths
    - selected route details
    - relationship chain (via fields)

- Graph behaviour:
  - focused **path-only rendering** (not full schema)
  - highlights only the selected traversal route
  - avoids noisy system relationships
  - supports multi-hop paths (e.g. account → contact → team → task)

- Route selection UX:
  - route chips act as primary selectors
  - selecting a route updates:
    - graph view
    - selected route panel
  - variants displayed with confidence indicators

👉 Results in:
- clearer mental model of relationships
- faster route comparison
- reduced traversal guesswork

---

### ⚡ Graph → Traversal Execution (NEW)

- Added **Use this route** action in graph panel
- Selecting a route now:
  - triggers actual Guided Traversal execution
  - passes selected relationship chain to traversal engine
  - closes graph panel after selection

- Enables:
  - visual selection → immediate execution
  - seamless transition from reasoning → action

👉 Establishes graph as:
- a **decision surface**, not just visualization
- tightly integrated with traversal workflow

---

### 🧱 Result Viewer Stability Fix (Critical)

- Fixed **blank Result Viewer rendering issue**
  - caused by webview lifecycle changes in newer VS Code versions (1.116.0)

- Changes:
  - switched from panel reuse → **fresh webview panel creation**
  - ensured reliable HTML assignment and script execution
  - removed inconsistent render states

👉 Results in:
- consistent Result Viewer rendering
- no more intermittent blank screens
- improved reliability across environments

---

### 🧪 Stability

- Verified:
  - graph rendering across route selections
  - graph → traversal execution handoff
  - Result Viewer rendering across repeated runs
- No regression in:
  - Guided Traversal workflows
  - `$batch` execution
  - Binder suggestions
  - Query-by-Canvas interactions

---

## 🧭 Notes

This release extends Guided Traversal with a **visual reasoning layer**:

- traversal is no longer just step-based
- users can now:
  - see candidate routes
  - compare options visually
  - execute directly from selection

It establishes the foundation for:
- future graph-assisted traversal enhancements
- smarter route ranking and filtering
- deeper integration with Query Doctor and result insights

---

## 🚀 v0.9.0 — Guided Traversal, $batch Execution & Binder Suggestions

This release introduces **Guided Traversal**, **$batch execution workflows**, and a new **Binder suggestion system**, transforming DV Quick Run into a more complete **Dataverse query and workflow workbench**.

It focuses on:
- navigating relationships step-by-step
- executing multi-query workflows efficiently
- surfacing high-confidence next steps without adding noise

---

### 🧭 Guided Traversal (Renamed & Refined)

- Renamed **Find Path to Table** → **Guided Traversal**
- Improved discoverability:
  - available via Command Palette
  - available via editor right-click
- Simplified traversal output:
  - reduced noise and removed redundant metadata
  - clearer step-by-step progression
- Improved completion flow:
  - clearer indication when traversal is complete
  - better alignment with follow-up actions (e.g. $batch)

👉 Results in:
- faster understanding of relationships
- cleaner traversal experience
- more intuitive workflow progression

---

### ⚡ $batch Execution (NEW)

- Added support for running **multiple queries as `$batch`**
- Enables:
  - executing multiple queries in a single request
  - validating multiple endpoints together
  - more efficient query execution workflows

- Supports:
  - manual multi-query selection → run as `$batch`
  - traversal replay → run full traversal as `$batch`

- Result Viewer improvements:
  - displays per-query results
  - shows combined execution summary

👉 Establishes `$batch` as:
- both a **general execution tool**
- and a **natural continuation of Guided Traversal**

---

### 🧠 Binder Suggestions (NEW)

- Introduced **Binder** — a lightweight, context-aware suggestion system
- Surfaces **single, high-confidence recommendations** as a light-bulb hint

Examples:
- Continue traversal
- Run traversal as `$batch`
- Refine `$batch` execution
- Add `$top` / `$select` for broad queries

Key behaviour:
- only one suggestion shown at a time
- appears only when confidence is strong
- suggestion text is directly clickable
- suggestion is **consumed after click** (no stale hints)

👉 Results in:
- guided workflows without UI clutter
- faster iteration
- minimal, non-intrusive assistance

---

### 🧹 Traversal Denoising & UX Improvements

- Removed low-value output elements:
  - SQL-style mental notes
  - redundant relationship explanations
- Focused output on:
  - steps
  - entities
  - execution flow
- Improved readability of traversal logs and results

---

### ⚙️ Behaviour Improvements

- Binder now:
  - prioritises traversal and `$batch` workflows over generic suggestions
  - avoids suggesting `$top` when already present
  - handles no-active-editor scenarios safely
  - resolves queries using execution context instead of cursor position

- Improved consistency between:
  - traversal output
  - Result Viewer
  - Binder suggestions

---

### 🧪 Stability

- All unit tests passing
- Verified:
  - traversal workflows (start → continue → complete)
  - `$batch` execution (manual + traversal)
  - Binder suggestion lifecycle (show → click → consume)
- No regression in:
  - query execution
  - Result Viewer
  - Query-by-Canvas workflows

---

## 🧭 Notes

This release marks a shift from:

- **query execution tools**
→ **guided query + workflow execution experience**

It establishes the foundation for:
- smarter recommendation ranking
- deeper Query Doctor integration
- result-driven workflow suggestions

---

## 🚀 v0.8.5 — Explain UX Refinement & Actionable Execution Loop

This release focuses on **clarifying Explain output** and introducing a **tight action → preview → apply workflow**.

It transforms Query Doctor from **advisory-only** into a **directly actionable experience**, while keeping the interface minimal and noise-free.

---

### ✨ Explain Output Simplification

- Removed redundant phrasing:
  - eliminated `"Recommended next step:"` duplication
- Promoted **section title as the primary signal**
  - `### ⭐ Recommended next step` is now sufficient
- Tightened wording across:
  - actions
  - evidence
  - rationale

👉 Results in:
- cleaner scan
- faster comprehension
- stronger confidence in suggestions

---

### ⚡ Apply Preview (Pro)

- Introduced **`Apply preview` CodeLens inside Explain output**
- Appears directly within diagnostic sections:
  - Recommended next step
  - Advisory sections (e.g. `$select`, `$top`)

- Positioned:
  - **just above “Preview query”**
  - close to execution context (not header)

- Enables:
  - one-step transition from insight → execution
  - preview-first safe mutation workflow

---

### 🔓 Free vs Pro Behaviour

- **Free**
  - Shows:
    - Action
    - Evidence
    - Reasoning
    - Preview query
  - No execution shortcut

- **Pro**
  - Adds:
    - `Apply preview` inline action
  - Enables:
    - direct mutation workflow
    - faster iteration loop

👉 Maintains:
- full learning experience for free users
- execution acceleration for Pro users

---

### 🔁 Consistent Execution Pattern

- Standardised across Explain:
Action
Apply preview (Pro)
Preview query
Evidence


- Applied to:
- narrowing suggestions
- `$select` advisory
- `$top` advisory

👉 Establishes a consistent **Explain → Act → Iterate loop**

---

### 🧠 Query Doctor UX Evolution

- Shifts Query Doctor from:
- “analysis + suggestion”

- To:
- **analysis → recommendation → executable action**

- Aligns with:
- Query-by-Canvas principles
- preview-first mutation pipeline

---

### 🧹 UX Improvements

- Reduced visual clutter in Explain output
- Improved proximity between:
- suggestion
- execution action
- Removed unnecessary repetition and verbose phrasing

---

### 🧪 Stability

- All unit tests passing
- Verified:
- Explain rendering
- CodeLens injection
- Preview workflow integration
- No regression in:
- Run Query
- Investigate Record
- Query execution pipeline

---

## 🧭 Notes

This release marks the transition from:

- **advisory diagnostics**
→ **actionable diagnostics**

It lays the groundwork for:

- multi-option recommendations
- ranked suggestions
- deeper Query Doctor intelligence (v0.9+)

## 🚀 v0.8.4 — Intelligence Foundation Refactor (Stabilisation Release)

This release focuses on **internal architecture stabilisation** and **intelligence layer consolidation** across Investigate Record and Query Doctor.

No major UX changes, but this is a **foundational release** that enables deeper intelligence features moving forward.

---

### 🧠 Shared Intelligence Layer (NEW)

- Introduced shared primitives for:
  - identifier detection (e.g. `id`, `_id`, `fhirid`, etc.)
  - field semantics classification
  - candidate scoring and ranking
- Eliminates duplicated heuristics across:
  - Investigate Record
  - Query Doctor
- Establishes a reusable foundation for future intelligence features

---

### 🔍 Investigate Record — Decoupled from Traversal

- Investigate Record now operates independently from traversal
- Introduced dedicated configuration:
  - `dvQuickRun.investigate.searchScopeTables`
  - `dvQuickRun.investigate.maxSearchTables`
  - `dvQuickRun.investigate.maxSearchColumns`
- Default search scope now includes:
  - `account`
  - `contact`
- Removes reliance on traversal `allowedTables`

---

### ⚙️ Configurable Search Scope (NEW)

- Search scope is now:
  - explicit
  - bounded
  - user-configurable
- Improves transparency and avoids hidden behaviour limits

---

### 📊 Result Insight Pipeline (INTERNAL)

- Introduced structured pipeline:
  - Extract → Classify → Score → Rank → Suggest
- Enables:
  - better candidate prioritisation
  - cleaner extensibility for Query Doctor and Investigate
- Lays groundwork for future result-aware diagnostics

---

### 🧹 Logging & Output Cleanup

- Removed traversal-branded logging from Investigate flows
- Introduced concise investigate-specific logging:
[Investigate] Search scope applied: account, contact

- Eliminated noisy duplicate scope logs within a single run

---

### 🧱 Internal Refactor

- Reduced “God file” complexity across:
- Investigate Record
- Query Doctor (partial)
- Improved separation of concerns:
- detection vs scoring vs execution
- Prepared codebase for future modular rule expansion

---

### ⚡ Behaviour Improvements

- Improved weak-context identifier resolution (e.g. GUID pasted without entity context)
- Better handling of fields like:
- `msemr_azurefhirid`
- custom identifier-style columns
- More consistent ranking of candidate matches

---

### 🧪 Stability

- All unit tests passing
- No regression in:
- Query execution
- Explain
- Investigate Record flows
- Manual validation completed across common workflows

---

## 🧭 Notes

This is a **stabilisation and foundation release**.

The changes in v0.8.4 enable:
- deeper Query Doctor intelligence
- improved Investigate Record capabilities
- future result-aware diagnostics and suggestions

---

## [0.8.3] - Improved Investigate Record without Schema Context

### New

- 🔎 **Editor-first Investigate Record (GUID-only support)**
  - Investigate Record can now be triggered directly from a **selected GUID in the editor**
  - No Quick Pick or entity selection required
  - Enables fast workflow: copy GUID → run → resolve

- 🧠 **Context-aware identifier resolution**
  - Automatically resolves identifiers using:
    - Result Viewer context (when available)
    - Metadata-driven lookup across allowed tables (when no context)
  - Supports both:
    - standard primary IDs (e.g. `contactid`)
    - surfaced identifier-like fields

- ⚙️ **Bounded identifier search via `allowedTables`**
  - Resolution scope is limited to:
    - `dvQuickRun.traversal.allowedTables`
  - Prevents brute-force scanning in large environments
  - Keeps performance predictable and safe

- ⚡ **Investigate Record resolution accuracy**
  - Improved handling of primary ID fields using metadata instead of heuristics
  - Better support for non-obvious identifiers across entities

- 🧾 **Clear unresolved feedback**
  - When identifier cannot be resolved:
    - Displays searched scope
    - Avoids misleading or partial matches

---

## [0.8.2] — Result-Driven Query Doctor & Investigate Interpretation

### New

- Added **result-driven narrowing insights** to Query Doctor
  - Surfaces narrowing suggestions from **observed result patterns**
  - Supports:
    - repeated categorical values on the current page
    - meaningful null vs non-null splits
  - Keeps suggestions **page-aware** and scoped to the currently returned page
  - Continues to prioritise **business-meaningful fields** over low-signal technical fields

- Added **investigate support for surfaced business-like GUID columns** in the Result Viewer
  - Inline 🔎 investigate action now appears for eligible **non-primary-key GUID fields**
  - Supports surfaced business/reference-style fields such as:
    - address / related-record identifiers
    - other visible GUID columns that look like meaningful record references
  - Avoids promoting hidden lookup-backing noise such as `_..._value` columns

- Added **Interpretation** section to Investigate Record
  - Provides a fast heuristic meaning layer near the top of the investigation output
  - Highlights:
    - what the record likely represents
    - contextual cues when available
    - when a record may be easier to recognise by technical role or relationship than by display name

---

### Improved

- Improved **Query Doctor usefulness**
  - Moves from evidence-only pattern detection toward more readable **result-driven guidance**
  - Makes narrowing suggestions easier to notice and act on

- Improved **record investigation readability**
  - Investigation output now gives quicker “what am I looking at?” guidance
  - Helps make technical or system-linked records easier to understand at a glance

- Improved **Result Viewer actionability**
  - More surfaced GUID columns can now be investigated directly from the table
  - Maintains low-noise behaviour by avoiding obvious technical backing fields

---

### 🔧 Behaviour Changes

- Query Doctor now includes **result-driven narrowing hints** when current-page evidence is meaningful
- Investigate actions may now appear on **eligible surfaced non-PK GUID columns**, not just primary key columns
- Investigate Record output now includes an **INTERPRETATION** section before the detailed field summary

---

### 🧱 Architecture

- Introduced a lightweight **Result Insight Engine v1** inside the Query Doctor analysis flow
- Preserved separation between:
  - Query Doctor analysis
  - Result Viewer presentation
  - Investigate Record document generation

- Added a heuristic **interpretation builder** for investigation output
  - intentionally lightweight
  - advisory-only
  - non-authoritative

---

### 🧪 Testing

- Added coverage for:
  - result insight detection and rendering
  - surfaced business GUID investigate eligibility
  - investigation interpretation section generation

---

### ⚠️ Notes

- Result-driven insights are intentionally **current-page scoped**
  - they do not imply full dataset truth when paging is involved

- Investigate from business-like GUID columns is **best-effort**
  - some surfaced GUID fields may still require the correct target table choice to resolve successfully

- Lookup fields that do not expose a surfaced GUID value in the table may not show investigate actions in this release

- Interpretation output is heuristic guidance
  - it is designed to improve fast understanding, not to act as a source of truth

---

## [0.8.1] — Result Viewer Enhancements & Large Dataset Handling

### New

- Improved **business-aware field prioritisation in Query Doctor**
  - Boosts meaningful categorical fields (e.g. status, intent, type)
  - De-prioritises technical or low-signal fields (e.g. lookup IDs, GUIDs)
  - Produces more relevant and actionable narrowing suggestions

- Added **Save JSON action** in Result Viewer
  - Exports current dataset to file
  - Uses contextual filename:
    - `dvqr_<entity>-page-<n>.json`

- Introduced **Large Result Mode**
  - Automatically activates for large datasets (thousands of rows)
  - Prevents UI blocking during heavy renders

- Added **progressive rendering engine**
  - Rows render incrementally instead of all-at-once
  - Improves perceived responsiveness

- Added **auto-progressive loading (no user interaction required)**
  - Automatically continues rendering until full dataset is loaded
  - Eliminates need for manual “Load more”

- Added **render progress indicator**
  - Displays:
    - rendered row count vs total (e.g. `1400 of 5000 rows`)
  - Provides visibility into loading state

- Added **large dataset feedback banner**
  - Communicates:
    - partial rendering
    - ongoing background loading

---

### 🧠 Improvements

- Improved **Explain (Query Doctor) relevance**
  - Suggestions now favour business-meaningful fields over technically valid but low-value fields
  - Reduces noise from:
    - lookup `_..._value` fields
    - system identifiers
  - Surfaces fields users actually care about when analysing results

- Improved **Result Viewer responsiveness for large datasets**
  - Faster initial paint (partial render visible immediately)

- Improved **export usability**
  - Context-aware filenames replace generic defaults

- Improved **perceived performance**
  - Users can interact with partial data while rendering continues

---

### 🔧 Behaviour Changes

- Large datasets now:
  - render progressively instead of blocking UI
  - load automatically without requiring manual interaction

- Result Viewer prioritises:
  - early visibility of data
  - over full blocking render completion

---

### 🧱 Architecture

- Introduced **chunked rendering pipeline**
  - Breaks large datasets into smaller render batches

- Added **auto-progressive render loop**
  - Continues rendering asynchronously until completion

- Strengthened separation between:
  - data retrieval
  - rendering pipeline

---

### ⚠️ Notes

- Query Doctor now applies lightweight heuristics to prioritise business-relevant fields
- Field selection is still heuristic-based and will continue to improve in future releases
- Rendering very large datasets (thousands of rows) is still subject to browser/DOM limits
- Progressive rendering improves visibility and responsiveness but does not eliminate total render cost
- This release prioritises **perceived performance and usability** over full virtualization

---

## [0.8.0] — Evidence-Aware Query Doctor & Structured Narrowing Insights

### 🚀 New

- Introduced **evidence-aware Query Doctor**
  - Uses query shape, returned row patterns, and lightweight execution evidence
  - Moves beyond static advisory text into **result-aware guidance**

- Added **structured narrowing insights**
  - Surfaces narrowing opportunities based on observed result patterns
  - Supports:
    - **Categorical splits** (repeated low-cardinality values such as status/state)
    - **Presence splits** (null vs non-null patterns)

- Added **explainable suggestion reasoning**
  - Each suggestion includes *why* it was surfaced
  - Examples:
    - repeated values with counts
    - populated vs null distribution
  - Improves trust and transparency of Query Doctor outputs

- Introduced **structured narrowing model (foundation)**
  - Separates:
    - observed evidence
    - narrowing candidates
    - deterministic suggested queries
  - Prepares for future interactive refinement workflows

---

### 🧠 Improvements

- Improved **Query Doctor usefulness**
  - From generic advice → **evidence-based narrowing guidance**

- Improved **metadata accuracy of suggestions**
  - Suggested queries now use valid fields for the target entity
  - Prevents incorrect cross-entity field suggestions

- Improved **formatted value usage**
  - Prefers human-readable values (e.g. `Active`, `Married`)
  - Falls back safely when formatted values are not available

- Improved **narrowing candidate quality**
  - De-prioritises low-signal fields:
    - GUIDs / IDs
    - booleans
    - timestamps (initial release)
  - Prioritises:
    - choice / status fields
    - repeated categorical values
    - meaningful null/non-null splits

---

### 🔧 Behaviour Changes

- Query Doctor is now **analysis-first**
  - Surfaces:
    - observed patterns
    - narrowing opportunities
    - suggested queries
  - Focuses on insight before action

- Narrowing suggestions are triggered by:
  - **actual observed result patterns**
  - not static or predefined rules

---

### 🧱 Architecture

- Introduced **structured narrowing model**
  - Clean separation of:
    - evidence
    - suggestions
    - deterministic queries

- Reinforced separation between:
  - Result Viewer (presentation)
  - Query Doctor (analysis)

- Preserved formatted annotations for analysis while reducing UI clutter

---

### 🧪 Testing

- Added coverage for:
  - narrowing suggestion rendering
  - metadata-correct query generation
  - formatted-value-aware handling
  - result viewer behaviour (including resize)

---

### 🎯 Design Alignment

- Establishes Query Doctor as:
  - **evidence-driven**
  - **explainable**
  - **metadata-aware**

- Reinforces:
  - insight-first workflows
  - user-controlled refinement

- Prepares the foundation for:
  - interactive query refinement
  - richer execution workflows
  - without changing the analytical model introduced here

---

### ⚠️ Notes

- This release focuses on:
  - insight quality
  - trust
  - explainability
  - correctness

- Interactive refinement workflows will build on top of the structured narrowing foundation introduced in this release

---

## [0.7.7] — Preview System + Query Refinement Improvements

### 🚀 New

- Introduced a **unified preview system**
  - All query refinements now go through a single preview layer
  - Ensures consistency between suggested changes and executed queries
  - Supports multiple refinement workflows (apply or copy)

- Enhanced **Query Doctor with actionable insights**
  - Suggestions are now structured into:
    - informational guidance
    - actionable refinements
  - Enables a smoother “refine-as-you-go” experience

---

### 🧠 Improvements

- Query Doctor now:
  - Surfaces **clear refinement opportunities**
  - Differentiates between:
    - hints (informational)
    - refinements (actionable)
  - Aligns more closely with the **Query-by-Canvas** workflow

- Improved overall **trust and transparency**
  - All changes are preview-first
  - No implicit or hidden query mutations

---

### 🔧 Behaviour Changes

- Query refinements now follow a **preview-first interaction model**
  - Users can review suggested changes before applying or reusing them
  - Supports both direct refinement and manual control workflows

- Output now includes:
  - clearer classification of suggestions
  - consistent preview pathways for all refinements

---

### 🧱 Architecture

- Introduced a centralised **capability resolution layer**
  - Ensures consistent behaviour across different interaction modes
  - Simplifies future extensibility of refinement features

- Enforced:
  - single entry point for capability decisions
  - consistent preview → execution pipeline

- Removed:
  - redundant or unused configuration paths
  - early-stage extension hooks that were not yet in use

---

### 🧪 Testing

- Expanded coverage for:
  - refinement behaviour across interaction modes
  - preview consistency
  - classification of Query Doctor suggestions

---

### 🎯 Design Alignment

- Reinforces core principles:
  - Preview-first interactions
  - User-controlled refinement
  - Clear and explainable system behaviour
  - No hidden automation

---

### ⚠️ Notes

- Current scope focuses on **Query Doctor refinements**
- Other areas (Traversal, Investigate, Explain) remain unchanged

---

## [0.7.6] - 2026-04-XX

### ✨ New — Interactive Filter Refinement (Guardrail + Cue)

- Added intelligent filter value refinement for OData queries
  - Detects `eq` filter values on hover
  - Provides actionable replacement suggestions using metadata (Choice fields)
  - Displays preview options before applying changes (no silent mutation)

- Introduced inline interactive cue system
  - Subtle dotted underline on refinable values
  - Cursor changes to `?` to indicate available actions
  - Enhances discoverability without adding UI clutter

- Hover experience redesigned for choice fields
  - Replaced static value dump with actionable suggestions
  - Shows:
    - Preview replacement options
    - Human-readable labels for current value
    - Clean, focused output (reduced noise)

### 🧠 Architecture

- Introduced reusable refinement engine:
  - `buildChoiceRefinementOptions`
  - Designed for future extensibility (operators, clauses, Query Doctor)

- Separation of concerns:
  - Cue layer (editor UX)
  - Hover layer (insight + preview)
  - Command layer (execution)

### ⚠️ Guardrails

- Only supports safe first-pass scenarios:
  - `eq` operator
  - Single-value filters
  - Standard (non-polymorphic) fields

- Skips:
  - multi-condition (`and` / `or`) ambiguity
  - complex expressions
  - unsupported attribute types

### 📝 Notes

- Static “full value list” removed in favour of action-first UX
- Designed as foundation for:
  - operator mutation (future)
  - inline editing workflows
  - Query Doctor integration

---

## [0.7.5] – Query-by-Canvas (Preview-First Query Construction)

> Introduces **Query-by-Canvas**, a new interaction model for building Dataverse queries through guided, incremental refinement instead of writing full syntax upfront.

### Added

- **Query-by-Canvas (Preview-First Query Construction)**
  - Start with a minimal query (e.g. `contacts`)
  - DV Quick Run detects missing elements and suggests safe refinements
  - Establishes a consistent workflow:
    - detect → suggest → preview → apply
  - Enables progressive query construction without requiring full syntax upfront

- **Preview Add `$top` (Guardrail Actions)**
  - Detects missing `$top`
  - Offers:
    - `Preview add $top=10`
    - `Preview add $top=50`
  - Opens preview document before applying
  - Helps prevent large, unbounded queries

- **Preview Add `$select` (Guardrail Actions)**
  - Detects missing `$select`
  - Offers:
    - `Preview add $select...`
  - Guides users to choose fields before applying
  - Encourages focused, efficient queries

- **Hover-based Filter Value Refinement**
  - Hover on filter values (e.g. `statuscode eq 1`)
  - Shows:
    - decoded meaning (e.g. Active)
    - available alternative values
  - Provides:
    - `Preview replace current filter value`
  - Enables safe, in-place refinement of query semantics

### Improved

- **Guardrail → Preview workflow consistency**
  - Guardrails now provide actionable preview options instead of warnings only
  - Aligns with preview-first philosophy across the extension

- **Query construction UX**
  - Moves from:
    - manual syntax writing
  - to:
    - guided, incremental refinement
  - Reduces need to memorise OData syntax

### Notes

- Query-by-Canvas establishes the foundation for future capabilities:
  - guided `$filter` construction
  - relationship expansion
  - traversal-driven query building
- Focus is on **safe, deterministic, user-approved refinement**
- Complex query generation is intentionally deferred to future releases

---

## [0.7.4] – Preview-First Query Refinement (OData + FetchXML)

> Introduces safe, preview-first query mutation directly from the Result Viewer. Establishes a consistent “generate → preview → apply” workflow across OData and FetchXML.

### Added

- **Preview OData Filter (Result Viewer)**
  - Generate OData `$filter` clauses directly from cell values
  - Opens a reusable preview document showing:
    - original query
    - proposed filter clause
    - full preview query
  - Requires explicit confirmation before applying changes
  - Supports:
    - GUID, numeric, boolean, and string values
  - Automatically merges with existing `$filter` using logical `and`

- **Preview FetchXML Condition (Result Viewer)**
  - Generate FetchXML `<condition>` elements from cell values
  - Preview-first workflow with:
    - original FetchXML
    - proposed condition
    - updated query preview
  - Safe insertion into existing `<filter type="and">` blocks
  - Applies only after user confirmation
  - Fallback to copy when safe insertion is not possible

- **Reusable Query Preview Document**
  - Single preview document reused across all preview actions
  - Prevents tab spamming and keeps workflow focused
  - Standardized structure for:
    - OData
    - FetchXML
    - future mutation features

### Improved

- **Result Viewer → Query refinement workflow**
  - Result Viewer now acts as a **direct mutation surface**
  - Enables:
    - inspect → preview → apply → rerun loop
  - Reduces need for manual query editing

- **Context-aware action visibility**
  - Preview actions are now gated by visible editor mode:
    - OData editor → shows OData preview only
    - FetchXML editor → shows FetchXML preview only
  - Prevents misleading actions and fallback warnings

- **Safer mutation boundaries**
  - Preview actions limited to:
    - root-level scalar fields
  - Aliased / flattened fields (e.g. `a.name`) are excluded from preview
  - Copy actions remain available as fallback

- **Action clarity and UX consistency**
  - Removed confusing “preview → fallback to copy” flow
  - Actions now reflect only what is executable in the current context

### Notes

- Preview actions are intentionally scoped to **safe, deterministic scenarios**
- Complex cases (e.g. nested `link-entity` conditions, polymorphic joins) are deferred to future releases
- Establishes foundation for:
  - Query Doctor auto-fix (preview → apply)
  - table-driven query refinement
  - multi-step mutation workflows

## [0.7.3] – First-Run Experience, Result Viewer UX & Search

> Focused UX release improving onboarding, discoverability, and day-to-day usability. Establishes the Result Viewer as a true command surface for data exploration and action.

### Added

- **First-Run Quickstart Experience**
  - Automatically launches on first install
  - Provides runnable examples with CodeLens integration
  - Guides users through:
    - Run Query
    - Explain Query
    - Expand usage
    - FetchXML execution
    - Relationship exploration (Find Path to Table)
  - Reduces initial friction and improves discoverability of core features

- **Result Viewer Search (Table + JSON)**
  - Unified search across:
    - Table view
    - JSON view
  - Enables fast field/value discovery without manual scanning
  - Significantly improves usability for large result sets

### Improved

- **Result Viewer Empty State UX**
  - Improved “No results found” messaging
  - Added actionable guidance:
    - remove filters
    - increase `$top`
    - run without `$filter`
  - Enhanced spacing and readability for better visual clarity

- **Result Viewer as Command Surface (UX refinement)**
  - Reinforced interaction model:
    - view → search → act → refine
  - Improved alignment with:
    - traversal workflows
    - row-level actions
  - Sets foundation for future table-driven actions (investigate, traversal, mutators)

- **Onboarding discoverability**
  - Key capabilities are now visible immediately on first run
  - Reduces reliance on documentation or prior knowledge

### Notes

- This release focuses on **usability and workflow clarity**, not new core features
- Establishes a stronger foundation for:
  - table-driven actions
  - Query Doctor evolution
  - actionable insight expansion

## [0.7.2] – Sibling Expand & Actionable Insight Foundation

> Introduces metadata-driven enrichment within traversal and lays the foundation for intent-driven execution through the Actionable Insight model.

### Added

- **Sibling Expand (Traversal Enrichment)**
  - Enrich traversal results without leaving the current context
  - Triggered directly from Result Viewer (row/table-driven)
  - Allows selection of fields and related entity for expansion
  - Works on:
    - intermediate legs
    - final legs
    - single-leg traversal
  - Additive behaviour:
    - does not overwrite existing `$expand`
    - merges when expanding the same entity
  - Guardrails:
    - max 3 expands per leg
    - single-level expand only
    - suppressed when no valid relationship exists

- **Actionable Insight (Foundation Layer)**
  - Introduced structured execution intent model
  - Represents user actions (e.g. sibling expand) as deterministic intent
  - Execution flow:
    - user action → insight → mutation pipeline → query execution
  - Enables:
    - additive operations
    - replayable execution patterns
    - future optimisation strategies (composition / $batch)
  - Internal-only foundation (not exposed as user-facing feature)

- **Traversal + Result Viewer integration (enhanced)**
  - Sibling expand available alongside traversal continuation
  - Operates on current landing node
  - Fully compatible with:
    - Continue Traversal
    - multi-leg workflows
    - table viewer interactions

- **Expand mutation behaviour (additive + merge-aware)**
  - Expand is now:
    - additive (no reset of existing expand)
    - merge-aware (same entity expansions combined)
  - Prevents:
    - duplicate expand paths
    - accidental overwrite of previous expansions

- **Traversal enrichment workflow**
  - Users can now:
    - navigate → land → enrich → continue
  - Removes need for manual query rewriting mid-traversal

- **Execution consistency via shared mutation pipeline**
  - All expand operations now flow through the shared mutation pipeline
  - Aligns behaviour across:
    - Add Expand mutator
    - traversal-driven expand

- **Logging clarity (reduced noise)**
  - Removed duplicate scope logs
  - Improved signal-to-noise ratio in execution output

### Notes

- Sibling expand is **not traversal**
  - traversal = navigation
  - sibling expand = enrichment

- Actionable Insight is currently:
  - scoped to traversal/enrichment workflows
  - not yet used across all mutation features

- Future releases will build on this foundation to support:
  - composed multi-hop queries (single query execution)
  - `$batch` execution for multi-request optimisation
  - broader migration of mutation features into Actionable Insight model

## [0.7.1] – Guided Traversal & Continuation Workflow

> Introduces guided traversal with continuation, enabling step-by-step navigation across Dataverse relationships directly from VS Code.

### Added

- **Guided Traversal (Find Path to Table)**
  - Discover relationship paths between Dataverse tables directly from the editor
  - Supports multi-hop traversal with variant (route) selection
  - Introduces itinerary concepts:
    - **Compact** (nested expand / join-like execution)
    - **Mixed** (step-by-step continuation)
  - Provides structured execution output with step-by-step breakdown

- **Traversal Continuation (Multi-leg execution)**
  - Continue traversal across hops using **Continue Traversal**
  - Step-based execution model:
    - `Step X/Y` progression
    - clear landing context at each hop
  - Row-driven continuation:
    - traversal proceeds from selected/landed records
  - Traversal session state maintained across steps

- **Traversal-aware Result Viewer integration**
  - Row-level action:
    - **Continue to {Entity}**
  - Contextual continuation only shown when applicable
  - Traversal state cleared on completion or new traversal
  - Prevents invalid continuation via session key validation

- **Execution strategy support (itinerary-based)**
  - Introduced multiple execution strategies:
    - step-based continuation (sampling-safe)
    - nested expand (context-preserving)
  - Compact itinerary uses nested expand for multi-hop joins
  - Mixed itinerary uses controlled step traversal with safety limits

- **Traversal outcome clarity**
  - Explicit outcomes after each step:
    - landed entity
    - row counts
    - next step availability
  - Clear messaging for:
    - successful landing
    - empty results
    - traversal completion

- **Proven Route Detection (in-session)**
  - Tracks successful traversal variants during session
  - Highlights previously successful paths in picker
  - Displays:
    - ⭐ Proven routes
    - usage count
  - Enables faster reuse of known-good traversal paths

- **Configuration Migration Loader**
  - Automatically injects new settings for existing users:
    - `dvQuickRun.productPlan`
    - `dvQuickRun.traversal.allowedTables`
    - `dvQuickRun.traversal.excludedTables`
  - Runs on activation
  - Only applies when settings are missing (non-destructive)
  - Ensures backward compatibility for existing installations

---

### Notes

- Guided Traversal introduces a new **multi-leg workflow model** for Dataverse queries
- Step-based traversal may return empty results when intermediate sampling does not preserve relationship continuity
- Compact (nested expand) itinerary provides better results for **dependent multi-hop relationships**
- Proven routes are currently **in-memory only** (session-scoped)
- Future enhancements will focus on:
  - adaptive execution strategy
  - persisted traversal history
  - shareable traversal keys

### [0.7.0] – Query Doctor Foundation & Suggested Fix Engine

### Added
- **Query Doctor (Foundation)**
  - Introduced a structured diagnostic engine for Dataverse queries
  - Provides:
    - issue detection
    - advisory guidance
    - prioritised diagnostic output
  - Designed as a non-blocking, developer-assist layer (not strict validation)

- **Suggested Fix Engine**
  - Diagnostics now include actionable suggested fixes where applicable
  - Suggested fixes provide:
    - clear intent (`label`)
    - explanation (`detail`)
    - optional examples for direct usage
  - Enables future expansion into auto-fix and interactive query refinement

- **Diagnostic pipeline architecture**
  - Introduced:
    - `DiagnosticFinding`
    - `DiagnosticSuggestedFix`
  - Separation between:
    - issue detection
    - suggested remediation
  - Supports confidence scoring and future ranking strategies

- **Rule-based diagnostic engine**
  - Introduced modular rule sets:
    - `basicQueryShapeRules`
    - `metadataValidationRules`
  - Enables incremental expansion of Query Doctor capabilities
  - Clean separation between:
    - syntax/shape guidance
    - metadata-aware validation

- **Capability-gated Query Doctor levels**
  - Query Doctor behaviour now scales via capability levels
  - Foundation supports:
    - Level 1: query shape diagnostics
    - Level 2: metadata-aware validation
  - Designed to support future Pro-level expansion

- **Expand advisory (boundary awareness)**
  - Detects `$expand` usage in OData queries
  - Surfaces advisory:
    - Expand diagnostics are currently partial
  - Prevents misleading or incomplete diagnostic guidance
  - Establishes clear capability boundaries for Query Doctor

### Improved
- **Explain Query output with diagnostics integration**
  - Diagnostics are now embedded into Explain output
  - Clear separation between:
    - explanation
    - diagnostics
  - Improved readability and developer guidance

- **Developer experience (actionable feedback)**
  - Queries now provide:
    - what is wrong
    - why it matters
    - how to fix it
  - Reduces guesswork when debugging Dataverse queries

- **Extensibility for future diagnostic features**
  - Architecture now supports:
    - auto-fix generation
    - interactive query refinement
    - deeper semantic reasoning
  - Aligns with future “Query Doctor+” capabilities

### Notes
- Query Doctor in v0.7.0 focuses on **foundation and correctness**
- Advanced scenarios (e.g. deep `$expand`, complex FetchXML semantics) are intentionally scoped for future releases
- Emphasis on **trustworthy guidance over exhaustive validation**

### [0.6.3] – Architecture Consolidation & Investigation Engine Refactor

### Added
- **Investigation engine modular architecture**
  - Split investigation logic into focused modules:
    - `investigationSummaryFields`
    - `investigationLookupSuggestions`
    - `investigationReverseLinks`
  - Introduced `investigationDisplayHelpers` as a shared utility layer
  - Improved separation of concerns across investigation pipeline

### Improved
- **Investigate Record maintainability and structure**
  - Refactored previously large and multi-responsibility modules into cohesive units
  - Reduced complexity of investigation logic for easier future enhancements
  - Improved readability and reasoning of:
    - summary field generation
    - lookup suggestion analysis
    - reverse relationship discovery

- **Result Viewer architecture (render layer separation)**
  - Extracted rendering logic into:
    - `scriptRenderers`
    - `scriptUtilities`
  - Simplified `resultViewerHtml` into a lightweight bootstrap layer
  - Improved separation between:
    - data preparation
    - rendering logic
    - UI interaction handling

- **Codebase consistency and reuse**
  - Consolidated shared helpers:
    - label formatting
    - entity name formatting
    - normalization logic
  - Removed duplicate helper implementations across modules

### Fixed
- Fixed edge cases introduced during refactor where helper dependencies were not correctly resolved
- Fixed reverse-link generation inconsistencies during modular extraction
- Fixed minor type mismatches uncovered during module separation

---

(Structural refactor release focused on maintainability, modularity, and long-term extensibility)

### [0.6.2] – FetchXML Explain (Teaching Mode) & Reasoning Foundation

### Added
- **FetchXML Explain Query (Teaching Mode)**
  - Explain FetchXML queries directly from the editor
  - Provides a structured, human-readable walkthrough of the query
  - Designed to help developers understand query intent, not just syntax

- **Query Overview & Result Shape Explanation**
  - Explains:
    - root entity
    - number of linked entities
    - selected attributes
    - expected result structure
  - Introduces **Result Shape** section describing what each row represents

- **Structure Walkthrough (hierarchical)**
  - Explains FetchXML tree structure in execution order
  - Covers:
    - root entity
    - nested link-entities
    - attribute selection per scope
  - Preserves full hierarchy (no flattening)

- **Relationship Explanation (purpose-based)**
  - Explains joins in plain language
  - Describes:
    - how entities are connected
    - why linked entities are included
    - join direction and behaviour

- **Scope-aware Filter Narration**
  - Groups filters by entity / alias scope
  - Clearly distinguishes:
    - root-level filters
    - linked-entity filters
  - Supports:
    - nested filters
    - AND / OR groupings
    - multi-value conditions (`contain-values`)

- **Operator Meaning Integration**
  - Reuses operator intelligence system from v0.6.1
  - Explains operators such as:
    - `eq`, `not-null`, `this-month`, `contain-values`
  - Includes value contract awareness

- **Advisory Diagnostics & Suggestions**
  - Non-blocking guidance including:
    - missing alias recommendations
    - deep nesting readability notes
  - Maintains advisory (non-mutating) philosophy

- **FetchXML Explain CodeLens support**
  - `Explain` now available for FetchXML queries
  - Aligns FetchXML with OData developer workflow

### Improved
- **FetchXML developer experience**
  - FetchXML evolves from:
    - execution-only → semantic understanding → full query explanation
  - Significantly reduces cognitive load when reading complex queries

- **Metadata enrichment consistency**
  - Unified enrichment for:
    - attributes
    - conditions
    - choice values
  - Choice labels displayed when metadata is available locally
  - Graceful fallback to raw values when metadata is unavailable

- **Metadata enrichment performance**
  - Parallel metadata loading for all entities in the query
  - Deduplicated metadata access per entity
  - Reduced repeated metadata lookups for large queries

- **Explain output readability**
  - Improved narrative flow:
    - Executive Summary
    - Query Overview
    - Result Shape
    - Structure Walkthrough
    - Relationship Explanation
    - Filter Narration
  - More natural, teaching-oriented wording

---

(Major functional expansion introducing FetchXML reasoning and explanation capabilities)

### [0.6.1] – FetchXML Semantic Hover & Operator Intelligence

### Added
- **Full FetchXML operator hover support**
  - Hover on `<condition operator="...">`
  - Displays:
    - polished operator meaning (human-readable)
    - raw operator name
    - grouped classification (comparison, set, relative date, etc.)
    - value expectations (none / single / multiple / range)
    - supported data categories
    - usage examples and diagnostics
  - Covers:
    - comparison (`eq`, `gt`, `on-or-after`, etc.)
    - pattern (`like`, `begins-with`, etc.)
    - set (`in`, `contain-values`, etc.)
    - range (`between`)
    - relative date (`last-x-days`, `this-week`, etc.)
    - fiscal, hierarchy, and ownership operators

- **Choice / OptionSet hover enrichment**
  - Hover on:
    - `<condition attribute="statecode" ... />`
    - `<value>1</value>` and `value="1"`
  - Displays:
    - selected label (e.g. `Active`)
    - full available choice set
  - Aligns FetchXML experience with existing OData choice awareness

- **Relationship-aware hover (FetchXML)**
  - Hover on:
    - `<link-entity name="...">`
    - `from`, `to`, `alias`
  - Displays:
    - relationship metadata
    - target/source entity context
  - Enables understanding of joins directly from the editor

- **Linked-entity field hover**
  - Hover on attributes inside nested `<link-entity>`
  - Displays metadata from the correct related entity scope
  - Supports multi-level nesting

- **Expanded metadata-aware hover coverage**
  - Hover now supports:
    - entity names
    - attribute names
    - operators
    - relationship attributes
    - choice literals
  - Brings FetchXML hover close to OData parity

- **Operator catalog expansion (data-driven)**
  - Fully seeded operator registry covering:
    - core operators
    - relative date family
    - fiscal operators
    - hierarchy operators
    - ownership/context operators
  - Clean grouping and ordering across categories
  - Enables future features (Explain, validation, query doctor)

### Improved
- **FetchXML hover quality and consistency**
  - Hover output now uses:
    - polished labels (human-readable)
    - structured diagnostics
    - consistent formatting across all operator types

- **Scope-aware metadata resolution**
  - Correct entity resolution across:
    - root entity
    - linked entities
    - nested link-entities
  - Eliminates incorrect hover results in complex queries

- **Parity with OData experience**
  - FetchXML now provides:
    - comparable metadata awareness
    - comparable choice decoding
    - comparable developer guidance

- **Foundation for semantic reasoning**
  - Operator metadata now includes:
    - classification
    - value contracts
    - diagnostics
  - Prepares groundwork for:
    - Explain FetchXML
    - query validation
    - query optimisation suggestions

### [0.6.0] – FetchXML Execution & Hover Foundation

### Added
- **FetchXML execution support**
  - Execute FetchXML queries directly from the editor (Run FetchXML)
  - Unified execution pipeline alongside existing OData support
  - Results open in the Result Viewer with full table/JSON toggle support
  - Supports:
    - multiple attributes
    - aliased fields
    - empty result sets
    - Dataverse error propagation (invalid entity, malformed XML, etc.)

- **FetchXML-aware query detection**
  - Automatic detection of FetchXML queries under cursor
  - Context-aware CodeLens:
    - **Run FetchXML** shown for FetchXML queries
    - **Explain Query** remains OData-only

- **FetchXML hover support (first cut)**
  - Hover on:
    - `<entity name="...">`
    - `<attribute name="...">`
  - Displays:
    - logical name
    - display name (if available)
    - basic metadata context
  - Aligns FetchXML experience with existing OData hover model

- **Operator catalog foundation (data-driven)**
  - Introduced JSON-based operator registry
  - Supports:
    - multiple label modes (polished, raw, grouped)
    - diagnostics metadata
    - value contract definition (none/single/multiple)
  - Enables future extensibility without code changes

### Improved
- **Unified query execution experience**
  - OData and FetchXML now share a consistent execution + viewer pipeline
  - Improved consistency across result handling and error surfacing

- **CodeLens clarity**
  - Clear separation between OData and FetchXML actions
  - Reduced confusion by removing unsupported actions for FetchXML

### Fixed
- Fixed incorrect action rendering where FetchXML queries previously showed OData-specific options
- Fixed edge cases in query detection when switching between OData and FetchXML contexts

---

(Minimal UI changes — major functional expansion introducing FetchXML execution and metadata-aware hover)

### [0.5.2] – Stability & Foundations Release

- Improved Result Viewer architecture for future enhancements
- Improved reliability and consistency of table rendering
- Strengthened model-driven rendering pipeline for future features
- Improved handling of object values in the Result Viewer
  - Objects are now correctly classified and rendered via the model-driven pipeline
  - Prevents incorrect table rendering or silent fallback behaviour for object cells
- Metadata retrieval (`Get Metadata`) now opens in the Result Viewer (Table view) instead of raw JSON document
  - Aligns metadata inspection with the standard result exploration workflow
  - Enables consistent use of table, JSON toggle, and future viewer actions
- Expanded test coverage and improved overall stability

(Minimal UI changes — primarily a foundation release with improved consistency and unified result viewer behaviour)

## [0.5.1] - Result Viewer Stabilization & Investigation Input Hardening

### Added
- **Enhanced investigation input handling**
  - Improved support for extracting identifiers from:
    - noisy log text
    - partial JSON fragments
    - mixed content selections
  - Normalized GUID handling (case-insensitive resolution)
  - More reliable candidate selection when multiple identifiers are present

- **Expanded Result Viewer behaviour coverage**
  - Improved handling of complex cells (objects, arrays) via drawer inspection
  - Strengthened raw vs display value separation for action correctness
  - Additional safeguards for column-aware actions on flattened data

### Improved
- **Result Viewer stability**
  - Improved reliability of table rendering across nested and aliased data
  - Reduced UI fragility during re-render cycles
  - Improved consistency of row-level and column-level actions

- **Investigation engine robustness**
  - More resilient input resolution across real-world payloads and logs
  - Improved fallback behaviour when metadata inference is ambiguous
  - Better error messaging when identifier extraction fails

- **Test coverage expansion**
  - Added and refined tests for:
    - investigation input resolution
    - candidate selection edge cases
    - result view model behaviour (flattening, ordering, raw values)

## [0.5.0] - Metadata Engine Stabilization & Explain Query Foundations

### Added
- **Disk-backed metadata cache storage**
  - Metadata caches are now persisted to disk under VS Code `globalStorageUri`
  - File-per-entity storage model for:
    - fields
    - choices
    - relationships
    - relationship explorer
  - Environment-scoped metadata storage directories
- **Metadata storage abstraction layer**
  - Introduced structured storage modules:
    - `storagePaths`
    - `jsonStorage`
    - `metadataStorage`
  - Centralized metadata read/write operations via storage facade
- **Enhanced metadata diagnostics**
  - Diagnostics now show:
    - storage mode (disk-backed vs legacy state)
    - per-cache bucket sizes
    - total persisted metadata size
  - Improved visibility into metadata cache health
- **Lightweight Explain Query relationship advice (Phase 2A)**
  - Explain Query now surfaces **Field Provenance & Relationship Advice**
  - Provides guidance when fields belong to related entities instead of the base entity
  - Supports:
    - `$select`
    - `$orderby`
  - Advice is derived safely from validation results (no heavy runtime traversal)

### Improved
- **Extension host performance and stability**
  - Eliminated large metadata payloads from VS Code extension state
  - Reduced risk of extension host freezes during metadata-heavy operations
  - Improved responsiveness of:
    - Explain Query
    - metadata-aware features
    - relationship exploration
- **Metadata persistence granularity**
  - Updates now occur at entity level instead of rewriting large environment-wide blobs
  - More efficient cache writes and reads
- **Cache clear behavior**
  - Clear metadata command now removes disk-backed files
  - Legacy state keys are also cleared for consistency
- **Foundation for future metadata reasoning**
  - Enables safe expansion into deeper Explain Query reasoning
  - Prepares groundwork for:
    - structured provenance signals
    - scope-aware hover
    - advanced investigation features

### Fixed
- Fixed extension host performance degradation caused by large persisted metadata state
- Fixed repeated growth of metadata payloads in VS Code global state
- Fixed metadata cache inconsistencies during repeated metadata operations


## [0.4.4] - Result Viewer Usability Fix

### Fixed
- Fixed horizontal scrolling behaviour for wide tables in the Result Viewer
- Table now expands based on column content instead of compressing into viewport
- Improved usability when working with large Dataverse result sets (many columns)

### Improved
- Result Viewer now correctly supports horizontal exploration of data
- Significantly better experience when inspecting real-world enterprise datasets


## [0.4.3] - Result Viewer Intelligence & Action Foundations

### Added
- **Column-aware result viewer actions** for Dataverse query results
- Query helper actions for visible cell values:
  - **Copy OData filter**
  - **Copy FetchXML condition**
- **Schema / Metadata** toolbar action directly from the Result Viewer
- **CSV export** for the current table view
  - exports the current filtered and sorted result set
  - exports the currently displayed values shown in the table
- Result viewer toolbar action icons for:
  - **Relationships**
  - **Schema / Metadata**
  - **Export**
- Result viewer environment indicator shown in the viewer header
- Hover-reveal row actions for a cleaner result grid experience

### Improved
- Result Viewer now behaves more like an interactive Dataverse investigation surface
- **Primary key column** is consistently shown first in the table when available
- **Choice / Option Set values** are rendered using labels in the table view instead of raw numeric codes
- Result viewer now supports:
  - **client-side sorting**
  - **client-side filtering**
  - **resizable columns**
- Improved toolbar visual grouping by separating view modes from tool actions
- Improved kebab / overflow menu behavior for row actions
- Result viewer action handling was consolidated to better support future command-surface features
- Stabilized viewer event handling and reduced fragility during rerenders

### Fixed
- Fixed result viewer cases where the table failed to render due to embedded webview script issues
- Fixed overflow / kebab menu clipping and positioning issues near the bottom of the table
- Fixed filter input losing focus during rerender
- Fixed row action inconsistencies caused by repeated event rebinding
- Fixed schema toolbar action so metadata can be opened directly for the current query entity
- Fixed query helper actions so they correctly use raw underlying values even when labels are displayedh

## [0.4.2] - Interactive Result Viewer

### Added
- **Interactive Query Result Viewer** providing a structured table interface for Dataverse query results
- Results now display in a dedicated viewer panel instead of raw JSON output
- Toolbar actions allowing users to switch between:
  - **TABLE view**
  - **JSON view**
  - **RELATIONSHIPS** analysis
- Inline **record actions** for primary key values including:
  - 🔎 **Investigate Record**
  - ↗ **Open Record in Dataverse UI**
- Automatic detection of Dataverse **primary key fields** using metadata
- Primary key cells now surface contextual record actions directly within the result grid
- Consistent result viewer behavior across:
  - Run Query
  - Run Query Under Cursor
  - Smart GET

### Improved
- Query execution results now open in the **Result Viewer** by default for improved inspection workflows
- Smart GET queries now use the same result viewer interface for consistent developer experience
- Result viewer automatically resolves entity metadata to enable contextual record actions
- Improved discoverability of record investigation and navigation actions
- Result viewer header now includes **row count and environment context**

### Fixed
- Fixed Smart GET results opening in raw JSON instead of the result viewer
- Fixed inconsistent result rendering between different query execution commands

## [0.4.1] - Stabilization & Investigation Reliability

### Added
- Relationship analysis documents now include entity-aware filenames:
  - `Relationship Explorer - entity.txt`
  - `Relationship Graph - entity.txt`
- Improved investigation handling for mixed JSON documents containing multiple `@odata.context` blocks

### Improved
- Stabilized **Investigate Record** behavior for real-world Dataverse payloads
- Improved entity inference when investigating records from:
  - partial JSON fragments
  - copied API responses
  - mixed diagnostic logs
- Improved investigation candidate selection to avoid incorrect entity resolution
- Improved handling of custom tables and non-standard entity names
- Improved error transparency when relationship traversal encounters Dataverse permission restrictions

### Fixed
- Fixed incorrect entity inference when earlier `@odata.context` values appeared elsewhere in the document
- Fixed duplicate entity selection prompts in some investigation scenarios
- Fixed incorrect request URL formatting in investigation error messages
- Fixed investigation failures caused by incorrect context resolution in multi-block JSON payloads
- Fixed several investigation edge cases discovered during real-world testing against enterprise Dataverse environments

## [0.4.0] - Investigate Record

### Added
- **Investigate Record** feature for rapid Dataverse record analysis directly from VS Code
- Investigation report generation including:
  - structured **SUMMARY**
  - **POINTS TO** lookup relationships
  - **REVERSE LINKS** suggestions
  - **SUGGESTED QUERIES** for further exploration
- Deterministic candidate extraction for record identifiers from:
  - GUID selections
  - JSON payloads
  - OData entity paths
  - query results
- Entity inference engine for resolving record entity types using:
  - JSON `@odata.context`
  - query path hints
  - metadata lookup relationships
- Canonical **Resolved Investigation Context** ensuring consistent entity resolution across the investigation pipeline
- Polymorphic lookup awareness for relationships with multiple valid target entities
- Investigation reports now include meaningful document titles:
DV Investigation [ENV] - entity - guid
- Metadata-enriched summary fields including choice label resolution:
Priority : 1 (Normal)
- Investigation summaries organized into ranked categories:
- Identity
- Lifecycle
- Ownership
- Business-relevant fields
- Automated regression tests covering the investigation engine components:
- candidate extraction
- candidate scoring
- candidate selection
- input resolution
- resolved investigation context
- investigation document generation
- signals and suggested queries

## [0.3.2] - Execution Transparency, Test Coverage & Developer UX

### Added
- Comprehensive automated test suite covering core DV Quick Run subsystems
- Query mutation pipeline
- Guardrail execution logic
- Environment runtime state handling
- Smart GET workflows and GUID flows
- Smart PATCH workflows
- Explain Query parsing and section generation
- Metadata access and session caching
- Hover field, navigation, and choice resolution
- Structured execution logging for Dataverse operations
- Shared execution logging helpers for consistent command output
- Result timing and record-count summaries for GET operations

### Improved
- Execution output now clearly displays the exact query executed:
    [DV:DEV] GET contacts?$select=fullname&$top=10
    → 10 records returned (85ms)
- Improved developer visibility when running queries directly from the editor
- Consistent execution output format across Smart GET, Run Query, and metadata operations
- Review menu UX improvements for Smart GET workflows
- Clipboard actions now produce human-readable query paths instead of URL-encoded strings
- Improved command output clarity by reducing noisy intermediate messages
- Refactored action-level execution flows for improved runtime safety and consistency

### Fixed
- Result preview window not appearing after query execution in certain refactor scenarios
- Incorrect URL-encoded query text produced by **Copy Query Path**
- Inconsistent query history entries when opening queries via the review menu
- Several minor execution-flow edge cases uncovered during test expansion

## [0.3.1] - Architecture Stabilization & Query Reliability

### Added
- Unit tests covering core query intelligence components
  - query detection
  - filter expression rules
  - filter value validation
  - choice metadata interpretation
- Validation safeguards for `$filter` value formatting across string, numeric, datetime, and lookup fields
- Shared utilities for query mutation and filter construction
- Additional internal diagnostics coverage for metadata interpretation logic

### Improved
- Refactored metadata architecture separating **metadata loading** from **value interpretation**
- Centralized metadata retrieval and caching through `metadataAccess`
- Introduced pure interpretation layer `valueAwareness` for choice metadata resolution
- Reduced duplication across query mutation actions using a shared mutation runner
- Improved field picker experience by hiding non-selectable fields
- Improved string escaping for OData filter expressions
- Improved handling of numeric, GUID, and datetime filter values
- Improved testability of core query analysis components

### Fixed
- Incorrect quoting behavior for datetime filter expressions
- Duplicate query detection logic across mutation actions
- Edge cases where non-selectable metadata fields appeared in `$select` field pickers
- Several internal metadata interpretation inconsistencies

## [0.3.0] - Environment Profiles & Safe Multi-Environment Metadata

### Added
- Environment profile system supporting multiple Dataverse environments
- First-run environment setup wizard
- Commands to add, select, and remove environments
- Status bar indicator showing the active Dataverse environment
- Configurable environment status colors (white / amber / red)
- Environment-aware metadata diagnostics showing active environment and cache prefix

### Improved
- Persisted metadata caches are now scoped per environment
- Metadata diagnostics clearly show which environment cache is being inspected
- Cache keys normalized using environment prefix to prevent cross-environment reuse
- Prevented metadata leakage between environments when switching contexts
- Cleared session metadata caches automatically when environment changes
- Cleared hover and navigation enrichment caches during environment switch
- Persisted cache clear command now clears caches for the active environment only

## [0.2.2] - Performance & Cache Observability

### Added
- Metadata diagnostics command to inspect runtime cache state
- Commands to clear session metadata cache
- Commands to clear persisted metadata cache
- Versioned metadata cache keys to support safe future upgrades

### Improved

- Reduced repeated metadata resolution during hover and Smart GET workflows
- Optimized CodeLens refresh behavior to avoid unnecessary recomputation while editing
- Improved metadata cache reuse across hover and query analysis features
- Reduced output noise by demoting non-critical logs to debug level
- Added lightweight entity-definition prewarm to improve first-use responsiveness

### Fixed

- Persisted metadata cache invalidation for entity definitions
- Duplicate hover request context property causing redundant lookup paths
- Cache key inconsistencies across metadata caches

## [0.2.1] - Hotfix

### Fixed
- Improved Azure CLI discovery across Windows environments
- Fixed authentication failures caused by brittle Azure CLI path assumptions
- Added safer handling for PATH-based Azure CLI installations

## [0.2.0] - Metadata Intelligence Foundation

### Added
- Choice metadata decoding
- Navigation metadata normalization
- Lookup target resolution
- Metadata caching stabilization

### Improved
- Explain Query accuracy
- Metadata hover intelligence
- Query validation reliability

## [0.1.0] - Initial Release

### Added

- Run Dataverse Web API queries directly from VS Code
- Run query under cursor
- Smart GET query builder
- Smart GET from GUID
- Query explanation engine
- Query mutation helpers
- Add Select, Filter, Expand, and OrderBy helpers
- Relationship explorer and relationship graph view
- Generate query from JSON record
- Inline metadata hover for Dataverse queries
- CodeLens actions for quick query execution
- Azure CLI authentication support
- Added Ctrl+Enter, Ctrl+Shift+R shortcut to run query under cursor
