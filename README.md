# DV Quick Run

A fast, metadata-aware Dataverse query and workflow workbench for VS Code — with guided traversal, `$batch` execution, preview-first refinement, Smart PATCH, and execution-aware insights with grouped investigation.

**Run, understand, explore, refine, safely update, and diagnose Dataverse execution behaviour — with Query-by-Canvas, Guided Traversal, Smart PATCH, `$batch` workflows, and Execution Insights — without leaving your editor.**

---

## 🚀 What is DV Quick Run?

DV Quick Run turns VS Code into a **Dataverse developer console**.

Instead of switching between Postman, browser tabs, and maker portals, you can:

* Write queries
* Run them instantly
* Explore results in a table
* Investigate records
* Refine queries safely using Query-by-Canvas (preview-first)
* Safely update records with Smart PATCH (preview-first)
* Navigate relationships step-by-step (Guided Traversal)
* Enrich results without rewriting queries
* Inspect execution behaviour using correlation-based Execution Insights

All inside VS Code — with a preview-first, user-controlled workflow.

---

---

## 🆕 What's New in v0.9.16 (Investigation Continuity, Context Surfaces & Operational Exploration)

> A focused **operational investigation cohesion release** — introducing investigation continuity, operational context surfaces, traversal-aware recovery, expanded investigation pivots, and calmer operational guidance without introducing hidden orchestration or speculative automation.

---

### 🧭 Investigation Context Surface (NEW)

DV Quick Run now introduces a dedicated **Investigation strip** directly inside the Result Viewer.

The Investigation strip acts as a lightweight operational context surface for the active investigation session.

It can now surface:

* traversal continuity
* expanded investigation scopes
* operational adjacency
* execution-aware investigation context
* contextual operational pivots

Examples include:

* `account → contact`
* `account + 3 expanded scopes`
* traversal-active investigation state
* contextual investigation-linked entity pivots

The strip intentionally remains:

* lightweight
* contextual
* operationally bounded
* non-dashboard-like

👉 Results in:

* clearer operational orientation
* smoother exploration continuity
* reduced investigation disorientation
* calmer operational workflows

---

### 🔄 Guided Traversal Continuity & Recovery (Major)

Guided Traversal workflows now preserve operational continuity much more reliably.

Added:

* Back navigation
* Route reselection
* traversal continuation
* dead-end recovery support
* sibling expand continuity preservation
* traversal-aware empty-result recovery

Behaviour:

* traversal state remains recoverable
* exploration becomes reversible
* failed/no-result branches no longer terminate investigation flow
* Cytoscape and standard traversal paths now preserve continuity consistently

👉 Results in:

* calmer traversal UX
* safer multi-hop investigation
* reduced operational frustration
* smoother relationship exploration

---

### 🧩 Expanded Investigation Scope Awareness (NEW)

Expanded entities and sibling expands now actively participate in the investigation surface.

Examples include:

* `account`
* `contact`
* `systemuser`
* sibling-expanded operational entities

Expanded entities now appear as clickable investigation pills directly inside the Investigation strip.

Behaviour:

* expanded entities become contextual operational pivots
* allows fast entity-level Operational Profile switching
* maintains investigation locality
* deduplicates repeated operational entities automatically

The primary/root entity continues to use the main Profile surface.

👉 Results in:

* easier operational adjacency exploration
* stronger relationship investigation flow
* smoother contextual pivots
* reduced navigation disruption

---

### ⚡ Execution Context Orientation (NEW)

DV Quick Run now surfaces lightweight execution-aware investigation context directly inside the Result Viewer.

Examples include:

* active traversal investigation state
* execution-aware operational investigation
* traversal continuity indicators
* contextual operational exploration state

Behaviour:

* only shown when operationally relevant
* suppresses unnecessary investigation noise
* remains advisory-only
* avoids speculative reasoning

👉 Results in:

* clearer operational investigation state
* stronger workflow orientation
* safer contextual exploration

---

### 📦 Batch Investigation Continuity Fixes

Fixed several investigation continuity issues affecting `$batch` workflows.

Resolved:

* incorrect batch query extraction
* nested/sibling `$expand(...)` parsing issues
* traversal continuity loss after batch execution
* sibling expand continuity inconsistencies
* route continuity resets during operational pivots

Behaviour:

* `$batch` execution now preserves operational context correctly
* traversal-aware investigations survive batch pivots
* nested expand workflows remain operationally stable
* sibling expand investigations preserve continuity semantics

👉 Results in:

* more reliable operational workflows
* safer multi-query exploration
* stronger traversal + batch integration
* reduced continuity breakage

---

### 🧠 Guidance Refinement & Noise Reduction

Refined contextual investigation guidance behaviour across operational workflows.

Changes include:

* suppression of redundant investigation hints
* calmer traversal messaging
* context-aware recommendation visibility
* operational-state-aware guidance suppression
* dead-end-aware recovery nudges

