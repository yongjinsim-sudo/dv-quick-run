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

## 🆕 What's New in v0.9.13 (Execution Investigation Coherence & FlowSession Evidence Integrity)

> A focused **execution investigation coherence release** — refining Execution Insights ordering, evidence truthfulness, supporting-signal behaviour, and architectural reasoning seams without introducing speculative diagnostics or noisy execution analysis.

---

### 🧠 Shared Execution Insight Ordering (NEW)

Execution Insights now uses a more deterministic and coherent ordering model.

DV Quick Run now prioritises:
1. primary investigation signal
2. investigation priority
3. confidence
4. deterministic fallback ordering

Behaviour improvements:
- strongest execution patterns consistently appear first
- supporting signals remain visible without competing with the primary investigation signal
- insight ordering remains stable across reruns

👉 Results in:
- clearer investigation flow
- easier “start here” debugging
- less fragmented execution narratives

---

### 🧩 Reasoning Seam Extraction (NEW)

Execution investigation reasoning has been refactored into lightweight shared reasoning seams.

Extracted responsibilities include:
- primary signal interpretation
- investigation summaries
- guided investigation generation
- related-signal reasoning

Preserves:
- thin renderer architecture
- explicit orchestration boundaries
- deterministic investigation behaviour

👉 Results in:
- cleaner architecture
- safer future execution intelligence expansion
- reduced architectural drift

---

### 🔗 Supporting Signal Guardrails (Expanded)

Supporting execution signals now behave more clearly as:
- investigation hints
- contextual evidence
- lightweight related evidence

DV Quick Run now:
- reduces visual competition between weak and strong signals
- avoids implying unsupported causality
- keeps supporting evidence clearly subordinate to the primary signal

👉 Results in:
- more trustworthy diagnostics
- stronger evidence-to-importance alignment
- cleaner execution investigation hierarchy

---

### ⚡ FlowSession Evidence Integrity (Major)

FlowSession insight generation has been refined to require **real FlowSession evidence**.

FlowSession insight cards now require concrete evidence such as:
- `flowsessionid`
- `flowid`
- `runid`
- `environmentid`

DV Quick Run now correctly distinguishes between:
- no FlowSession evidence
- partial FlowSession context
- actionable Power Automate run linkage

👉 Results in:
- no synthetic FlowSession context
- improved evidence honesty
- reduced misleading Flow-related investigation cues

---

### 🧾 FlowSession Wording & Investigation Hierarchy Refinement

FlowSession wording and signal prominence have been refined for investigation truthfulness.

Behaviour improvements:
- weak/non-actionable FlowSession evidence now uses softer wording
- actionable Flow navigation appears only when runnable evidence exists
- asyncoperation investigation patterns correctly lead investigation ordering

Reduced:
- over-prominent weak signals
- misleading Flow run implications
- false investigation weight

👉 Results in:
- stronger operational truthfulness
- more coherent execution investigations
- clearer alignment between evidence strength and UI prominence

---

### 🧪 Stability & Behaviour

- Verified across:
  - primary signal ordering stability
  - asyncoperation-led investigation flow
  - supporting signal visibility
  - FlowSession suppression when no evidence exists
  - partial FlowSession evidence handling
  - deterministic ordering behaviour
  - `$batch` sub-result isolation

- Added regression coverage for:
  - synthetic FlowSession prevention
  - ordering consistency
  - partial FlowSession handling

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

- an investigation workbench for Dataverse and Power Platform engineering

—not a speculative telemetry platform.

Core principles reinforced:
- strongest signal first
- supporting evidence remains contextual
- investigation must remain explainable
- renderer surfaces remain thin
- diagnostics remain bounded and deterministic
- evidence strength must match UI prominence

---

## 🎯 Summary

DV Quick Run now:
- orders execution investigations more coherently
- separates reasoning from rendering more cleanly
- prevents misleading FlowSession evidence
- presents supporting signals more truthfully
- improves investigation trust without increasing diagnostic noise

👉 Establishes a stronger foundation for:
- future execution intelligence layers
- guided investigation workflows
- controlled cross-source reasoning
- deeper Power Platform execution diagnostics

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
