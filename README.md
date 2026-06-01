# DV Quick Run

A fast, metadata-aware Dataverse query and operational investigation workbench for VS Code.

**Run, understand, explore, refine, safely update, execute governed operational capabilities, compare operational snapshots, verify drift evidence, and investigate Dataverse behaviour — with Query-by-Canvas, Guided Traversal, `$batch`, Smart PATCH, Capability Explorer, Execution Insights, Operational Profiles, Operational Context, Access Context, Snapshot Library, Timeline Diff, Cross-Environment Diff, inline evidence continuation, report exports, investigation handoff PDFs, and the DV Quick Run Hub — without leaving your editor.**

---

## 🌐 Website & Interactive Demo

Official website:

```text
https://www.dvquickrun.com
```

The website includes:

* product overview
* roadmap direction
* operational investigation philosophy
* feature walkthroughs
* marketplace/install links
* interactive mock HTML comparison reports demonstrating DV Quick Run investigation workflows
* sample Diff Findings Summary and Investigation Handoff report flows

The interactive HTML demo helps illustrate:

* grouped operational drift investigation
* inline evidence continuation
* operational verification workflows
* Findings / Verification / Handoff investigation flow
* dense enterprise comparison readability
* operational investigation continuity
* report export mental models for Diff Findings Summary and Investigation Handoff workflows

without requiring a live Dataverse environment.

---

## 🚀 What is DV Quick Run?

DV Quick Run turns VS Code into a focused **Dataverse developer and investigation console**.

Instead of switching between Postman, browser tabs, maker portals, Excel, and manual metadata lookups, you can:

* run OData and FetchXML queries
* inspect results in a table or JSON view
* refine queries safely using preview-first workflows
* update records using Smart PATCH
* traverse Dataverse relationships step-by-step
* run related queries as `$batch`
* investigate runtime behaviour with Execution Insights
* understand entity operational footprint with Operational Profiles
* inspect bounded Operational Context for solution layering, access, runtime actor, and ownership signals
* investigate bounded Access Context for users, application users, teams, roles, and business units
* compare operational snapshots through Snapshot Library, Timeline Diff, and Cross-Environment Diff
* continue investigation from comparison evidence using bounded inline pivots
* review, verify, comment on, and hand off operational drift findings
* export Diff Findings Summary and Investigation Handoff reports as HTML/PDF artifacts
* discover and execute supported Custom API capabilities through Capability Explorer
* use the Hub to stay oriented across investigation workflows

DV Quick Run is designed around a simple loop:

```text
write → run → explore → refine → investigate → verify → hand off
```

---

## ⚡ Quick Start

1. Install **DV Quick Run**
2. Login:

   ```bash
   az login --allow-no-subscriptions
   ```

3. Configure your Dataverse environment
4. Run a query:

   ```http
   contacts?$top=10
   ```

5. Open the Hub any time:

   ```text
   DV Quick Run: Open Hub
   ```

---

## 🆕 What's New in v0.12.4

v0.12.4 matures DV Quick Run’s comparison platform from interactive operational verification into investigation-ready operational reporting and verification handoff.

Highlights include:

* **Diff Findings Summary reports** for concise, executive-friendly operational drift orientation
* **Investigation Handoff reports** for verification continuity, escalation, and follow-on human review
* **PDF report exports** with DVQR branding, watermarking, page footers, calmer pagination, and print-friendly evidence presentation
* **Report-focused HTML exports** that preserve evidence-backed operational summaries and grouped investigation context
* **Consolidated Reports menu** so comparison export actions are grouped cleanly without cluttering the workspace toolbar
* **Standardised report evidence cards** so grouped evidence, representative findings, and verification sections remain readable across dense reports
* **Capability-aware export semantics** where Free Preview can export mock/sample reports, while real operational report exports remain Pro capability-aware

DV Quick Run continues to prioritise:

```text
understanding
before
automation
```

DVQR observes operational drift. DVQR does not fix operational drift.

## 🎬 Result Viewer

![DV Quick Run Result Viewer](docs/demo-result-viewer.gif)

The Result Viewer is the main interactive surface for exploring query results.

Typical workflow:

```text
start simple → run → explore → refine → update safely → refresh → repeat
```

Result Viewer also acts as an operational launch surface. From a primary row id, you can open **Bound Actions on this record** to preview compatible entity-bound Actions for that specific row.

