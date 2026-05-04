# DV Quick Run

A fast, metadata-aware Dataverse query and workflow workbench for VS Code — with guided traversal, `$batch` execution, preview-first refinement, Smart PATCH, and execution-aware insights.

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

## 🆕 What's New in v0.9.10 (Execution Insights: Async + Workflow)

> A **signal clarity and execution awareness release** — expanding Execution Insights beyond plugin traces to include async operations and workflows, with improved signal interpretation, cleaner UX, and stronger noise suppression.

---

### ⚡ AsyncOperation Insights (NEW)

DV Quick Run now detects **async execution behaviour directly from your query results**:

- failed / cancelled async operations  
- waiting / suspended states  
- long-running executions  
- repeated execution patterns  

- Surfaces:
  - execution duration  
  - state + status labels  
  - correlationId / requestId  
  - execution depth and timing  

👉 Results in:
- immediate visibility into background processing issues  
- faster diagnosis of delays and failures  
- no need to manually query `asyncoperations`  

---

### 🔗 Workflow Context Integration (NEW)

Execution Insights now includes **workflow context when available**:

- workflow name  
- primary entity  
- activation state  

👉 Enables:
- clearer understanding of what triggered execution  
- better debugging of background jobs and automation  

---

### 🧠 Smarter Signal Interpretation (Major)

Execution Insights now distinguishes between:

- repeated execution **within a single request** (often normal behaviour)  
- repeated execution **across requests** (potential pattern or issue)  

Also suppresses:
- completed + successful executions  
- low-signal background noise  

👉 Results in:
- higher signal-to-noise ratio  
- avoids unnecessary alarm  
- insights feel intentional and trustworthy  

---

### 🧾 Refined Insight Cards (Major)

Insight cards are now optimised for **fast understanding**:

Each insight focuses on:
- **what happened** (clear title)  
- **what’s happening** (evidence)  
- **why it matters** (impact)  

Improvements:
- simplified wording  
- reduced verbosity  
- more natural debugging language  

👉 Results in:
- faster comprehension (2–3 second scan)  
- clearer decision-making  
- more practical debugging experience  

---

### 🧩 Grouped Identifiers & Actions (NEW)

When multiple related records are detected:

- identifiers are grouped:
  - e.g. `AsyncOperationId (3)`  
- displayed compactly with overflow handling  

Actions:
- **Copy** (all identifiers)  
- **Query** (follow-up investigation)  

Layout improvements:
- identifiers shown first  
- actions placed consistently below  
- avoids wrapping and visual clutter  

👉 Results in:
- cleaner multi-record presentation  
- easier follow-up investigation  
- consistent interaction model  

---

### 🧪 Stability & Behaviour

- Verified across:
  - asyncoperation queries (direct + derived)  
  - workflow-linked executions  
  - failed / slow / repeated scenarios  
  - large datasets  

- Ensures:
  - no impact to Result Viewer performance  
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

- **plugin trace diagnostics**

→ to:

- **end-to-end execution awareness (async + workflow)**  

Core principles reinforced:
- signal over noise  
- concrete over abstract  
- fast understanding over completeness  
- consistent interaction model  

---

## 🎯 Summary

DV Quick Run now:

- detects async execution issues automatically  
- surfaces workflow-backed context  
- differentiates normal vs concerning behaviour  
- presents insights in a clean, actionable format  

👉 Establishes the foundation for:
- insight prioritisation  
- deeper execution intelligence  

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

- Detect slow, failed, waiting, and repeated execution patterns  
- Distinguish normal behaviour vs potential issues (same request vs cross-request)  
- See impact and recommended next steps instantly  
- Drill into raw trace and execution data when deeper debugging is needed  

Instead of manually querying `plugintracelogs`, `asyncoperations`, correlating requests, and scanning raw data across multiple tools —

DV Quick Run surfaces the most important execution signals instantly, and lets you drill deeper only when needed.

---

#### 🧠 Insight Summary

![Execution Insights Summary](docs/execution-insights-summary.png)

- Instantly identifies the relevant execution (plugin, async operation, or workflow)
- Explains why it matters (latency, failures, delays, system impact)
- Tells you exactly what to check next

---

#### 🔬 Raw Trace & Execution Details

Execution Insights bridges the gap between your query and Dataverse execution behaviour using correlation-aware lookup — something that typically requires multiple tools and manual investigation.

👉 Go from high-level insight → exact execution detail → root cause — in one place.

![Execution Insights Raw Trace](docs/execution-insights-raw.png)

- Correlation-aware inspection (plugin + async + workflow context)  
- Full raw payload available when needed  
- One-click copy for debugging and collaboration  

👉 Jump from summary → execution detail → root cause — without leaving VS Code.

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
