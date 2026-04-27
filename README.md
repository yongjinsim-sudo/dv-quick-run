# DV Quick Run

A metadata-aware Dataverse query and workflow workbench for VS Code — with guided traversal, `$batch` execution, preview-first refinement, Smart PATCH, and intelligent suggestions.

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

## 🆕 What's New in v0.9.6 (Enterprise Stability & Large Dataset Handling)

> Hardens DV Quick Run for **real-world enterprise usage**, focusing on large datasets, reliability, and predictable behaviour under load.

---

### 📊 Large Dataset Stability (Major)

- Result Viewer now uses a **session-backed model**
  - full dataset stored once
  - UI renders controlled windows (default 100 rows)

- Supports safe row windows:
  - 100 / 200 / 500 / 1000
  - prevents UI lockups from large renders

- Large datasets (1000–5000+ rows):
  - handled safely without crashing
  - progressive rendering ensures responsiveness

👉 Results in:
- stable behaviour in enterprise environments  
- no more viewer crashes or “dead” states  
- predictable performance under load  

---

### 🔍 Full Dataset Search (Correctness Fix)

- Search now operates on **entire result set**, not just visible rows

- Behaviour:
  - finds matches across all rows
  - displays accurate match count

👉 Results in:
- trustworthy search results  
- no missing matches due to paging  

---

### 📄 Paging & Windowing UX

- Added row window controls:
  - `Show 100 / 200 / 500 / 1000`

- Smart UI behaviour:
  - hides unnecessary options for small datasets
  - hides navigation when not needed

- Clear indicators:
  - `Rows X–Y of Z`

👉 Results in:
- cleaner UI  
- better navigation across datasets  

---

### ⚡ Rendering Reliability Improvements

- Fixed:
  - blank Result Viewer issue
  - stuck “Loading rows…” state
  - large window rendering freezes

- Improved:
  - progressive rendering feedback
  - consistent render completion

👉 Results in:
- reliable viewer lifecycle  
- no need to rerun queries due to UI issues  

---

### 🧠 Result Viewer Architecture Upgrade

- Result Viewer now:
  - decouples dataset from UI rendering
  - uses session as source of truth

👉 Enables future:
- slice-and-dice workflows  
- result-driven insights  
- advanced Query Doctor features  

---

## 🧭 Notes

This release focuses on **stability and correctness over new features**.

DV Quick Run is now:
- safe for **large enterprise datasets**
- reliable under **real-world load**
- positioned as a **data interaction surface**, not just a viewer

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