The Result Viewer only supplies target row context. Execution still flows through DV Quick Run’s governed preview surface:

```text
row → bound Action preview → explicit confirmation → execution result → investigation context
```

---

## ✨ Key Features

### 🔎 Run & Explore Queries

* Run Dataverse OData and FetchXML directly in VS Code
* View results in an interactive table or JSON
* Sort, filter, inspect, copy, and act on data inline
* Use Ctrl+Enter to run the query under your cursor

---

### 🧭 DV Quick Run Hub

The Hub provides a calm orientation surface for operational investigation workflows.

It helps you:

* understand current investigation context
* see whether a Result Viewer context is active, recoverable, historical, or stale
* reopen recoverable Result Viewer sessions
* track selected `$batch` sub-results
* pivot to related investigation surfaces
* discover Snapshot Library and operational comparison workflows
* open DVQR GitHub Discussions for feedback, bugs, workflow ideas, and roadmap conversation
* avoid stale context after environment switches

The Hub is optional. It does not take over the workflow; it helps you recover orientation when you need it.


---

### 🔐 Access Context

Access Context helps you investigate bounded operational identity participation without leaving VS Code.

You can investigate:

* users
* application/service identities
* teams
* roles
* business units

Access Context can surface:

* business-unit context
* direct role participation
* team participation
* inherited participation
* member composition
* role participation
* notable operational participants
* raw verification evidence

It is designed for operational investigation, not security administration.

Access Context does not:

* simulate RBAC
* calculate effective record access
* generate privilege matrices
* infer security risk
* perform recursive environment-wide topology crawling

Access Context can be launched from:

* Command Palette
* DV Quick Run Hub
* Result Viewer row actions

Common Result Viewer continuations include:

```text
systemusers.systemuserid       → Check User Access Context
systemusers.systemuserid       → Check Application User Context
teams.teamid                   → Check Team Access Context
roles.roleid                   → Check Role Access Context
businessunits.businessunitid   → Check Business Unit Context
```

Access Context remains summary-first, searchable, exportable, and bounded to the current investigation subject.

---

### 🧩 Query-by-Canvas

Query-by-Canvas is DV Quick Run’s preview-first refinement model.

Start simple, then refine from results:

```text
contacts
→ add $top
→ add $select
→ filter by value
→ rerun
```

Supported refinement paths include:

* add fields
* filter by value
* preview query changes
* apply safely
* rerun and verify

---

### 🔗 Guided Traversal

Guided Traversal helps you navigate relationships across Dataverse tables.

Use it to:

* find paths between entities
* traverse using real returned rows
* continue exploration step-by-step
* understand relationship routes visually
* replay traversal flows as `$batch`

---

### 📦 `$batch` Workflows

Run multiple related queries together using `$batch`.

Useful for:

* validating several endpoints together
* investigating related tables in one execution
* replaying Guided Traversal routes
* comparing related results without manual switching

The Hub tracks selected `$batch` sub-results so investigation context stays aligned with the selected response.

---

### ✏️ Smart PATCH

Smart PATCH lets you update Dataverse records directly from the Result Viewer using a preview-first workflow.

It supports:

* previewing PATCH payloads before execution
* metadata-aware boolean and choice inputs
* automatic result refresh after update
* guardrails for expanded or unsafe update contexts

---

### 📊 Execution Insights

Understand what is happening **behind your Dataverse queries** without leaving VS Code.

DV Quick Run surfaces execution behaviour across plugins, async operations, workflows, and Power Automate-related context.

It can help identify:

* slow execution
* failed or waiting async operations
* repeated execution patterns
* nested plugin behaviour
* correlation/request-linked runtime evidence

![Primary Signal 1](docs/execution-insights-primary-1.png)

Execution Insights prioritises the strongest signal first, then keeps supporting evidence available for deeper investigation.

![Guided Investigation 1](docs/execution-insights-next-1.png)

---

### 🧭 Operational Profiles

Operational Profiles help you understand the **operational footprint** of a Dataverse entity before diving into deeper troubleshooting.

Profiles can surface:

* plugin orchestration density
* relationship complexity
* metadata footprint
* async participation
* Power Automate involvement
* workflow participation
* managed-state context
* comparison-ready snapshot evidence for future operational diff workflows

![Operational Profile](docs/entity-profile-card.png)

Operational Profiles are:

