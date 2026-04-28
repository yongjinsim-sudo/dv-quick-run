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

## 🆕 What's New in v0.9.7 (Insight-Driven Result Viewer & Multi-Insight Query Doctor)

> Introduces the first **result-aware insight system inside the Result Viewer**, evolving DV Quick Run into a **guided, insight-driven Dataverse workbench**.

---

### 💡 Insight Drawer (NEW)

- Added **Insight Drawer**
  - Accessible via lightbulb / Insights button
  - Displays **context-aware recommendations based on query + results**

- Each insight includes:
  - recommendation
  - reasoning (when available)
  - source (Query Doctor / Binder)
  - confidence
  - optional action (Apply for Pro/dev)

👉 Results in:
- clearer understanding of “what to do next”
- separation between insight and execution

---

### 🧠 Multi-Insight Query Doctor (Major)

- Result Viewer now surfaces **multiple insights at once**

Examples:
- missing `$top`
- missing `$select`
- result-driven suggestions:
  - e.g. `statecode = Active` when distribution is uneven

- Insights are:
  - deduplicated
  - ranked
  - available for navigation

👉 Results in:
- richer, result-aware guidance
- more realistic decision-making flow

---

### 🔄 Insight Navigation

- Navigate insights manually:

`[‹] Insight X of Y [›]`

- Behaviour:
  - user-controlled exploration
  - Binder still shows the primary recommendation

---

### 🧩 Result Viewer as an Insight Surface

- Result Viewer now acts as:
  - data exploration surface
  - insight surface
  - action surface

- Integrated with:
  - Query Doctor
  - Binder suggestions
  - preview-first mutation pipeline

👉 Enables:
```
Query → Result → Insight → Action → Refine
```

---

### 🖱️ Context Menu Control (Foundation)

- Removed default browser right-click menu across:
  - table
  - toolbar
  - blank areas
  - Insight Drawer

- Preserved for:
  - inputs / editable fields

👉 Establishes foundation for:
- table-driven actions
- slice-and-dice workflows
- command-surface UX

---

## 🧭 Notes

This release marks a major evolution:

DV Quick Run moves from:
- **query + result tool**

to:
- **insight-driven workflow assistant**

Key principles:
- insight-first guidance
- preview-first execution
- result-aware reasoning
- minimal, high-confidence recommendations

---

## 🎯 Summary

DV Quick Run now:

- understands query results
- suggests meaningful next steps
- enables controlled execution from insights

👉 Establishes foundation for:
- deeper Query Doctor intelligence
- interactive result analysis
- fully guided data workflows

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
