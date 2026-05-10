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

## 🆕 What's New in v0.9.15 (Operational Investigation Surfaces & UX Refinement)

> A focused **operational investigation release** — introducing Operational Profiles, operational density classification, evidence-backed investigation links, and entity-level orchestration visibility without introducing speculative telemetry or root-cause scoring.

---

### 🧭 Operational Profiles (EXPANDED)

DV Quick Run now introduces **Operational Profiles** — a new entity-scoped investigation surface designed to help engineers quickly understand the operational complexity surrounding a Dataverse table.

Operational Profiles surface:

* plugin orchestration density
* relationship complexity
* metadata footprint
* async activity
* Power Automate participation
* workflow participation
* managed-state context

—all directly inside the Result Viewer.

Instead of manually stitching together metadata, plugin registrations, async operations, and workflows across multiple tools —

DV Quick Run now provides a bounded, evidence-backed operational overview in one place.

---

### 📊 Operational Density Classification (REFINED)

Operational Profiles now classify entities using bounded operational density signals:

* 🟢 Low Operational Density
* 🟡 Moderate Operational Density
* 🔴 High Operational Density

Signals include:

* synchronous plugin registrations
* relationship counts
* attribute counts
* async activity
* orchestration participation

Thresholds were tuned to avoid over-classifying normal entities as “high complexity.”

👉 Results in:

* more trustworthy operational guidance
* clearer differentiation between lightweight and orchestration-heavy entities
* reduced false-positive complexity signals

---

### 🔗 Evidence-Backed Investigation Links (NEW)

Operational Profiles now include direct investigation actions:

* View plugin steps
* View relationships
* View columns
* View async operations
* View flows
* View workflows

Each action launches a concrete investigation query directly inside DV Quick Run.

Examples:

* `sdkmessageprocessingsteps`
* `asyncoperations`
* `workflows`

👉 Results in:

* faster investigation flow
* smoother transition from signal → evidence
* reduced manual query construction

---

### ⚡ Async Operation Visibility (Expanded)

Operational Profiles now surface bounded async-operation participation signals.

DV Quick Run can now:

* detect recent async activity
* distinguish no activity vs operational participation
* surface recent async investigation paths safely

Async investigation remains:

* bounded
* entity-scoped
* advisory-only

👉 Results in:

* clearer execution visibility
* safer async investigation workflows
* reduced historical noise

---

### 🧠 Managed State Awareness (NEW)

Operational Profiles now surface managed-state participation as governance/deployment context.

Behaviour:

* managed entities → surfaced as “Managed”
* unmanaged entities → “No evidence observed”

DV Quick Run intentionally avoids implying:

* managed = healthy
* unmanaged = risky

👉 Results in:

* clearer operational semantics
* reduced interpretation ambiguity
* safer governance signalling

---

### 🧩 Operational Profile UX

Operational Profiles were refined to reinforce:

* strongest operational signals first
* evidence-backed interpretation
* advisory-only investigation guidance
* bounded operational reasoning
* progressive disclosure over overload

The UI emphasises:

* operational density
* investigation entry points
* evidence hierarchy
* orchestration visibility
* calmer scan-first investigation flow

Additional refinement work focused on:

* tighter section spacing
* collapsed-by-default evidence and guidance sections
* clearer suggested investigation actions
* stronger signal-first scanning
* reduced operational noise

…without introducing speculative telemetry scoring or hidden analysis behaviour.

---

### 🧭 Suggested Investigation Actions (NEW)

Operational Profiles now surface actionable investigation entry points directly inside the profile.

Examples:

* View plugin registrations
* Investigate async operations
* Review relationship footprint
* View business rules

Actions are:

* entity-scoped
* bounded
* evidence-backed
* investigation-oriented

👉 Results in:

* faster transition from signal → investigation
* less manual query construction
* clearer operational workflow guidance

---

### 📂 Progressive Disclosure UX Refinement (NEW)

Operational Profile sections now open in a calmer, investigation-first state.

Changes include:

* Evidence collapsed by default
* Suggested Investigation Actions collapsed by default
* Investigation Guidance collapsed by default
* Future Investigation Surfaces collapsed by default

Behaviour:

* strongest operational signals remain immediately visible
* deeper operational evidence becomes progressively explorable
* avoids overwhelming users during first scan

👉 Results in:

* faster visual comprehension
* cleaner operational scanning
* reduced cognitive overload

---

### 🔮 Future Investigation Surfaces (NEW)

Operational Profiles now introduce roadmap visibility for upcoming investigation capabilities.

Current roadmap surfaces include:

Free roadmap:

* Custom API Discovery
* Cross-surface investigation pivots

Pro roadmap:

* Operational Profile drift comparison
* Cross-environment operational comparison
* Deployment operational impact analysis

Behaviour:

* roadmap items are informational only
* hover descriptions explain future capability intent
* no hidden execution or inaccessible behaviour

👉 Results in:

* clearer product direction
* stronger platform identity
* better user understanding of future operational workflows

---

### 🔗 Relationship Investigation Workflow Refinement

Improved relationship investigation handling:

* safer relationship export workflow
* save dialog prompt support
* cleaner transition into Relationship Explorer workflows

👉 Results in:

* more predictable export behaviour
* smoother relationship investigation flow
* better compatibility across environments

---

### 🧪 Dogfooding & Validation

Operational Profiles were validated against:

* lightweight entities
* orchestration-heavy healthcare entities
* plugin-heavy custom entities
* sparse/system entities
* async-heavy investigation scenarios

Validation focused on:

* operational truthfulness
* advisory correctness
* evidence consistency
* avoiding root-cause implication
* balanced operational density thresholds

---

## 🧭 Notes

This release extends DV Quick Run’s direction from:

* execution-aware diagnostics

→ to:

* operationally-aware investigation guidance

Key principles reinforced:

* evidence before interpretation
* strongest operational signals first
* bounded investigation behaviour
* no speculative causality
* advisory-only operational guidance
* operational density is not root cause

---

## 🎯 Summary

DV Quick Run can now:

* surface operational density for Dataverse entities
* expose orchestration participation clearly
* provide evidence-backed investigation entry points
* suggest contextual investigation actions
* distinguish lightweight vs operationally dense entities
* guide operational investigation without making root-cause claims
* surface future investigation roadmap directions without interrupting the workflow

👉 Further strengthens the foundation for:

* future operational reasoning layers
* execution-aware entity profiling
* cross-source operational investigation
* operational comparison workflows
* deployment-aware operational analysis
* deeper Power Platform operational diagnostics

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