* entity-scoped
* user-triggered
* evidence-backed
* bounded
* advisory-only

They help identify good investigation starting points without implying speculative root cause.

Operational Profile snapshot export is capability-aware: Free keeps operational understanding available, while Pro unlocks snapshot persistence and comparison workflows.

---

### 🔄 Snapshot Library, Timeline Diff & Cross-Environment Diff

DV Quick Run includes Pro Preview foundations for operational comparison workflows.

Snapshot Library coordinates saved operational investigation snapshots and acts as the central console for diffing.

It supports:

* source and target snapshot selection
* grouping snapshots by environment and subject
* latest-vs-previous snapshot comparison
* snapshot search and filtering
* grouped recent comparison history
* replayable recent comparisons
* bounded comparison-history rendering
* comparison-history cleanup without deleting snapshots
* mock snapshot exploration in Free / Pro Preview mode
* replayable sample/mock comparison workflows in Free Preview
* real snapshot workflows in Pro

DV Quick Run automatically chooses the comparison mode:

```text
same environment       → Timeline Diff
different environments → Cross-Environment Diff
```

Comparison surfaces can show provider-backed operational drift across:

* Operational Profiles
* Plugin Step Runtime Behaviour
* Solution Participation
* Workflow / Automation Participation
* Identity Participation

Comparison reports preserve scope awareness so exported artifacts clearly identify the operational subject being compared, for example:

```text
Cross-Environment Diff: Contact • DEV → SIT
```

When snapshots represent different operational subjects, DV Quick Run warns before continuing so users do not accidentally treat unrelated subjects as meaningful operational drift.

Dense comparison reports now use grouped operational surfaces so investigations remain readable at enterprise scale. High-signal drift remains visible first, while lower-priority evidence is grouped with:

* classification rationale
* evidence summaries
* representative drift signals
* operational-priority explanation
* full JSON/HTML evidence continuity

Comparison reports now also support interactive operational verification workflows. Evidence rows can open inline investigation context directly from the report, including bounded live pivots where DV Quick Run can safely query the active Dataverse environment.

Inline evidence continuation supports:

* solution participation evidence
* identity/team/role participation evidence
* workflow and automation participation evidence
* grouped representative signals
* custom/publisher-prefixed entity metadata context
* captured context-only evidence with explanatory fallback wording

The comparison workspace is organised around:

* **Findings** — review the operational drift evidence
* **Verification** — track what has been reviewed, externally checked, or still needs follow-up
* **Handoff** — preserve operational notes and review posture for human investigation continuity

Review and verification state is local to the comparison workflow and remains investigation-oriented. Marking something reviewed does not imply remediation, correctness, access authority, or root-cause certainty.

Examples include:

* Microsoft/platform solution drift grouped as platform-layer context
* patch and cumulative solution drift grouped as servicing-layer context
* minor workflow metadata drift grouped below activation and presence changes
* minor plugin configuration drift grouped below state, stage, mode, and registration changes
* lower-priority identity matching signals grouped below participation-density changes

Comparison reports can now be exported as dedicated operational artifacts:

* **Diff Findings Summary** — a concise one-page style operational briefing focused on strongest drift signals, executive summary, significance distribution, provider distribution, snapshot trust, and top operational findings
* **Investigation Handoff** — a verification-oriented handoff package focused on outstanding operational review, grouped evidence continuity, review posture, and external follow-up context
* **HTML reports** — readable, branded report exports that preserve operational hierarchy and evidence-backed summaries
* **PDF reports** — branded, watermarked, print-friendly exports for review packs, CAB discussions, handoff, escalation, and stakeholder communication

The comparison toolbar now groups report exports under:

```text
Reports
```

so standard evidence exports and report artifacts stay distinct:

```text
Save JSON / Save MD / Save HTML / Reports / Reset Review State
```

Free users can export mock/sample report artifacts from Free Preview workflows. Real operational snapshot report exports remain Pro capability-aware.

The comparison model is intentionally observational:

```text
DVQR observes operational drift.
DVQR does not fix operational drift.
```

Operational comparison is not deployment tooling, remediation automation, root-cause certainty, or environment authority.

It is designed to help you understand:

* what changed
* where operational density shifted
* which providers contributed evidence
* which drift signals may deserve follow-up investigation
* whether runtime plugin or automation participation differs between snapshots
* whether platform-layer drift is low-priority context or relevant to the investigation
* whether a comparison is scope-aligned before treating drift as meaningful

