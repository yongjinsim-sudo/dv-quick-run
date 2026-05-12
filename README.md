# DV Quick Run

A fast, metadata-aware Dataverse query and operational investigation workbench for VS Code.

**Run, understand, explore, refine, safely update, and investigate Dataverse behaviour — with Query-by-Canvas, Guided Traversal, `$batch`, Smart PATCH, Execution Insights, Operational Profiles, and the DV Quick Run Hub — without leaving your editor.**

---

## 🚀 What is DV Quick Run?

DV Quick Run turns VS Code into a focused **Dataverse developer and investigation console**.

Instead of switching between Postman, browser tabs, maker portals, Excel, and manual metadata lookups, you can:

* run OData and FetchXML queries
* inspect results in a table or JSON view
* refine queries safely using preview-first workflows
* update records using Smart PATCH
* traverse Dataverse relationships step-by-step
* run related queries as `$batch`
* investigate runtime behaviour with Execution Insights
* understand entity operational footprint with Operational Profiles
* use the Hub to stay oriented across investigation workflows

DV Quick Run is designed around a simple loop:

```text
write → run → explore → refine → investigate → act safely → verify
```

---

## ⚡ Quick Start

1. Install **DV Quick Run**
2. Login:

   ```bash
   az login --allow-no-subscriptions
   ```

3. Configure your Dataverse environment
4. Run a query:

   ```http
   contacts?$top=10
   ```

5. Open the Hub any time:

   ```text
   DV Quick Run: Open Hub
   ```

---

## 🆕 What's New in v0.9.17

v0.9.17 introduces the **DV Quick Run Hub** and improves investigation continuity across Result Viewer, `$batch`, FetchXML, Guided Traversal, Execution Insights, and Operational Profiles.

Highlights:

* **DV Quick Run Hub** for in-app operational workflow orientation
* active / recoverable / historical / stale investigation context awareness
* Result Viewer recovery for closed but recoverable investigations
* environment-aware context reset to avoid stale cross-environment recovery
* selected `$batch` sub-result context tracking
* improved FetchXML context classification in the Hub
* Quickstart updates for Hub discovery

The Hub is intentionally:

* lightweight
* local
* renderer-thin
* non-chatbot
* non-dashboard
* optional during investigation

It helps answer:

```text
Where am I?
What context is active?
What can I continue?
What should I reopen?
What changed when I switched environments?
```

---

## 🎬 Result Viewer

![DV Quick Run Result Viewer](docs/demo-result-viewer.gif)

The Result Viewer is the main interactive surface for exploring query results.

Typical workflow:

```text
start simple → run → explore → refine → update safely → refresh → repeat
```

---

## ✨ Key Features

### 🔎 Run & Explore Queries

* Run Dataverse OData and FetchXML directly in VS Code
* View results in an interactive table or JSON
* Sort, filter, inspect, copy, and act on data inline
* Use Ctrl+Enter to run the query under your cursor

---

### 🧭 DV Quick Run Hub

The Hub provides a calm orientation surface for operational investigation workflows.

It helps you:

* understand current investigation context
* see whether a Result Viewer context is active, recoverable, historical, or stale
* reopen recoverable Result Viewer sessions
* track selected `$batch` sub-results
* pivot to related investigation surfaces
* avoid stale context after environment switches

The Hub is optional. It does not take over the workflow; it helps you recover orientation when you need it.

---

### 🧩 Query-by-Canvas

Query-by-Canvas is DV Quick Run’s preview-first refinement model.

Start simple, then refine from results:

```text
contacts
→ add $top
→ add $select
→ filter by value
→ rerun
```

Supported refinement paths include:

* add fields
* filter by value
* preview query changes
* apply safely
* rerun and verify

---

### 🔗 Guided Traversal

Guided Traversal helps you navigate relationships across Dataverse tables.

Use it to:

* find paths between entities
* traverse using real returned rows
* continue exploration step-by-step
* understand relationship routes visually
* replay traversal flows as `$batch`

---

### 📦 `$batch` Workflows

Run multiple related queries together using `$batch`.

Useful for:

* validating several endpoints together
* investigating related tables in one execution
* replaying Guided Traversal routes
* comparing related results without manual switching

The Hub tracks selected `$batch` sub-results so investigation context stays aligned with the selected response.

---

### ✏️ Smart PATCH

Smart PATCH lets you update Dataverse records directly from the Result Viewer using a preview-first workflow.

It supports:

* previewing PATCH payloads before execution
* metadata-aware boolean and choice inputs
* automatic result refresh after update
* guardrails for expanded or unsafe update contexts

---

### 📊 Execution Insights

Understand what is happening **behind your Dataverse queries** without leaving VS Code.

DV Quick Run surfaces execution behaviour across plugins, async operations, workflows, and Power Automate-related context.

It can help identify:

* slow execution
* failed or waiting async operations
* repeated execution patterns
* nested plugin behaviour
* correlation/request-linked runtime evidence

![Primary Signal 1](docs/execution-insights-primary-1.png)

Execution Insights prioritises the strongest signal first, then keeps supporting evidence available for deeper investigation.

![Guided Investigation 1](docs/execution-insights-next-1.png)

---

### 🧭 Operational Profiles

Operational Profiles help you understand the **operational footprint** of a Dataverse entity before diving into deeper troubleshooting.

Profiles can surface:

* plugin orchestration density
* relationship complexity
* metadata footprint
* async participation
* Power Automate involvement
* workflow participation
* managed-state context

![Operational Profile](docs/entity-profile-card.png)

Operational Profiles are:

* entity-scoped
* user-triggered
* evidence-backed
* bounded
* advisory-only

They help identify good investigation starting points without implying speculative root cause.

---

### 🧠 Explain Query + Query Doctor

Use Explain and Query Doctor to understand and improve queries.

Supported workflows include:

* break down query structure
* understand filters, sorting, expands, and selected fields
* identify missing `$top` or `$select`
* preview suggested improvements
* apply safe refinements through preview-first workflows

---

### 🔍 Investigate Record

Investigate a record from a GUID or result context.

Useful for:

* primary keys
* surfaced business GUID fields
* record interpretation
* relationship exploration
* suggested follow-up queries

---

### 🧬 Metadata Intelligence

DV Quick Run uses Dataverse metadata to improve query building and investigation.

Features include:

* field metadata hover
* choice label resolution
* relationship awareness
* entity set resolution
* preview-first filter refinement

---

### 🌍 Environment Support

Work across configured Dataverse environments such as DEV, UAT, SIT, and PROD.

DV Quick Run supports:

* active environment selection
* environment-aware metadata caching
* safe environment switching
* investigation context reset on environment change

---

## 🛡 Guardrails

DV Quick Run favours explicit, preview-first, user-controlled workflows.

It detects or guards against risky situations such as:

* missing `$top`
* broad result analysis
* unsafe PATCH contexts
* unsupported expanded-field updates
* stale investigation context
* unavailable execution evidence
* cross-environment investigation leakage

---

## 👥 Who Is This For?

* Dataverse / Dynamics 365 developers
* Power Platform engineers
* Integration / API developers
* Support engineers investigating Dataverse execution behaviour
* Consultants working across complex Dataverse environments

---

## 💡 Why DV Quick Run?

Because the fastest Dataverse workflow is:

```text
write → run → explore → refine → investigate → verify
```

…without leaving your editor.

DV Quick Run is designed to reduce tool switching while keeping investigation workflows explicit, bounded, and trustworthy.

---

## 🔧 Development

```bash
npm install
npm run compile
```

Press **F5** to run the extension.

---

## 📜 License

MIT License
