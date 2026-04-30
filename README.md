# DV Quick Run

A fast, metadata-aware Dataverse query and workflow workbench for VS Code — with guided traversal, `$batch` execution, preview-first refinement, Smart PATCH, and safe, on-demand insights.

**Run, understand, explore, refine, and safely update Dataverse data — with Query-by-Canvas, Guided Traversal, Smart PATCH, and `$batch` workflows — without leaving your editor.**

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

All inside VS Code — with a preview-first, user-controlled workflow.

---

## 🆕 What's New in v0.9.8 (Fast-First Result Viewer & Safe Insights)

> A **stability and trust-focused release** — ensuring DV Quick Run remains fast, safe, and reliable under large and wide Dataverse queries.

---

### ⚡ Fast-First Result Viewer (Major)

- Result Viewer now prioritises **instant responsiveness**
- Insight generation no longer blocks or slows initial render

- Eliminates crash scenarios caused by:
  - wide entities (e.g. `contacts`)
  - large payloads without `$select`
  - heavy result-driven analysis

👉 Results in:
- consistent performance across environments
- no extension host crashes on broad queries
- predictable behaviour under enterprise datasets

---

### 🛡️ Safe Mode for Broad Queries (NEW)

- Introduced **Safe Mode** for potentially unsafe queries

Triggered when:
- no `$select` present
- wide or large result sets detected

- Behaviour:
  - Result Viewer opens immediately
  - result-driven insights are paused
  - user can trigger insights manually

👉 Ensures:
- safe handling of large datasets
- clear, intentional system behaviour
- no confusion between “slow” vs “protected”

---

### 🧠 Deferred Insights (NEW)

- Insights are now **user-triggered**, not automatic

- Added:
  - **Get Insights** action in Insight Drawer

- Behaviour:
  - query execution remains fast
  - insights run only when explicitly requested

👉 Establishes:
- separation between data retrieval and analysis
- user control over performance vs insight depth

---

### 🔍 Sample-Based Insights (NEW)

- Insights operate on a **safe sample of the current result page**

Default limits:
- 20 rows
- 40 columns

- Preserves:
  - formatted values (e.g. Choice labels)
  - meaningful field relationships

- Insight messaging includes:
  - sample size
  - total result context

👉 Results in:
- fast insight generation
- representative (but safe) analysis
- no full-table scanning

---

### ⏱️ Safe Insight Execution (NEW)

- Introduced **bounded insight execution**

Includes:
- soft time budget (~2–3 seconds)
- sampling limits
- early exit when limits reached

- Behaviour:
  - insights degrade gracefully
  - partial results returned when needed

👉 Prevents:
- UI freezes
- runaway computations
- performance degradation

---

### 🧩 Foundation for Future Insights

- Introduced structured insight execution model:
  - sampling-first
  - budget-controlled
  - fail-safe by design

👉 Prepares DV Quick Run for:
- deeper result analysis

— without compromising performance

---

## 🧭 Notes

This release introduces a key architectural shift:

- Insights move from:
  - **automatic and eager**
→ to:
  - **explicit, safe, and user-controlled**

Core principles reinforced:
- fast-first execution
- safe handling of enterprise-scale data
- insights as optional intelligence
- graceful degradation over failure

---

## 🎯 Summary

DV Quick Run now:

- stays fast under all query conditions
- avoids crashes on wide/large datasets
- provides insights only when needed
- establishes a safe foundation for future intelligence features

👉 This ensures DV Quick Run remains:
- **quick**
- **reliable**
- **enterprise-ready**

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

DV Quick Run detects risky query and mutation scenarios — such as missing `$top`, unsafe PATCH contexts, or unsupported expanded-field updates — and guides you before execution.

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