Free users can explore mock snapshots, replay sample comparison workflows, inspect sample drift, and export mock/sample HTML/PDF report artifacts. Pro unlocks real snapshot import, management, comparison, report export, replay, and snapshot continuity workflows.

Future roadmap direction includes **Entity Access Participation Context**: a wider bounded access-topology report for an entity/table that can be launched from diff evidence to understand role, team, user, app-user, and business-unit participation around that entity. This remains operational participation orientation, not RBAC simulation or authoritative effective-access calculation.

---

### 🧠 Explain Query + Query Doctor

Use Explain and Query Doctor to understand and improve queries.

Supported workflows include:

* break down query structure
* understand filters, sorting, expands, and selected fields
* identify missing `$top` or `$select`
* preview suggested improvements
* apply safe refinements through preview-first workflows

---

### 🔍 Investigate Record

Investigate a record from a GUID or result context.

Useful for:

* primary keys
* surfaced business GUID fields
* record interpretation
* relationship exploration
* suggested follow-up queries

---

### 🧬 Metadata Intelligence

DV Quick Run uses Dataverse metadata to improve query building and investigation.

Features include:

* field metadata hover
* choice label resolution
* relationship awareness
* entity set resolution
* preview-first filter refinement

---

### 🧩 Capability Explorer & Governed Operational Execution

DV Quick Run includes a metadata-backed **Capability Explorer** for discovering, understanding, previewing, and executing supported Dataverse operational capabilities.

It helps identify:

* executable vs inspect-only Custom APIs
* Functions vs Actions
* bound vs unbound operations
* public vs private capability visibility
* parameter complexity and preview support
* OData execution eligibility
* Action execution support state
* AI-related execution policy state
* governed operational execution context

Capability Explorer supports:

* entity-bound operational execution
* operational capability discovery
* metadata-backed execution validation
* preview-first Function execution
* preview-first eligible unbound Action execution
* preview-first entity-bound Action execution
* preview-first collection-bound Action execution
* Result Viewer row-context bound Action previews
* metadata-aware bound route generation
* explicit target-row execution workflows
* simple parameter request shaping
* explicit execution confirmation
* access-aware discovery behaviour under restricted permissions
* execution diagnostics
* execution result inspection
* Capability Execution Insights continuation
* structured operational investigation

Capability Explorer now presents Action execution using a clearer support taxonomy:

* **Preview-ready** — all discovered parameters can be represented safely in the preview foundation
* **Partially preview-ready** — some parameters can be previewed, while others remain inspect-only
* **Ready to run** — the Action is metadata-valid, OData-exposed, preview-ready, and executable after confirmation
* **Run with caution** — the Action is executable, but DV Quick Run detected operational-impact or governance signals requiring extra review
* **Preview request only** — a request template can be generated, but no Dataverse operation will be executed
* **Inspect only** — the operation remains discoverable and inspectable, but cannot be executed safely in the current release boundary

This keeps unsupported or private operations useful for investigation without making them appear broken or silently executable.

![Capability Explorer Function Preview](docs/capability-model-get-preview-sample.png)

### 🔗 Entity-Bound Action Execution

DV Quick Run can now execute supported entity-bound Dataverse Actions using explicit target-row context.

Capability Explorer automatically:

* resolves executable bound OData routes
* generates preview-ready request shapes
* validates execution eligibility
* preserves preview-first execution trust semantics
* captures execution diagnostics and operational investigation context

Bound execution remains:

* metadata-aware
* explicit
* environment-bound
* confirmation-driven
* investigation-oriented

![Entity-Bound Action Execution](docs/bound-actions-success-1.png)

Execution results preserve:

* request shape visibility
* execution identifiers
* execution diagnostics
* captured operational investigation context

![Entity-Bound Action Result](docs/bound-actions-success-2.png)

### 🧭 Result Viewer Bound Actions

Result Viewer rows can now open compatible bound Actions directly from the row action menu.

Use **Bound Actions on this record** to move from a returned Dataverse row into a governed Action preview without manually constructing the bound OData route.

Behaviour:

* the row supplies target entity and row id context
* DV Quick Run resolves the bound OData route from metadata
* execution preview remains the authority boundary
* execution still requires explicit confirmation
* request and response context are captured as investigation evidence

