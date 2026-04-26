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

## 🆕 What's New in v0.9.5 (Result Viewer Polish, Safe Mutation UX & Interaction Consistency)

> Refines the **Result Viewer experience and mutation workflow**, focusing on correctness, performance, and interaction clarity — making DV Quick Run safer and more intuitive for real-world data operations.

---

### 📊 Result Viewer Interaction Refinement

- Improved **filter and slice behaviour consistency**
  - enforcing **single-condition-per-field** (non-date fields)
  - applying a new filter replaces the previous one
  - prevents:
    - duplicate conditions
    - conflicting `null` / `not null` filters
    - broken query states

👉 Results in:
- predictable refinement behaviour  
- cleaner query output  
- reduced user confusion  

---

### 🧩 Null Handling (UX + Safety)

- Introduced consistent null rendering:
  - `∅` used as visual indicator
  - tooltip clarifies value as `null`

- Safeguards:
  - copy actions return actual `null` (not `∅`)
  - prevents accidental PATCH of incorrect values

- Action behaviour:
  - null filtering correctly maps to:
    - `eq null`
    - `ne null`

👉 Results in:
- clearer data interpretation  
- safer mutation workflows  
- improved usability in real datasets  

---

### ✏️ PATCH UX Improvements (Boolean & Choice Fields)

- Replaced free-text PATCH input with **metadata-aware QuickPick**

- Behaviour:
  - Boolean → `true / false` selection
  - Choice / OptionSet → label + value selection (e.g. `Married (2)`)

- Payload:
  - always uses correct Dataverse value type

👉 Prevents:
- invalid PATCH payloads  
- string-to-int conversion errors  
- failed API requests  

---

### 🚫 Expanded Field Mutation Guardrails

- Prevented PATCH operations on expanded / related fields

- Behaviour:
  - disabled action:
    - **“Update expanded field unavailable”**
  - clear explanation provided

👉 Ensures:
- correct mutation boundaries  
- avoids updating the wrong entity  
- improves user understanding of data scope  

---

### 📦 Copy Actions (Optimised & Clarified)

- Added:
  - Copy display value  
  - Copy raw value  
  - Copy row JSON  

- Optimisation:
  - **Copy row JSON only available on primary key column**
  - avoids per-cell duplication and unnecessary overhead

- Behaviour:
  - row JSON generated **on-demand only** (lazy)

👉 Results in:
- improved performance  
- reduced memory usage  
- clearer action intent  

---

### ⚡ Result Viewer Performance Improvements

- Removed eager row JSON generation
- Reduced per-cell action payload size
- Deferred heavy operations to interaction time

👉 Results in:
- faster table rendering  
- smoother interaction  
- better performance on large datasets  

---

### 🔍 Result Viewer Action Fixes

- Fixed **Filter by this value** action:
  - now correctly applies filter
  - no longer silently fails

- Improved behaviour for:
  - null filtering
  - repeated action application
  - deduplication of conditions

👉 Results in:
- reliable data-driven refinement  
- consistent action outcomes  

---

### 🧠 Interaction Model Alignment

- Reinforced **Result Viewer as command surface**
  - actions behave consistently across:
    - filter
    - slice
    - patch
    - copy

- Improved alignment with:
  - preview-first mutation model
  - Insight Model execution flow

👉 Results in:
- predictable workflows  
- stronger mental model for users  
- cleaner interaction patterns  

---

### 🧪 Stability

- Verified:
  - filter/slice replacement logic
  - null handling behaviour
  - PATCH QuickPick workflows
  - expanded field guardrails
  - Result Viewer action consistency
  - performance improvements

- No regression in:
  - Smart PATCH workflow
  - Guided Traversal
  - Query Doctor
  - `$batch` execution
  - preview-first mutation pipeline

---

## 🧭 Notes

This release focuses on **polish, correctness, and safety**:

- strengthens Result Viewer as a **primary interaction surface**
- improves reliability of **data-driven query refinement**
- ensures PATCH workflows are **safe and type-correct**
- reinforces DV Quick Run as a **trusted Dataverse workbench**

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
