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

## 🆕 What's New in v0.9.4 (Smart PATCH, Insight-Driven Refresh & Workflow Completion)

> Completes the **inspect → refine → PATCH → refresh loop**, turning DV Quick Run into a **true interactive Dataverse workflow environment**.

---

### ✏️ Smart PATCH (Preview-First Record Updates)

- Update Dataverse records directly from Result Viewer interactions

- Full workflow:
  - trigger update from data (cell-driven)
  - preview PATCH request (no hidden changes)
  - confirm before execution
  - apply safely

- Preview includes:
  - entity + record ID
  - PATCH path
  - payload
  - HTTP representation
  - cURL example

👉 Results in:
- safe, transparent updates  
- no silent mutations  
- consistent preview-first behaviour  

---

### 🔁 Automatic Result Refresh After PATCH

- Result Viewer now **refreshes automatically after PATCH**

- Behaviour:
  - re-runs original query
  - reflects updated data immediately

- Resilient flow:
  - PATCH success is preserved even if refresh fails
  - refresh failure shown as **non-blocking warning**

👉 Results in:
- smooth edit → verify workflow  
- no manual rerun required  
- reliable feedback loop  

---

### 🧠 Insight-Driven Execution

- DV Quick Run now uses **captured query context (Insight Model)** as the source of truth

- Applies to:
  - refresh
  - rerun
  - PATCH workflows

- No longer relies on:
  - current editor position  
  - manual query reconstruction  

👉 Results in:
- consistent behaviour across actions  
- elimination of path duplication bugs  
- predictable execution flow  

---

### 📊 Workflow Completion

DV Quick Run now supports the full loop:
  ```
  Query → Result → Refine → PATCH → Refresh → Continue
  ```

- Result Viewer acts as:
  - exploration surface  
  - mutation entry point  
  - verification surface  

👉 Enables:
- fully iterative workflows  
- fewer context switches  
- faster development cycles  

---

### 🧾 UX & Logging Improvements

- Improved error handling:
- PATCH failure → clear error  
- refresh failure → warning (non-blocking)  

👉 Results in:
- better clarity  
- improved trust in execution  
- less noise  

---

### 🧠 Notes

This release marks a key shift:

- DV Quick Run evolves from:
- **query tool**
→ to:
- **interactive Dataverse workflow environment**

Core principles reinforced:
- preview-first safety  
- insight-driven execution  
- result-driven refinement  
- consistent interaction loop  

---

## 🆕 What's New in v0.9.3 (Result Viewer Command Surface & Preview-First Refinement)

> Evolves the Result Viewer into a **true interactive query workspace**, unifying actions, enforcing preview-first workflows, and making query refinement **data-driven and predictable**.

---

### 📊 Result Viewer as Command Surface (Expanded)

- Result Viewer now acts as the **primary interaction surface**
  - refine queries directly from returned data
  - reduces reliance on manual query editing

- Supported actions:
  - add `$select` from column
  - filter by value
  - sort from column
  - investigate records

👉 Results in:
- tighter **inspect → refine → rerun** loop  
- faster query iteration  
- more intuitive workflows  

---

### ✨ Add to `$select` from Column (NEW)

- Added **“Add this column to $select”** action

- Available via:
  - cell context menu
  - column-level interaction

- Behaviour:
  - detects correct scope:
    - root query
    - `$expand`
    - nested `$expand`
  - updates `$select` accordingly

- Uses **preview-first workflow**

👉 Results in:
- faster field selection  
- safer query mutation  
- reduced manual editing  

---

### 👁️ Preview-First Refinement (Standardised)

- All Result Viewer actions now follow a **consistent preview-first pattern**

Workflow:
- trigger action → preview → confirm → apply  

- No silent mutations  
- No hidden behaviour  

👉 Ensures:
- full user control  
- predictable query changes  
- safe experimentation  

---

### 🚫 Disabled Actions with Clear UX (NEW)

- Invalid actions are now:
  - visibly **disabled**
  - styled consistently across menus

- Examples:
  - `$orderby` on unsupported scopes  
  - OData-only actions in FetchXML context  

- Disabled actions:
  - do not execute  
  - do not trigger preview  
  - clearly communicate limitations  

👉 Results in:
- reduced confusion  
- clearer feature boundaries  
- improved usability  

---

### ⚠️ Guardrails & Scope Validation Improvements

- Strengthened query mutation validation:
  - prevents invalid `$orderby` usage  
  - ensures correct scope application  
  - avoids malformed queries  

- Mutation behaviour now:
  - respects entity boundaries  
  - merges safely with existing clauses  
  - avoids unintended overwrites  

👉 Prevents:
- runtime Dataverse errors  
- incorrect query construction  

---

### 🧠 Result Viewer Interaction Consistency

- All actions now:
  - use a unified action system  
  - align with preview pipeline  
  - behave consistently across contexts  

- Improved alignment between:
  - Result Viewer  
  - editor mutations  
  - traversal outputs  
  - preview system  

👉 Results in:
- predictable behaviour  
- cleaner mental model  
- no mixed interaction patterns  

---

### 🧪 Stability

- Verified:
  - `$select` mutation across scopes  
  - preview → apply workflows  
  - disabled action behaviour  
  - Result Viewer interactions  

- No regression in:
  - Guided Traversal  
  - Traversal Graph  
  - `$batch` execution  
  - Query Doctor  

---