If Custom API discovery is restricted, DV Quick Run keeps the action visible but explains why it is unavailable instead of showing noisy failures.

### 🔒 Access-Aware Capability Discovery

Capability Explorer now handles restricted Custom API discovery access as an expected enterprise condition.

When access is restricted, DV Quick Run opens a calm restricted-access surface instead of treating the launch as a tool failure.

Where available, DV Quick Run surfaces actionable remediation details:

* principal user
* missing privilege
* required entity
* HTTP status

This keeps enterprise environments understandable even when security roles intentionally restrict Custom API metadata visibility.

The capability model is intentionally:

* metadata-driven
* preview-first
* explicit
* investigation-oriented
* execution-safe
* governance-aware

Execution is validated against the Dataverse OData `$metadata` surface before supported Functions and eligible unbound Actions can run.

The governing model is:

```text
Custom API metadata = discovery truth
OData metadata = execution exposure truth
bound route metadata = execution route truth
active environment = execution authority boundary
```

AI-related operations are governed separately. By default, DV Quick Run blocks AI-related execution:

```json
"dvQuickRun.execution.aiPolicy": "deny"
```

Set the policy to `allow` only when AI-related execution is intentionally permitted:

```json
"dvQuickRun.execution.aiPolicy": "allow"
```

When AI execution is allowed, DV Quick Run still surfaces amber advisory warnings because generated responses may be inaccurate, incomplete, non-deterministic, or unsuitable for direct operational decisions without human review.

---

### 🌍 Environment Support

Work across configured Dataverse environments such as DEV, UAT, SIT, and PROD.

DV Quick Run supports:

* active environment selection
* environment-aware metadata caching
* safe environment switching
* investigation context reset on environment change

---

## 🛡 Guardrails

DV Quick Run favours explicit, preview-first, user-controlled workflows.

It detects or guards against risky situations such as:

* missing `$top`
* broad result analysis
* unsafe PATCH contexts
* unsupported expanded-field updates
* stale investigation context
* stale execution authority after environment changes
* unavailable execution evidence
* unsupported or inspect-only Custom API execution
* private/internal Custom APIs remaining preview-request only
* restricted Custom API discovery access
* unavailable Result Viewer bound Action discovery
* unsupported or complex Action parameter shapes
* high-risk Actions requiring clearer caution semantics
* AI-related execution blocked by default
* AI-generated content requiring human review
* cross-environment investigation leakage
* operational-context overclaiming beyond bounded evidence
* effective-access claims from Access Context participation evidence
* causal claims from solution, ownership, access, or actor participation
* treating operational comparison as deployment authority
* treating snapshot evidence as remediation instruction
* treating mismatched comparison subjects as equivalent operational drift without explicit user awareness
* replay-history cleanup deleting underlying snapshots
* hidden cross-environment scans or automatic drift verification
* treating inline evidence continuation as remediation or proof of root cause
* treating review-state completion as operational correctness
* treating exported reports or PDFs as approval, certification, root-cause proof, or remediation authority

Execution-capable workflows are designed around:

```text
preview → explicit confirmation → execution → inspect result → investigate evidence
```

DV Quick Run does not treat generated or AI-assisted responses as operational truth. AI-related output should be reviewed before being used for operational decisions.

---

## 💬 Community & Feedback

DV Quick Run includes GitHub Discussions entry points from the Hub and operational comparison surfaces.

Use DVQR Discussions to:

* report bugs
* suggest features
* share workflow feedback
* discuss operational investigation patterns
* propose comparison providers
* follow roadmap direction

GitHub Discussions:

```text
https://github.com/yongjinsim-sudo/dv-quick-run/discussions
```

Official website:

```text
https://www.dvquickrun.com
```

---

## 👥 Who Is This For?

* Dataverse / Dynamics 365 developers
* Power Platform engineers
* Integration / API developers
* Support engineers investigating Dataverse execution behaviour
* Consultants working across complex Dataverse environments

---

## 💡 Why DV Quick Run?

Because the fastest Dataverse workflow is:

```text
write → run → explore → refine → investigate → verify
```

…without leaving your editor.

DV Quick Run is designed to reduce tool switching while keeping investigation, operational context, and execution workflows explicit, bounded, governed, and trustworthy.

---

## 🔧 Development

```bash
npm install
npm run compile
```

Press **F5** to run the extension.

---

## 📜 License

MIT License
