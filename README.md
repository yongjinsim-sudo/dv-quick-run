# DV Quick Run

A metadata-aware Dataverse query, investigation, and reasoning workbench for VS Code — now with built-in Query Doctor for diagnostics and suggested fixes.

**Run, understand, and explore Dataverse data — without leaving your editor.**

---

## 🚀 What is DV Quick Run?

DV Quick Run turns VS Code into a **Dataverse developer console**.

Instead of switching between Postman, browser tabs, and maker portals, you can:

* Write queries
* Run them instantly
* Explore results in a table
* Investigate records
* Refine and repeat

All inside VS Code.

---

## 🆕 What's New in v0.7.0

* **Query Doctor (foundation)**
  - Analyses Dataverse queries and surfaces diagnostics directly within Explain Query
  - Provides:
    - issue detection
    - advisory guidance
    - prioritised diagnostic output
  - Designed as a non-blocking developer assist layer (not strict validation)

* **Suggested Fixes**
  - Diagnostics now include actionable suggested fixes
  - Each suggestion provides:
    - clear intent
    - explanation
    - example queries where applicable
  - Helps developers move from “what’s wrong” → “how to fix it”

* **Query shape & metadata-aware diagnostics**
  - Detects common issues such as:
    - missing `$select`
    - missing `$top`
    - inefficient query patterns
  - Extends into metadata-aware validation (Level 2 capability)

* **Expand boundary awareness**
  - Detects `$expand` usage and surfaces advisory guidance
  - Prevents misleading diagnostics for nested or complex expand scenarios
  - Establishes clear capability boundaries for Query Doctor

* **Diagnostics integrated into Explain Query**
  - Explain output now includes a dedicated **Diagnostics** section
  - Clear separation between:
    - explanation (what the query does)
    - diagnostics (how to improve it)

* **Foundation for future Query Doctor capabilities**
  - Architecture now supports:
    - auto-fix workflows
    - interactive query refinement
    - deeper semantic reasoning (planned)

*(This release focuses on correctness, trust, and extensibility — advanced scenarios such as deep `$expand` and complex FetchXML reasoning are planned for future releases.)*

---


## 🎬 Result Viewer

![DV Quick Run Result Viewer](docs/demo-result-viewer.gif)

Typical workflow:

write query → run → explore → investigate → refine → repeat

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

### 🧠 Explain Query + Query Doctor

* Break queries into human-readable explanations
* Understand filters, sorting, and structure instantly

**Now includes Query Doctor:**

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
