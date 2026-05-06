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

## 🆕 What's New in v0.9.12 (Guided Execution Investigation & Primary Signal Reasoning)

> An **execution investigation refinement release** — evolving Execution Insights from signal detection into guided execution investigation with primary signal prioritisation, asyncoperation reasoning, and cross-source execution stitching.

---

### 🧠 Primary Execution Signal Prioritisation (NEW)

Execution Insights now identifies the **main execution pattern first** instead of surfacing disconnected diagnostic cards in arbitrary order.

DV Quick Run now:
- prioritises the strongest/highest-confidence execution pattern
- surfaces supporting signals afterward
- keeps the investigation narrative coherent

Examples:
- repeated background async execution
- recurring cross-request execution patterns
- nested plugin execution chains

👉 Results in:
- clearer mental model of execution behaviour
- easier investigation starting point
- less cognitive overload during debugging

---

### 🔗 Guided Investigation Flow (NEW)

Execution Insights now includes structured investigation guidance directly inside insight cards.

New investigation sections include:
- **Primary signal**
- **Summary**
- **Guided investigation**
- **Related signals**

Behaviour:
- explains why a signal matters
- links related evidence together
- provides concrete next investigation steps

👉 Results in:
- more coherent debugging workflows
- easier reasoning across Dataverse execution chains
- reduced need to manually correlate execution data

---

### ⚡ AsyncOperation + Plugin Trace Correlation (Expanded)

DV Quick Run now stitches together:
- async operations
- plugin traces
- workflow context

…into a more connected execution investigation experience.

Execution Insights can now:
- surface related plugin traces from asyncoperation context
- provide correlation-aware follow-up investigation guidance
- distinguish primary vs supporting execution evidence

👉 Enables:
- easier debugging of recurring background activity
- better visibility into Dataverse ↔ Power Platform execution behaviour
- clearer investigation of repeated or cascading execution patterns

---

### 📊 Guided Execution Insights

Execution Insights now behaves more like a guided runtime investigation surface instead of isolated diagnostic cards.

DV Quick Run now:
- surfaces the primary execution issue first
- groups supporting evidence underneath
- provides investigation-focused summaries instead of raw signal dumps

👉 Results in:
- faster comprehension
- more trustworthy diagnostics
- clearer troubleshooting progression

---

### 🔬 Expanded Raw Investigation Details

Raw execution detail rendering has been refined for readability and investigation flow.

Provides:
- concise execution summaries
- grouped correlation/request identifiers
- expandable raw JSON evidence
- correlation-aware investigation actions

👉 Enables:
- deep debugging when needed
- cleaner default insight experience
- balance between abstraction and low-level evidence

---

### 🧪 Stability & Behaviour

- Verified across:
  - asyncoperation primary signal prioritisation
  - plugin trace correlation guidance
  - grouped execution investigation flows
  - raw execution detail rendering
  - mixed execution insight datasets

- No regression in:
  - Result Viewer
  - Execution Insights
  - `$batch` investigation
  - plugin trace insights
  - asyncoperation insights
  - workflow-linked execution analysis

---

## 🧭 Notes

This release evolves Execution Insights from:

- detecting execution signals

→ to:

- guiding execution investigation

Core principles reinforced:
- strongest signal first
- supporting evidence should reinforce, not compete
- investigation flow should feel coherent
- execution diagnostics must remain explainable and bounded

---

## 🎯 Summary

DV Quick Run now:

- prioritises primary execution patterns automatically
- guides users through execution investigation flows
- correlates async operations with supporting plugin traces
- presents execution diagnostics as a coherent investigation narrative

👉 Establishes the foundation for:
- cross-source execution reasoning
- execution timeline reconstruction
- deeper Power Platform runtime diagnostics
- future insight prioritisation systems

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
