# DV Quick Run

A metadata-aware Dataverse query and workflow workbench for VS Code — with guided traversal, `$batch` execution, preview-first refinement, and intelligent suggestions.

**Run, understand, explore, and refine Dataverse queries — with Query-by-Canvas, Guided Traversal, and `$batch` workflows — without leaving your editor.**

---

## 🚀 What is DV Quick Run?

DV Quick Run turns VS Code into a **Dataverse developer console**.

Instead of switching between Postman, browser tabs, and maker portals, you can:

* Write queries
* Run them instantly
* Explore results in a table
* Investigate records
* Refine queries safely using Query-by-Canvas (preview-first)
* Navigate relationships step-by-step (Guided Traversal)
* Enrich results without rewriting queries

All inside VS Code — with a preview-first, user-controlled workflow.

---

## 🆕 What's New in v0.9.1 (Guided Traversal Graph & Stability)

> Adds a visual traversal layer and fixes Result Viewer rendering issues — making Guided Traversal more intuitive and reliable.

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
  - highlights selected traversal route
  - reduces noisy/system relationships
  - supports multi-hop paths

👉 Understand relationships visually instead of guessing paths.

---

### ⚡ Graph → Traversal Execution (NEW)

- Added **Use this route** action
- Selecting a route now:
  - triggers actual Guided Traversal execution
  - passes relationship chain into traversal engine
  - closes graph panel automatically

👉 Enables:
- visual selection → immediate execution
- no manual reconstruction of paths

---

### 🧱 Result Viewer Stability Fix (Critical)

- Fixed **blank Result Viewer issue** (VS Code webview lifecycle)

Changes:
- switched to **fresh panel creation** instead of reuse
- ensured HTML assignment always executes
- stabilised script bootstrap

👉 Results in:
- consistent rendering
- no more intermittent blank screens

---

### 🧪 Stability

- Verified:
  - graph rendering across route selections
  - graph → traversal execution flow
  - Result Viewer reliability across runs
- No regression in:
  - Guided Traversal
  - `$batch`
  - Binder suggestions
  - Query-by-Canvas

---

### 🧠 Notes

This release extends DV Quick Run from:

**guided traversal → visual traversal + execution**

Laying the foundation for:
- smarter route ranking
- deeper graph-assisted reasoning
- tighter integration with Query Doctor

---

## 🆕 What's New in v0.9.0 (Guided Traversal, $batch & Binder)

> Introduces Guided Traversal, `$batch` execution workflows, and Binder suggestions — transforming DV Quick Run into a more complete Dataverse query and workflow workbench.

---

### 🧭 Guided Traversal (Improved)

- Renamed **Find Path to Table** → **Guided Traversal**
- Available via:
  - Command Palette
  - editor right-click
- Cleaner traversal output:
  - reduced noise
  - clearer step-by-step flow
- Improved completion experience

👉 Navigate relationships without writing complex queries.

---

### ⚡ $batch Execution (NEW)

- Run **multiple queries together** using `$batch`
- Supports:
  - manual multi-query execution
  - Guided Traversal replay as `$batch`

👉 Enables:
- efficient execution
- multi-endpoint validation
- workflow-based querying

---

### 🧠 Binder Suggestions (NEW)

- Lightweight, context-aware suggestions (💡)
- Shows **one strong recommendation at a time**

Examples:
- continue traversal
- run traversal as `$batch`
- refine `$batch`
- add `$top` / `$select`

Behaviour:
- only appears when relevant
- clickable text (no extra UI)

👉 Guided workflows without noise.

---

### 🧹 UX Improvements

- Simplified traversal output 
- Removed low-value hints (e.g. SQL mental notes)
- Improved alignment between:
  - traversal
  - Result Viewer
  - suggestions

---

### 🧪 Stability

- All unit tests passing
- Verified:
  - traversal workflows
  - `$batch` execution
  - Binder lifecycle
- No regression in:
  - query execution
  - Result Viewer
  - Query-by-Canvas

---

### 🧠 Notes

This release marks a shift from:

**query execution → guided query workflows**

Lays the foundation for:
- smarter recommendations
- deeper Query Doctor integration

---

## 🎬 Result Viewer

![DV Quick Run Result Viewer](docs/demo-result-viewer.gif)

Typical workflow:

start simple → run → explore → refine (Query-by-Canvas) → enrich → refine → repeat

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
* Sort, filter, and inspect data inline

---

### 🔗 Guided Traversal + Enrichment

* Traverse relationships step-by-step across Dataverse tables
* Continue traversal using real data (row-driven)
* Enrich results in-place using **Sibling Expand**
* Build complex multi-entity queries without manual `$expand`

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

* Build queries (GET / PATCH) with guided prompts
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

DV Quick Run detects risky queries (e.g. missing `$top`) and warns before execution.

---

## 👥 Who Is This For?

* Dataverse / Dynamics 365 developers
* Power Platform engineers
* Integration / API developers

---

## 💡 Why DV Quick Run?

Because the fastest workflow is:

**write → run → explore → fix → repeat**

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
