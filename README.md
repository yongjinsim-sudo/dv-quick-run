# DV Quick Run

A fast, metadata-aware Dataverse query and operational investigation workbench for VS Code.

**Run, understand, explore, refine, safely update, execute governed operational capabilities, and investigate Dataverse behaviour — with Query-by-Canvas, Guided Traversal, `$batch`, Smart PATCH, Capability Explorer, Execution Insights, Operational Profiles, and the DV Quick Run Hub — without leaving your editor.**

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
* discover and execute supported Custom API capabilities through Capability Explorer
* use the Hub to stay oriented across investigation workflows

DV Quick Run is designed around a simple loop:

```text
write → run → explore → refine → investigate → act safely → verify
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

## 🆕 What's New in v0.10.5

v0.10.5 completes the first full operational execution loop between the **Result Viewer** and **Capability Explorer**.

DV Quick Run can now move from a returned Dataverse row directly into compatible bound Actions for that row, while preserving the same preview-first, environment-bound, explicit execution model used throughout Capability Explorer.

This is not direct row automation.

It is contextual, governed operational execution inside DV Quick Run’s existing safety model:

```text
query → inspect row → preview bound Action → explicit confirmation → execute → inspect result → investigate evidence
```

Highlights:

* Result Viewer rows now expose **Bound Actions on this record** from the row action menu
* entity-bound Actions can be launched from row context without manually constructing OData routes
* Result Viewer supplies only the target entity and row id; execution still requires preview and confirmation
* execution previews clearly show source, target entity, target row id, request route, payload, and environment authority
* execution results capture request shape, response payload, status, duration, request ID, and investigation context
* Capability Explorer now degrades gracefully when Custom API discovery access is restricted
* restricted Custom API access surfaces actionable details such as principal user, missing privilege, required entity, and HTTP status
* Result Viewer bound Action entry remains visible but explains restricted access calmly when discovery is unavailable
* unsupported or complex parameter shapes remain inspectable without pretending to be safely executable
* environment trust banners now align consistently with DEV, amber, and RED/PROD-style execution caution semantics

Capability Explorer and Result Viewer now support a more integrated operational execution model:

* preview-first Function execution
* preview-first eligible unbound Action execution
* preview-first entity-bound Action execution
* preview-first collection-bound Action execution
* Result Viewer row-context bound Action previews
* explicit target-row execution workflows
* metadata-aware bound route generation
* governed execution result inspection
* access-aware capability discovery UX
* execution-aware investigation continuation

This release reinforces the v0.10.x execution invariants:

```text
Custom API metadata = discovery truth
OData metadata = execution exposure truth
bound route metadata = execution route truth
Custom API parameter metadata = execution contract
bound entity metadata = advisory enrichment only
Result Viewer row context = target identity only
active environment = execution authority boundary
```

DV Quick Run continues evolving from a metadata-aware query and investigation tool into a governed operational execution workbench for Dataverse and Power Platform engineering — while keeping execution explicit, bounded, inspectable, access-aware, and evidence-backed.

---

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
* avoid stale context after environment switches

The Hub is optional. It does not take over the workflow; it helps you recover orientation when you need it.

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

![Operational Profile](docs/entity-profile-card.png)

Operational Profiles are:

* entity-scoped
* user-triggered
* evidence-backed
* bounded
* advisory-only

They help identify good investigation starting points without implying speculative root cause.

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

Execution-capable workflows are designed around:

```text
preview → explicit confirmation → execution → inspect result → investigate evidence
```

DV Quick Run does not treat generated or AI-assisted responses as operational truth. AI-related output should be reviewed before being used for operational decisions.

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

DV Quick Run is designed to reduce tool switching while keeping investigation and execution workflows explicit, bounded, governed, and trustworthy.

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