### 🧠 Notes

This release marks a key evolution:

- Result Viewer shifts from:
  - **data display**
→ to:
  - **interactive query workspace**

DV Quick Run now:
- enables **data-driven query refinement**
- enforces **preview-first safety**
- provides **clear action boundaries**

This lays the foundation for:
- deeper Query-by-Canvas workflows  
- result-aware Query Doctor enhancements  
- richer table-driven analysis  

---

## 🆕 What's New in v0.9.2 (Graph UX Completion, Context-Aware Mutation & Result-Driven Actions)

> Completes the Guided Traversal Graph experience, introduces fully **context-aware query mutation**, and evolves the Result Viewer into a **true interactive command surface**.

---

### 🧭 Guided Traversal Graph (Completed & Polished)

- Completed the **Guided Traversal Graph UX**
  - graph now acts as a **primary reasoning surface**
  - powered by Cytoscape for interactive exploration

- Visual behaviour improvements:
  - highlights only the **selected traversal path**
  - dims all non-relevant nodes (even if in allowed tables)
  - removes visual noise from unrelated entities
  - prevents highlight leakage across paths

- Path integrity fixes:
  - ensures **all entities in the selected path remain connected**
  - removes orphaned or partially-highlighted nodes
  - aligns visual path strictly with traversal execution logic

- Search-driven graph filtering:
  - search now filters to **paths that pass through selected entity**
  - maintains **correct linking for selected route**
  - avoids mixing unrelated route fragments

- Route selection UX:
  - route chips remain the primary selection mechanism
  - selected route panel clearly shows:
    - rank
    - hop count
    - confidence
    - warnings
    - relationship chain

👉 Results in:
- clearer mental model of relationships  
- accurate path visualisation  
- reduced confusion in multi-hop traversal  

---

### ⚡ Graph → Traversal Execution

- **Use this route** action fully integrated

- Selecting a route:
  - executes Guided Traversal immediately
  - passes relationship chain to traversal engine
  - closes graph panel automatically

👉 Enables:
- visual reasoning → execution in one step  
- no manual reconstruction of queries  

---

### ✨ Context-Aware Query Mutation (NEW)

- `$select` and `$filter` mutators are now fully **scope-aware**

- Detects whether the cursor is inside:
  - root query
  - `$expand`
  - nested `$expand`

- Applies mutations to the **correct entity scope**

Example:

```text
$expand=owninguser(...)
```

- Add Select Fields now updates:

```text
owninguser($select=...)
```

👉 Instead of incorrectly modifying root query

👉 Results in:
- correct query construction  
- reduced manual fixes  
- safer multi-entity queries  

---

### 🔍 Scoped Filter (NEW)

- Added **scope-aware `$filter` mutation**

- Filters can now be applied at:
  - root level  
  - nested expand level  

- Automatically:
  - detects correct scope  
  - merges using `and`  

👉 Enables:
- precise filtering of expanded entities  
- clean multi-entity refinement  

---

### 📊 Result Viewer → Filter by This Value (NEW)

- Added **Filter by this value** action

- Available via kebab menu on cell values

- Supports:
  - OData → `$filter`
  - FetchXML → `<condition>`

Workflow:
- click value → preview → apply  

👉 Results in:
- inspect → refine → rerun loop  
- zero manual query editing  

---

### ↕️ Column Header Actions (NEW)

- Right-click on **column headers**

- Behaviour:
  - suppresses default browser context menu
  - shows DV Quick Run actions

- Supports:
  - **Add `$orderby` (ascending)** for root-level columns

👉 Results in:
- direct sorting from results  
- cleaner, controlled interaction model  

---

### ⚠️ Order By Guardrails

- Scoped `$orderby` intentionally **restricted**

- Behaviour:
  - ❌ blocked inside `$expand`
  - ⚠️ warning shown with guidance  

👉 Prevents:
- invalid Dataverse queries  
- misleading behaviour  

---

### 🧠 Result Viewer as Command Surface

- Result Viewer now supports:
  - filter from values  
  - sort from headers  
  - investigate records  

- UX improvements:
  - clearer action naming:
    - `Filter by this value (OData)`
    - `Filter by this value (FetchXML)`
  - consistent kebab actions
  - fixed overlay/z-index issues
  - improved context menu behaviour

👉 Results in:
- faster workflows  
- higher discoverability  
- tighter feedback loop  

---

### 🧱 Behaviour Improvements

- Query mutation:
  - respects scope  
  - avoids overwriting unrelated clauses  
  - merges safely  

- Graph rendering:
  - preserves selected route integrity  
  - removes misleading highlights  
  - aligns with traversal logic  

- Improved consistency across:
  - traversal graph  
  - query editor  
  - Result Viewer  
  - preview system  

---

### 🧪 Stability

- Verified:
  - graph rendering + path integrity  
  - search-based graph filtering  
  - scoped `$select`, `$filter`  
  - Result Viewer actions  
  - header-based `$orderby`  

- No regression in:
  - Guided Traversal  
  - `$batch` execution  
  - Binder suggestions  
  - Query-by-Canvas  

---

### 🧠 Notes

This release completes two major pillars:

- **Guided Traversal → visual reasoning system**
- **Query mutation → context-aware and result-driven**

DV Quick Run now:
- enables visual route reasoning  
- applies changes in the correct scope  
- supports data-driven refinement from results  
- enforces safe query patterns through guardrails  

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