Examples:

* removed redundant “Opened from Guided Traversal”
* simplified traversal-active semantics
* suppress weak or redundant operational recommendations automatically
* avoid guidance duplication during active traversal sessions

👉 Results in:

* cleaner operational UX
* reduced cognitive overload
* stronger recommendation trust
* calmer investigation flow

---

### 🧪 Investigation Surface Stability

Validated across:

* traversal workflows
* sibling expands
* nested expands
* `$batch` execution
* Operational Profile pivots
* dead-end traversal scenarios
* empty-result recovery workflows
* Cytoscape-guided traversal

Validation focused on:

* operational continuity correctness
* investigation strip stability
* traversal recovery reliability
* contextual pivot correctness
* calmer operational UX semantics

No regression in:

* Result Viewer
* Guided Traversal
* Operational Profiles
* Execution Insights
* Query Doctor
* `$batch` execution

---

## 🧭 Notes

This release strengthens DV Quick Run’s direction as:

* an operational investigation workbench for Dataverse and Power Platform engineering

—not a disconnected collection of tooling surfaces.

Key principles reinforced:

* investigation continuity over restart workflows
* operational context over telemetry overload
* reversible exploration over procedural execution
* advisory-only operational guidance
* evidence-backed operational context
* calmer operational UX
* contextual pivots over disruptive navigation

---

## 🎯 Summary

DV Quick Run can now:

* preserve operational continuity across traversal workflows
* expose expanded investigation scopes directly inside the Result Viewer
* maintain operational orientation during exploration
* recover more gracefully from dead-end investigations
* preserve continuity across `$batch` and traversal workflows
* support contextual operational profile pivots without leaving the investigation surface

👉 Further strengthens the foundation for:

* persistent investigation workflows
* cross-surface operational reasoning
* deeper operational exploration tooling
* future investigation export/import workflows
* richer contextual operational diagnostics

---

## 🎬 Result Viewer

![DV Quick Run Result Viewer](docs/demo-result-viewer.gif)

Typical workflow:

start simple → run → explore → refine (Query-by-Canvas) → update safely (Smart PATCH) → refresh → repeat

---

## ⚡ Quick Start

1. Install **DV Quick Run**
2. Login:

   ```
   az login --allow-no-subscriptions
   ```
3. Configure your Dataverse environment
4. Run a query:

   ```
   contacts?$top=10
   ```

---

## ✨ Key Features

### 🔎 Run & Explore Queries

* Run Dataverse queries (OData & FetchXML) directly in VS Code
* View results in an interactive table or JSON
* Sort, filter, inspect, copy, and act on data inline

---

### ✏️ Smart PATCH

* Update Dataverse records directly from the Result Viewer
* Preview PATCH payloads before applying changes
* Use metadata-aware inputs for boolean and choice fields
* Automatically refresh results after successful updates
* Prevent unsafe updates on expanded / related fields

---

### 🔗 Guided Traversal + Enrichment

* Traverse relationships step-by-step across Dataverse tables
* Continue traversal using real data (row-driven)
* Enrich results in-place using **Sibling Expand**
* Build complex multi-entity queries without manual `$expand`

---

### 🧭 Investigation Surface & Operational Continuity

DV Quick Run now provides a cohesive operational investigation surface directly inside the Result Viewer.

Instead of treating traversal, expands, execution diagnostics, and operational pivots as disconnected tools —

DV Quick Run now preserves investigation continuity across operational workflows.

The Result Viewer can now surface:

* active traversal context
* expanded operational scopes
* contextual operational pivots
* execution-aware investigation context
* operational adjacency between related entities

Examples include:

* `account → contact`
* `account + 3 expanded scopes`
* traversal-active investigation workflows
* clickable expanded-entity investigation pivots

Expanded operational entities now appear directly inside the investigation surface as lightweight contextual pivots.

This allows engineers to:

* continue operational exploration without restarting workflows
* pivot between related operational entities more naturally
* recover from traversal dead-ends more safely
* preserve investigation locality during multi-hop exploration

The investigation surface intentionally remains:

* lightweight
* bounded
* contextual
* advisory-only

DV Quick Run intentionally avoids:

* speculative orchestration
* hidden investigation automation
* noisy dashboard behaviour
* disruptive navigation workflows

👉 Results in:

* calmer operational exploration
* smoother traversal continuity
* stronger contextual investigation workflows
* reduced operational disorientation
* safer relationship-driven investigation

---

### 📊 Execution Insights (Runtime Diagnostics)

Understand what’s happening **behind your Dataverse queries** — without leaving VS Code.

DV Quick Run surfaces **execution behaviour across plugins, async operations, and workflows** directly in the Result Viewer:

- Detect slow, failed, waiting, and repeated execution behaviour  
- Distinguish normal behaviour vs potential issues (same request vs cross-request)  
- See impact and recommended next steps instantly  
- Drill into raw trace and execution data when deeper debugging is needed  

