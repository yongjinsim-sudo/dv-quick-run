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

## 🆕 What's New in v0.7.1

* **Guided Traversal (Find Path to Table)**
  - Discover relationship paths between Dataverse tables directly from VS Code
  - Supports multi-hop traversal with variant (route) selection
  - Introduces itinerary concepts:
    - **Compact** (nested expand / join-like execution)
    - **Mixed** (step-by-step continuation)
  - Provides structured, step-by-step execution output

* **Traversal Continuation (Multi-leg workflow)**
  - Continue across relationships using **Continue Traversal**
  - Step-based execution model:
    - `Step X/Y` progression
    - clear landing context at each hop
  - Row-driven continuation:
    - traversal proceeds from selected/landed records
  - Traversal session state maintained across steps

* **Traversal-aware Result Viewer**
  - Row-level action:
    - **Continue to {Entity}**
  - Contextual actions only shown when traversal is active
  - Clean transition between steps with automatic state management

* **Execution Strategies (Itinerary-based)**
  - Multiple execution approaches depending on scenario:
    - step-based traversal (sampling-safe)
    - nested expand (context-preserving)
  - Compact itinerary uses nested expand for multi-hop joins
  - Mixed itinerary uses controlled step traversal

* **Proven Route Detection (in-session)**
  - Tracks successful traversal paths during your session
  - Highlights known-good routes in the picker:
    - ⭐ Proven routes
  - Enables faster reuse of working relationship paths

* **Clear Traversal Outcomes**
  - Explicit results after each step:
    - landed entity
    - row counts
    - next step availability
  - Clear distinction between:
    - successful traversal with data
    - successful traversal with no results

* **Configuration Migration Loader**
  - Automatically injects new settings for existing users
  - Ensures new features are available without manual config updates
  - Non-destructive (only applies when settings are missing)

---

### ✨ New Workflow: Traverse Relationships

You can now move across Dataverse tables step-by-step:
  contact → careplan → careplanactivity → task

Workflow:

1. Run **Find Path to Table**
2. Select a route (variant)
3. Execute step 1
4. Continue using **Continue to {Entity}**
5. Repeat until target is reached

This enables a **multi-leg query workflow** directly inside VS Code — no need to manually construct complex `$expand` queries.

---

### 🧠 Notes

* Step-based traversal may return empty results when intermediate sampling does not preserve relationship continuity
* Compact (nested expand) itinerary provides better results for **dependent multi-hop relationships**
* Proven routes are currently **session-based (in-memory)**
* Future releases will introduce:
  - adaptive execution strategy
  - persisted traversal history
  - shareable traversal keys

### ⚙️ Traversal Configuration (Optional Tuning)

Traversal uses metadata to discover possible relationship paths between tables.  
In large environments, this can result in many irrelevant or noisy paths.

You can improve traversal quality and performance using:

#### `dvQuickRun.traversal.allowedTables`

Limit traversal to specific tables:

```json
{
  "dvQuickRun.traversal.allowedTables": [
    "contact",
    "account",
    "*careplan*",
    "*invoice*"
  ]
}
```

Useful when:
- working within a specific domain (e.g. healthcare, finance)
- you want faster and more relevant path suggestions
- You can also use `*` wildcards in traversal scope settings.

---

#### `dvQuickRun.traversal.excludedTables`

Exclude noisy or irrelevant tables:

```json
{
  "dvQuickRun.traversal.excludedTables": [
    "systemuser*",
    "team*",
    "businessunit",
    "*audit*"
  ]
}
```

Useful when:
- system tables dominate traversal results
- you want to avoid generic ownership or audit relationships

---

### 💡 Recommendation

Start with defaults.

If traversal feels:
- too slow → use **allowedTables**
- too noisy → use **excludedTables**

In complex environments, tuning these settings can significantly improve:
- path relevance
- traversal performance
- overall usability


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
