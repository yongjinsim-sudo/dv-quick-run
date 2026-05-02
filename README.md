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

## 🆕 What's New in v0.9.9 (Execution Insights & Runtime Diagnostics)

> A **runtime diagnostics release** — bringing correlation-based Execution Insights, plugin trace analysis, raw trace access, and safer large-payload handling directly into the Result Viewer.

---

### ⚡ Execution Insights (NEW)

- Added **Execution Insights** to the Result Viewer

- Detects runtime execution signals such as:
  - slow plugin execution
  - repeated plugin execution
  - nested execution depth
  - exception traces

- Works from:
  - direct `plugintracelogs` queries
  - normal Dataverse queries when correlation metadata is available

👉 Results in:
- faster diagnosis of backend execution behaviour
- early visibility into plugin-related latency
- less manual digging through plugin trace logs

---

### 🔗 Correlation-Based Trace Lookup (NEW)

- DV Quick Run now captures execution metadata from Dataverse responses, including:
  - correlation id
  - request id
  - execution path context

- When available, Execution Insights can use this metadata to inspect matching plugin traces for the current request.

- Behaviour:
  - explicit user-triggered action
  - bounded lookup
  - no broad background scanning

👉 Enables:
- runtime insight from ordinary queries such as `contacts?$top=10`
- safer, targeted plugin trace analysis
- foundation for future execution timeline and compare workflows

---

### 🧠 Plugin Trace Signal Engine (NEW)

- Introduced signal-based plugin trace analysis

- Signals are:
  - grouped by plugin
  - ranked by impact
  - consolidated into readable insight cards

- Insight cards include:
  - detected signals
  - impact
  - recommended next steps

👉 Results in:
- less noise than raw plugin trace rows
- clearer prioritisation
- actionable guidance instead of raw diagnostics only

---

### 🔍 Raw Trace Details (NEW)

- Added **View raw trace details** inside Execution Insights

- Raw trace details include:
  - pluginTraceLogId
  - correlationId / requestId
  - message name
  - entity name
  - duration
  - depth
  - raw JSON payload

- Added **Copy raw JSON** for deeper investigation or sharing.

👉 Preserves full traceability while keeping the main insight card readable.

---

### 📦 Large Plugin Trace Payload Handling (Improved)

- Improved handling of large `plugintracelogs` payloads, especially configuration-heavy trace data

- Result Viewer now:
  - keeps table rendering responsive
  - avoids hanging the JSON view on very large payloads
  - supports session-backed **Save JSON**
  - supports CSV export for large trace results

👉 Results in:
- safer inspection of large plugin trace datasets
- reliable export for offline analysis
- better behaviour under enterprise-scale trace volumes

---

### ⏱️ Bounded Execution & Graceful Fallbacks

- Execution Insights are still explicit and bounded

- Handles:
  - no trace signals found
  - timeout scenarios
  - unavailable trace access
  - partial/minimal plugin trace schemas

- Uses safe fallback behaviour where possible.

👉 Prevents:
- UI blocking
- repeated noisy suggestions
- broad uncontrolled trace scans

---

## 🧭 Notes

This release introduces a major new direction:

- DV Quick Run moves from:
  - **query execution and refinement**
→ to:
  - **execution-aware diagnostics**

Core principles reinforced:
- signal over noise
- explicit user control
- bounded runtime analysis
- raw data preserved behind clean insight summaries

---

## 🎯 Summary

DV Quick Run now:

- detects plugin execution issues from query results
- surfaces slow, repeated, nested, and exception-related signals
- uses captured request metadata for targeted trace lookup
- keeps raw trace details available when deeper investigation is needed
- improves large plugin trace export and JSON handling

👉 This establishes the foundation for:
- execution timeline reconstruction
- Insight Model export
- re-run and compare workflows
- MCP-driven debugging capabilities

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

DV Quick Run surfaces **plugin execution behaviour** directly in the Result Viewer:

- Detect slow, repeated, nested, and exception-related plugin behaviour
- See impact and recommended next steps instantly
- Drill into raw trace data when deeper debugging is needed
- Copy trace payloads for sharing or further investigation

Instead of manually querying `plugintracelogs`, correlating requests, and scanning raw traces across multiple tools —

DV Quick Run surfaces the most important execution signals instantly, and lets you drill deeper only when needed.

---

#### 🧠 Insight Summary

![Execution Insights Summary](docs/execution-insights-summary.png)

- Instantly identifies the problematic plugin
- Explains why it matters (latency, failures, user impact)
- Tells you exactly what to check next

---

#### 🔬 Raw Trace Details

Execution Insights automatically bridges the gap between your query and Dataverse plugin execution using correlation-aware trace lookup — something that typically requires multiple tools and manual investigation.

👉 Go from high-level insight → exact trace → root cause — in one place.
![Execution Insights Raw Trace](docs/execution-insights-raw.png)

- Correlation-aware trace inspection
- Full raw payload available
- One-click copy for debugging and collaboration

👉 Jump from summary → raw trace → root cause — without leaving VS Code.

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