Instead of manually querying `plugintracelogs`, `asyncoperations`, correlating requests, and scanning raw data across multiple tools —

DV Quick Run surfaces the most important execution signals instantly, and lets you drill deeper only when needed.

---

#### 🧠 Primary Signal Reasoning

Execution Insights now prioritises the strongest execution pattern first, then surfaces supporting evidence underneath.

Instead of presenting disconnected diagnostics equally, DV Quick Run guides you toward the most important execution behaviour to investigate first.

Examples include:
- repeated background execution
- recurring async operations
- nested plugin chains
- repeated cross-request execution patterns

![Primary Signal 1](docs/execution-insights-primary-1.png)

---

#### 🔗 Guided Investigation Flow

Execution Insights now provides structured investigation guidance directly inside the Result Viewer.

DV Quick Run helps connect:
- async operations
- plugin traces
- workflow context
- correlation identifiers

…into a more coherent debugging workflow.

Instead of manually stitching together execution context across multiple tools, you can progressively investigate execution behaviour directly from the insight surface.

![Guided Investigation 1](docs/execution-insights-next-1.png)

---

### 🧭 Operational Profiles (Entity Investigation)

Understand the **operational footprint** of a Dataverse entity before diving into execution troubleshooting.

DV Quick Run now surfaces **Operational Profiles** directly inside the Result Viewer:

* plugin orchestration density
* relationship complexity
* metadata footprint
* async participation
* Power Automate involvement
* workflow participation
* managed-state context

Instead of manually inspecting metadata, relationships, plugin registrations, workflows, and async operations separately —

DV Quick Run provides a bounded, evidence-backed operational investigation surface in one place.

Operational Profiles help answer questions like:

* “Is this entity operationally dense?”
* “Is this table heavily orchestrated?”
* “Should I investigate plugins first?”
* “Does this entity participate in async execution?”
* “Is this likely to produce investigation noise?”

All without implying speculative root cause.

![Operational Profile](docs/entity-profile-card.png)

---

#### 🔗 Evidence-Backed Investigation Actions

Operational Profiles include direct investigation links for:

* plugin registrations
* relationships
* columns
* async operations
* Power Automate flows
* workflows

Each investigation action launches a real Dataverse query directly inside DV Quick Run.

Examples include:

* `sdkmessageprocessingsteps`
* `asyncoperations`
* `workflows`

👉 Results in:

* faster operational investigation
* reduced manual query construction
* smoother signal → evidence workflows

---

#### 🧠 Advisory-Only Operational Guidance

Operational Profiles are intentionally:

* entity-scoped
* user-triggered
* evidence-backed
* bounded
* advisory-only

DV Quick Run intentionally avoids:

* speculative causality
* hidden scoring systems
* synthetic operational narratives
* unsupported root-cause claims

The goal is:

* better investigation starting points
* clearer operational awareness
* safer execution reasoning
* stronger evidence transparency

---

### 🧠 Explain Query + Query Doctor

* Break queries into human-readable explanations
* Understand filters, sorting, and structure instantly

**Query Doctor (Intelligent Diagnostics):**

* Analyse your query and detect issues
* Get prioritised diagnostics with confidence scoring
* Receive actionable **Suggested Fixes** with examples

Turn this:
  accounts?$expand=primarycontactid

Into:

* what the query does
* what’s missing
* how to improve it

All directly inside VS Code.

---

### 🔍 Investigate Record

* Select a GUID → investigate instantly
* Works on:
  - primary keys
  - surfaced business GUID fields in results
* See:
  - relationships
  - structured summary
  - **interpretation (what this record likely represents)**
  - suggested queries

---

### ⚡ Smart Query Helpers

* Build queries and updates (GET / PATCH) with guided prompts
* Incrementally refine queries ($select, $filter, $expand, $orderby)
* Generate queries from JSON

---

### 🧬 Metadata Intelligence

* Hover to see field metadata
* Resolve choice labels automatically
* **Refine filter values inline (preview-first)**
* Explore entity relationships

---

### 🌍 Environment Support

* Work across DEV / UAT / PROD
* Safe environment switching
* Environment-aware metadata caching

---

## 🛡 Guardrails

DV Quick Run detects risky query, mutation, and diagnostic scenarios — such as missing `$top`, unsafe PATCH contexts, unsupported expanded-field updates, broad result analysis, or unavailable plugin trace access — and guides you before execution.

---

## 👥 Who Is This For?

* Dataverse / Dynamics 365 developers
* Power Platform engineers
* Integration / API developers

---

## 💡 Why DV Quick Run?

Because the fastest workflow is:

**write → run → explore → refine → update → verify → repeat**

…without leaving your editor.

---

## 🔧 Development

```
npm install
npm run compile
```

Press **F5** to run the extension.

---

## 📜 License

MIT License
