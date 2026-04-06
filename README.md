# DV Quick Run

A metadata-aware Dataverse query, investigation, and reasoning workbench for VS Code — with guided traversal, preview-first query refinement, interactive filter refinement, enrichment, and intelligent Query Doctor diagnostics.

**Run, understand, explore, and refine Dataverse queries — now with Query-by-Canvas and interactive inline refinement — without leaving your editor.**

---

## 🚀 What is DV Quick Run?

DV Quick Run turns VS Code into a **Dataverse developer console**.

Instead of switching between Postman, browser tabs, and maker portals, you can:

* Write queries
* Run them instantly
* Explore results in a table
* Investigate records
* Refine queries safely using Query-by-Canvas (preview-first)
* Navigate relationships step-by-step
* Enrich results without rewriting queries

All inside VS Code — with a preview-first, user-controlled workflow.

---

## 🆕 What's New in v0.8.1 (Result Viewer + Business-Aware Query Doctor)

> Enhances large dataset handling and improves Query Doctor with business-aware field prioritisation — making insights faster, clearer, and more useful in real-world Dataverse environments.

---

### ⚡ Result Viewer Enhancements (Large Dataset Ready)

- **Large Result Mode**
  - Automatically activates for large datasets (e.g. thousands of rows)
  - Prevents UI blocking during heavy renders

- **Progressive Rendering**
  - Results render incrementally instead of all-at-once
  - Users can see data immediately while remaining rows load

- **Auto Progressive Loading (No Click Required)**
  - Automatically continues rendering until full dataset is loaded
  - No need for manual “Load more”

- **Render Progress Indicator**
  - Displays progress (e.g. `1200 of 5000 rows`)
  - Provides visibility into loading state

- **Large Dataset Feedback Banner**
  - Clearly communicates partial rendering and ongoing loading

---

### 💾 Save JSON (Export Current Page)

- Export current results directly from Result Viewer
- Context-aware filename:
  - `dvqr_<entity>-page-<n>.json`
- Includes current dataset and paging metadata (`@odata.nextLink`)

---

### 🧠 Business-Aware Query Doctor

- **Improved field prioritisation**
  - Boosts meaningful categorical fields (e.g. status, intent, type)
  - De-prioritises technical fields (e.g. `_..._value`, GUIDs)

- **More relevant narrowing suggestions**
  - Focuses on fields users actually care about
  - Reduces noise from low-signal attributes

- **Better real-world usefulness**
  - Moves beyond “technically correct” suggestions
  - Surfaces insights aligned with business context

---

### 🔁 Pagination Awareness

- Result Viewer now reflects Dataverse paging behaviour
- Supports:
  - large result sets (5000+ records)
  - navigation across pages
- Maintains transparency when dataset is partial

---

### 🧠 Notes

- Designed for real enterprise datasets (e.g. Bupa-scale Dataverse)
- Improves:
  - perceived performance
  - usability under large data loads
- Lays foundation for:
  - future result insights
  - deeper analysis workflows

---

## 🆕 What's New in v0.8.0 (Evidence-Aware Query Doctor)

> Introduces an evidence-driven Query Doctor with structured narrowing insights — helping you understand and refine queries based on actual returned data patterns.

- **Evidence-Aware Query Doctor**
  - Uses:
    - query shape
    - returned row patterns
    - lightweight execution evidence
  - Moves beyond static advice into **result-aware guidance**

- **Structured Narrowing Insights**
  - Detects meaningful patterns in returned rows
  - Surfaces potential ways to refine queries using:
    - repeated categorical values (e.g. status, state, priority)
    - null vs non-null distributions
  - Helps identify *where* to narrow — not just *that* you should

- **Explainable Suggestions**
  - Each suggestion includes a clear reason
  - Examples:
    - “value X appears 12 times”
    - “field populated in 18/30 rows”
  - Builds trust through transparent, evidence-based guidance

- **Suggested Query Guidance**
  - Clear, direct next steps for refining queries

- **Metadata-Accurate Suggestions**
  - Suggested queries use valid fields for the current entity
  - Prevents incorrect or cross-entity recommendations

- **Improved Readability with Formatted Values**
  - Query Doctor prefers human-readable labels where available
  - Example:
    - `statecode = Active` instead of raw numeric values

---

### ✨ New Workflow: Evidence-Based Refinement

Instead of guessing how to improve your query:

1. Run a query  
2. Open **Explain Query**  
3. See:
   - observed patterns
   - narrowing opportunities
   - suggested queries  
4. Refine manually with confidence  
5. Re-run and iterate  

run → observe → understand → refine → repeat

---

### 🧠 Notes

- This release focuses on:
  - insight quality
  - explainability
  - trust
  - correctness

- Establishes the foundation for:
  - interactive query refinement
  - deeper analysis workflows
  - future execution-driven improvements

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
* See relationships, summary, and suggested queries

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
