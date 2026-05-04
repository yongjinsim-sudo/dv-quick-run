# Change Log

All notable changes to the **DV Quick Run** extension will be documented in this file.

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/).

---

## v0.9.10 — Execution Insights (AsyncOperation + Workflow) 

This release expands Execution Insights beyond plugin traces to include **async operations and workflows**, bringing clearer, more concrete visibility into backend execution behaviour.

It also focuses on **signal clarity, noise suppression, and visual consistency**, making insights faster to understand and act on.

---

### ⚡ AsyncOperation Insights (NEW)

- Introduced detection of **async operation signals** directly from Result Viewer

- Detects:
  - failed / cancelled async operations
  - waiting / suspended states
  - long-running executions
  - repeated executions (same request / cross-request)

- Surfaces:
  - execution duration
  - state + status labels
  - correlationId / requestId
  - related workflow context (when available)

👉 Results in:
- direct visibility into background processing issues
- faster identification of delays and failures
- no need to manually query `asyncoperations`

---

### 🔗 Workflow Context Integration (NEW)

- Async operations now surface **related workflow information**

- Provides:
  - workflow name
  - primary entity
  - activation state

👉 Enables:
- clearer understanding of what triggered execution
- better context for debugging background jobs

---

### 🧠 Improved Signal Interpretation (Major)

- Refined interpretation of execution signals:

- Differentiates:
  - repeated execution within a single request (normal retry / behaviour)
  - repeated execution across requests (potential pattern)

- Suppresses:
  - low-signal “normal” cases (e.g. completed + successful)
  - background noise from healthy executions

👉 Results in:
- higher signal-to-noise ratio
- avoids alarming users unnecessarily
- insights feel intentional and trustworthy

---

### 🧾 Insight Card UX Refinement (Major)

- Improved card structure for faster scanning:

Each insight now emphasises:
- **clear title (what happened)**
- **what’s happening (evidence)**
- **impact (why it matters)**

- Improved readability:
  - simplified wording
  - reduced verbosity
  - better alignment with real debugging language

👉 Results in:
- faster comprehension (2–3 second scan)
- clearer decision-making
- more practical debugging experience

---

### 🧩 Identifier Grouping & Actions (NEW)

- Introduced **grouped identifier display**:
  - e.g. `AsyncOperationId (3)`
  - shows multiple related IDs compactly

- Added actions:
  - **Copy** (all identifiers)
  - **Query** (follow-up investigation)

- Layout improvements:
  - identifiers displayed first
  - actions placed consistently below
  - avoids wrapping and visual clutter

👉 Results in:
- cleaner presentation of multi-record insights
- easier follow-up investigation
- consistent interaction model

---

### 🧪 Stability & Behaviour

- Verified:
  - asyncoperation queries (direct + derived)
  - workflow-linked executions
  - failed / slow / repeated scenarios
  - large datasets and mixed result sets

- Ensures:
  - no regression to Result Viewer performance
  - insights remain bounded and safe
  - graceful behaviour under low-signal conditions

- No regression in:
  - Query Doctor
  - Guided Traversal
  - `$batch` execution
  - Result Viewer interactions
  - Smart PATCH workflows

---

## 🧭 Notes

This release extends Execution Insights from:

- **plugin-level diagnostics**

→ to:

- **end-to-end execution awareness (async + workflow)**

Key principles reinforced:
- concrete over abstract signals
- suppress noise, surface only meaningful insights
- fast comprehension over completeness
- consistent, predictable interaction model

---

## 🎯 Summary

DV Quick Run can now:

- detect async execution issues automatically
- surface workflow-backed context
- differentiate normal vs concerning behaviour
- present insights in a clean, actionable format

👉 Establishes the foundation for:
- insight prioritisation
- deeper execution intelligence

---

## v0.9.9 — Execution Insights, Raw Trace Access & Signal-Driven Diagnostics

This release introduces **Execution Insights**, bringing **runtime awareness directly into the Result Viewer**.

DV Quick Run now goes beyond query correctness — it can **detect, surface, and explain real execution issues** such as slow plugins, repeated executions, and nested chains.

This establishes the foundation for **execution-aware debugging and future intelligent diagnostics**.

---

### ⚡ Execution Insights (NEW)

- Introduced **Execution Insights** in the Result Viewer

- Enables detection of:
  - slow plugin execution
  - repeated plugin execution
  - nested execution depth
  - exception signals

- Works across:
  - direct `plugintracelogs` queries

👉 Results in:
- immediate visibility into backend execution behaviour
- early detection of performance and reliability issues
- no need to manually query `plugintracelogs`

---

### 🔗 Correlation-Based Trace Detection (NEW)

- DV Quick Run now captures:
  - `correlationId`
  - `requestId`

- Uses captured metadata to:
  - retrieve matching plugin trace logs
  - analyse execution signals automatically

- Behaviour:
  - bounded lookup (safe execution)
  - gracefully handles timeout scenarios

👉 Enables:
- execution insights from **any query**, not just trace queries
- foundation for cross-request diagnostics

---

### 🧠 Signal-Based Insight Engine (NEW)

- Introduced structured detection of execution signals:

Detected signals include:
- slow execution (duration-based)
- repeated execution patterns
- nested execution depth
- exception presence

- Signals are:
  - grouped by plugin
  - ranked by impact
  - converted into a single high-quality insight per plugin

👉 Results in:
- high-signal, low-noise insights
- avoids overwhelming users with raw trace spam
- prioritises actionable findings

---

### 🧾 Structured Insight Cards (Major)

- Refined insight presentation into clear sections:

Each insight now includes:
- **Detected**
- **Impact**
- **Recommended next steps**

- Improved readability:
  - shortened plugin names
  - structured bullet points
  - clearer separation of concerns

👉 Results in:
- faster comprehension
- clearer decision-making
- better alignment with real debugging workflows

---

### 🔍 Raw Trace Details (NEW)

- Added **“View raw trace details”** section per insight

- Provides:
  - trace summary list
  - expandable raw JSON payload
  - **Copy raw JSON** action

- Raw trace includes:
  - pluginTraceLogId
  - correlationId / requestId
  - duration
  - depth
  - messageName
  - entityName

👉 Ensures:
- no loss of low-level detail
- supports deep debugging scenarios
- balances abstraction with transparency

---

### 🧠 Insight Consolidation (NEW)

- Multiple trace signals are now:
  - grouped per plugin
  - merged into a single insight card

- Preserves:
  - strongest signals (e.g. slow + repeated)
  - raw trace evidence

👉 Results in:
- reduced noise
- clearer prioritisation
- avoids duplicate or fragmented insights

---

### ⏱️ Bounded Execution & Timeout Handling (Improved)

- Execution Insights now operate under:
  - strict time budget
  - bounded query scope

- Behaviour:
  - stops safely when timeout reached
  - surfaces clear messaging:
    - “lookup timed out”
    - “no signals found”

👉 Prevents:
- UI blocking
- long-running trace scans
- unstable behaviour on large datasets

---

### 🧪 Stability & Behaviour

- Verified:
  - plugintracelogs direct queries
  - correlation-based insight retrieval
  - large datasets (e.g. 5000 records)
  - timeout scenarios
  - raw trace rendering and copy

- Ensures:
  - no impact to Result Viewer performance
  - insights remain optional and controlled
  - graceful degradation under heavy load

- No regression in:
  - Query Doctor
  - Guided Traversal
  - `$batch` execution
  - Result Viewer interactions
  - Smart PATCH workflows

---

## 🧭 Notes

This release marks a major evolution:

DV Quick Run moves from:
- **query correctness and refinement**

→ to:
- **execution-aware diagnostics and insight-driven debugging**

Key principles:
- signal over noise
- bounded, safe execution
- insight-first, raw-data-available
- no hidden or automatic behaviour

---

## 🎯 Summary

DV Quick Run can now:

- detect backend execution issues automatically
- surface meaningful plugin-level insights
- provide actionable next steps
- expose full trace details when needed

👉 Establishes the foundation for:
- execution timeline reconstruction
- insight model export
- re-run and compare workflows
- MCP-driven debugging capabilities

---

## v0.9.8 — Fast-First Result Viewer & Safe Insight Execution (Stability Release)

This release focuses on **stability, responsiveness, and trust**, ensuring DV Quick Run remains reliable under **wide and large Dataverse queries**.

It introduces a **fast-first execution model** and refactors the insight system to be **safe, bounded, and user-triggered**, preventing extension host crashes and performance degradation.

---

### ⚡ Fast-First Result Viewer (Major)

- Enforced **fast-first rendering model**
  - Result Viewer now prioritises immediate display of results
  - Insight generation no longer blocks or delays rendering

- Eliminated crash scenarios caused by:
  - wide entities (e.g. `contacts`)
  - large payloads without `$select`
  - heavy result-driven analysis during initial load

👉 Results in:
- consistent responsiveness
- no extension host crashes under broad queries
- predictable performance in enterprise environments

---

### 🛡️ Safe Mode for Broad Queries (NEW)

- Introduced **Safe Mode** for potentially unsafe queries

Triggered when:
- no `$select` present
- wide payload detected
- large result sets returned

- Behaviour:
  - Result Viewer opens immediately
  - result-driven insights are **paused**
  - user is prompted to run insights manually

- Messaging:
  - clearly communicates system behaviour
  - explains performance protection

👉 Ensures:
- broad queries are handled safely
- users understand why insights are limited
- system feels intentional, not broken

---

### 🧠 Deferred Insights (NEW)

- Result-driven insights are now **user-triggered**

- Introduced:
  - **Get Insights** action in Insight Drawer

- Behaviour:
  - insights run only when explicitly requested
  - initial query execution remains fast

👉 Establishes:
- explicit control over analysis
- separation between data retrieval and intelligence

---

### 🔍 Sample-Based Insight Analysis (NEW)

- Insights now operate on a **bounded sample of the current result page**

- Default limits:
  - max 20 rows
  - max 40 columns

- Preserves:
  - formatted values (e.g. Choice labels)
  - field relationships within sampled rows

- Messaging includes:
  - sample size
  - total result context

👉 Results in:
- fast insight generation
- representative (but safe) analysis
- no full-table scanning

---

### ⏱️ Insight Execution Budget (NEW)

- Introduced **soft execution budget for insights**

- Guards:
  - time budget (~2.5s soft limit)
  - row/column sampling limits

- Behaviour:
  - insights stop early if budget exceeded
  - partial results returned safely

👉 Prevents:
- runaway computations
- UI freezes
- performance degradation

---

### 🧩 Insight Execution Context (Foundation)

- Introduced central **Insight Execution Context**

- Provides:
  - shared time budget
  - sampling limits
  - execution tracking

- Enforces:
  - all result-based insights operate within safe bounds

---

### 🧪 Stability & Guardrails

- Added safeguards for:
  - wide dataset handling
  - sampled insight correctness
  - formatted value preservation
  - partial insight scenarios

- Introduced fail-safe behaviour:
  - insight failures degrade gracefully
  - Result Viewer never crashes due to insights

- Verified:
  - large datasets
  - wide schemas
  - repeated insight triggering
  - interaction stability under stress

- No regression in:
  - Result Viewer rendering
  - Query Doctor
  - Guided Traversal
  - `$batch` execution
  - Smart PATCH workflows

---

## 🧭 Notes

This is a **stability and trust-focused release**.

Key architectural shift:

- Insights move from:
  - **implicit + eager**
→ to:
  - **explicit + bounded + safe**

Core principles reinforced:
- fast-first execution
- user-controlled intelligence
- safe handling of enterprise-scale data
- graceful degradation over failure

---

## 🎯 Summary

This release ensures DV Quick Run:

- remains **fast under all query conditions**
- avoids crashes from wide or large datasets
- provides insights **only when needed**
- establishes a **safe foundation for future intelligence features**

👉 Prepares the platform for:
- deeper result analysis

— without compromising performance or stability

---

## v0.9.7 — Insight Drawer, Multi-Insight Query Doctor & Command Surface Foundation

This release introduces the first **result-aware insight system inside the Result Viewer**, evolving DV Quick Run from a query tool into a **guided, insight-driven Dataverse workbench**.

It focuses on:
- surfacing **multiple, evidence-based insights from Query Doctor**
- introducing a **dedicated Insight Drawer with actionable recommendations**
- establishing **Pro vs Free capability boundaries**
- reinforcing the Result Viewer as a **command surface for intelligent workflows**

---

### 💡 Insight Drawer (NEW)

- Introduced **Insight Drawer**
  - Accessible via lightbulb / Insights button
  - Displays **context-aware recommendations** for the current result

- Each insight includes:
  - recommendation text
  - reasoning (when available)
  - source (Query Doctor / Binder)
  - confidence level
  - optional action (Apply for Pro)

- Clear capability boundary:
  - **Free** → “Suggestion only”
  - **Pro** → “Actionable insight” with Apply

👉 Establishes:
- a dedicated surface for understanding and acting on insights
- a clean separation between explanation and execution

---

### 🧠 Multi-Insight Query Doctor (Major)

- Result Viewer now supports **multiple concurrent insights**

Examples:
- missing `$top`
- missing `$select`
- result-driven suggestions:
  - e.g. `statecode = Active` when distribution is uneven

- Insights are:
  - **deduplicated**
  - **ranked**
  - **rotatable via navigation**

👉 Results in:
- richer, result-aware guidance
- more realistic “next best action” workflows

---

### 🔄 Insight Navigation & Rotation

- Added manual navigation:

`[‹] Insight X of Y [›]`


- Behaviour:
- no auto-rotation (avoids noise)
- user-controlled exploration
- Binder still surfaces the **primary recommendation**

👉 Ensures:
- clarity over automation
- predictable interaction model

---

### ⏱️ Insight Snoozing (NEW)

- Applied insights are **temporarily snoozed (60s)**

Behaviour:
- Apply → insight disappears temporarily
- next eligible insight is shown
- prevents stale or repetitive suggestions

👉 Solves:
- stale Result Viewer vs editor state mismatch
- repeated “add $top” or similar guidance

---

### ⚡ Actionable Insights (Pro)

- Insights can now expose **Apply action**

- Behaviour:
- uses existing **preview-first Binder execution path**
- no direct mutation
- respects safe execution model

- After Apply:
- insight is snoozed
- drawer updates to next suggestion
- maintains preview-first invariant

👉 Establishes:
- execution from insight surface
- without breaking safety guarantees

---

### 🧩 Result Viewer → Command Surface (Expanded)

- Further reinforces Result Viewer as:
- analysis surface
- action surface
- refinement surface

- Insights now integrate with:
- Binder suggestions
- Query Doctor outputs
- preview-first mutation pipeline

👉 Moves DV Quick Run toward:
```
Query → Result → Insight → Action → Refine
```

---

### 🖱️ Context Menu Control (Foundation)

- Suppressed default browser context menu across:
  - table area
  - toolbar area
  - blank/result areas
  - Insight Drawer

- Preserved for:
  - input / textarea / editable fields

👉 Establishes foundation for:
- table-driven actions
- right-click command surface
- future slice-and-dice workflows

---

### 🧭 Traversal UX Fix

- Removed hardcoded schema reference:
  - ❌ “Tighten with chosen contactid”
  - ✅ replaced with schema-neutral wording

👉 Ensures:
- traversal UI remains metadata-driven
- no entity-specific leakage into UI

---

### 🧪 Guardrails & Stability

- Added guardrails for:
  - multi-insight rendering
  - snoozed insight behaviour
  - `$top` duplication prevention
  - preview-first Apply invariants
  - context menu suppression boundaries

- Verified:
  - Insight Drawer lifecycle
  - Free vs Pro behaviour
  - multi-insight navigation
  - Apply → snooze → next insight flow

- No regression in:
  - Result Viewer rendering
  - Guided Traversal
  - Query Doctor
  - `$batch` execution
  - Smart PATCH workflows

---

## 🧭 Notes

This release marks a major evolution:

- DV Quick Run moves from:
  - **query + result tool**
→ to:
  - **insight-driven workflow assistant**

Key principles reinforced:
- insight-first guidance
- preview-first execution
- result-aware reasoning
- minimal, high-confidence recommendations

---

## 🎯 Summary

This is the first version where DV Quick Run begins to:

- understand results
- suggest meaningful next steps
- allow controlled execution from those insights

👉 Establishes the foundation for:
- deeper Query Doctor intelligence
- slice-and-dice result analysis
- fully interactive data workflows

--

## v0.9.6 — Enterprise Stability: Large Dataset Handling & Result Viewer Reliability

This release focuses on **stability, predictability, and correctness under large datasets**, making DV Quick Run suitable for **real-world enterprise usage**.

It is not a feature-heavy release — instead, it hardens the **Result Viewer architecture**, fixes critical edge cases, and ensures consistent behaviour across large and complex result sets.

---

### 📊 Large Dataset Handling (Major)

- Introduced **session-backed Result Viewer model**
  - Full dataset stored once per execution
  - UI renders only a **controlled window** (default 100 rows)

- Added **row window controls**
  - Users can choose:
    - 100 / 200 / 500 / 1000 rows
  - Dynamic options based on dataset size
  - Prevents unsafe rendering of excessively large windows

- Enforced **safe rendering cap**
  - Recommended maximum: **1000 rows per window**

👉 Results in:
- stable rendering even for 5000+ row datasets
- predictable performance across environments

---

### 🔍 Full Dataset Search (Correctness Fix)

- Reworked search to operate on **entire dataset (not current page)**

- Behaviour:
  - search scans full result set
  - result count reflects **true matches across dataset**
  - UI shows:
    - “X matching rows across Y total rows”

- Fixed issues:
  - missing matches on non-visible pages
  - incorrect match counts due to paging
  - inconsistent search behaviour

👉 Results in:
- trustworthy search
- correct data discovery across large datasets

---

### 📄 Pagination & Navigation Improvements

- Added **sub-page navigation**
  - `[<] [>]` to move across row windows

- Smart visibility:
  - hidden when:
    - total rows < page size
    - single-page datasets

- Improved row indicators:
  - `Rows X–Y of Z`
  - reflects current window accurately

👉 Results in:
- clearer navigation
- reduced UI noise for small datasets

---

### ⚡ Progressive Rendering & Stability

- Improved **progressive rendering behaviour**
  - incremental row rendering for smoother UX

- Fixed rendering issues:
  - blank screen on execution
  - stuck “Loading rows...” state for large windows
  - inconsistent render completion

- Improved resilience:
  - avoids UI lockups under heavy datasets
  - ensures viewer always reaches a stable state

👉 Results in:
- reliable rendering lifecycle
- no more “dead” viewer states

---

### 📊 UX Clarity & Feedback

- Improved large dataset messaging:
  - performance warnings for large row windows
  - clearer “shown vs total” indicators

- Added:
  - render progress messaging (for large windows)
  - better loading state feedback

- Removed misleading states:
  - loading with no feedback
  - partial rendering without explanation

👉 Results in:
- better user trust
- clearer system behaviour under load

---

### 🧠 Architecture (Key Upgrade)

- Introduced **session as source of truth for Result Viewer**
  - decouples:
    - data retrieval
    - rendering
    - interaction (search, paging)

- Eliminated:
  - re-computation per page
  - inconsistent state between UI and dataset

👉 Establishes foundation for:
- future result analysis features
- slice-and-dice workflows
- Query Doctor improvements

---

### 🧪 Stability

- Verified:
  - large datasets (1000–5000 rows)
  - wide schemas (many columns)
  - search across full dataset
  - paging + navigation behaviour
  - progressive rendering lifecycle

- No regression in:
  - Smart PATCH workflow
  - Result Viewer actions
  - Guided Traversal
  - Query Doctor
  - `$batch` execution

---

## 🧭 Notes

This release marks an important shift:

- Result Viewer evolves from:
  - **UI rendering layer**
→ to:
  - **session-backed data interaction layer**

Key principles reinforced:
- predictable behaviour under load
- correctness over convenience
- clear system feedback
- safe defaults for enterprise datasets

---

This release is primarily aimed at:
- **enterprise environments**
- **large Dataverse tables**
- **real-world production usage**

---

## v0.9.5 — Smart PATCH, Result Viewer Refinement & Workflow Completion

This release completes the **end-to-end query → refine → PATCH → refresh workflow**, establishing DV Quick Run as a **true interactive Dataverse workbench**.

It focuses on:
- introducing **Smart PATCH (preview-first, safe mutation)**
- refining **Result Viewer as a command surface**
- stabilising **PATCH → Result Viewer refresh loop**
- tightening **UX consistency, guardrails, and interaction behaviour**

---

### ✏️ Smart PATCH (Preview → Apply → Refresh)

- Introduced **Smart PATCH workflow**
  - Update Dataverse records directly from Result Viewer interactions

- Full workflow:
  1. user triggers update (cell / row action)
  2. PATCH preview document opens
  3. confirmation dialog shown
  4. PATCH executed on confirmation
  5. Result Viewer refreshes using original query context

- Preview includes:
  - entity + record ID
  - PATCH path
  - payload (typed correctly)
  - HTTP representation
  - cURL example

- Supports:
  - **boolean fields (true/false QuickPick)**
  - **choice / OptionSet fields (label + value selection)**

👉 Results in:
- safe, transparent data mutation
- no malformed payloads (no free-text errors)
- consistent preview-first mutation behaviour

---

### 🧠 Typed PATCH Input (NEW)

- Replaced free-text PATCH input with **metadata-aware selection**

- Behaviour:
  - Boolean → QuickPick (true / false)
  - Choice → QuickPick (label + numeric value)
  - Prevents invalid payload formats

👉 Eliminates:
- incorrect string payloads (e.g. `"e"`)
- Dataverse 400 errors due to type mismatch

---

### 🔁 PATCH → Result Viewer Refresh (Stabilised)

- Result Viewer now refreshes **automatically after PATCH**

- Behaviour:
  - uses **Insight Model (original query context)**
  - re-runs query to reflect updated data

- Improved resilience:
  - refresh failures → **warning (non-blocking)**
  - PATCH success not lost due to UI issues

👉 Ensures:
- reliable edit → verify loop
- consistent post-update visibility

---

### 🧠 Insight Model as Source of Truth

- Enforced architectural invariant:

> Insight Model is the **single source of truth** for:
- query execution
- PATCH context
- Result Viewer refresh
- rerun actions

- Removed reliance on:
  - editor reconstruction
  - ad-hoc query rebuilding

👉 Results in:
- consistent workflow behaviour
- strong foundation for future features

---

### 📊 Result Viewer UX Refinement (Major)

#### Null Handling Improvements

- Null values now rendered as:
  - `∅` (visual indicator)
  - tooltip: **"Null value"**

- Behaviour safeguards:
  - copy actions → return `null` (not `∅`)
  - prevents accidental PATCH corruption

#### Filter / Slice Consistency Fix

- Enforced **single-condition-per-column rule (non-date fields)**

- Behaviour:
  - applying new filter/slice replaces existing condition for same field
  - prevents:
    - duplicate `eq null`
    - conflicting `eq null` + `ne null`

👉 Fixes:
- broken query states
- invalid logical combinations

---

### 🔍 Result Viewer Actions (Improved)

- **Filter by this value**
  - now fully wired and functional
  - supports null values correctly (`eq null`)

- **Slice behaviour refinement**
  - `is null` / `is not null` now mutually exclusive
  - behaves predictably across repeated actions

- **Column header actions**
  - moved sorting + filter actions to header-level where appropriate

---

### 📦 Copy Actions (Optimised)

- Added:
  - Copy display value
  - Copy raw value
  - Copy row JSON

- Performance optimisation:
  - **row JSON no longer precomputed for all rows**
  - generated **on-demand only**

- UX refinement:
  - **Copy row JSON only available on primary key column**

👉 Results in:
- faster table rendering
- reduced memory overhead
- cleaner action surface

---

### ⚡ Result Viewer Performance Improvements

- Removed eager row JSON construction
- Reduced per-cell payload overhead
- Deferred heavy operations to interaction time

👉 Results in:
- faster initial render
- smoother scrolling
- improved responsiveness on large datasets

---

### 🧩 Expand Field Guardrails

- Prevented invalid PATCH on expanded fields

- Behaviour:
  - expanded fields show:
    - **“Update expanded field unavailable”**
  - avoids invalid mutation paths

👉 Ensures:
- safe mutation boundaries
- clearer UX expectations

---

### 📊 Result Viewer Workflow Completion

DV Quick Run now supports full loop:
```
Query → Result → Refine → PATCH → Refresh → Continue
```

- Result Viewer acts as:
  - command surface
  - mutation entry point
  - verification layer

👉 Establishes:
- full interactive Dataverse workflow inside VS Code
- reduced need for external tools

---

### 🧾 Logging & UX Improvements

- Improved execution logs:
  - clearer success/failure states
  - reduced noise
  - consistent formatting

- Error handling:
  - PATCH failures → clear diagnostic output
  - refresh failures → warning only

👉 Results in:
- better clarity
- improved trust in system behaviour

---

### 🧪 Stability

- Verified:
  - Smart PATCH (boolean + choice)
  - PATCH preview → apply flow
  - Result Viewer refresh via Insight Model
  - filter/slice deduplication logic
  - null handling + copy safety
  - performance improvements (row JSON deferral)

- No regression in:
  - Guided Traversal
  - Query Doctor
  - Result Viewer interactions
  - `$batch` execution
  - preview-first mutation pipeline

---

## 🧭 Notes

This release marks a major milestone:

Key principles reinforced:
- preview-first safety
- metadata-aware mutation
- insight-driven execution
- result-driven refinement

--

## v0.9.4 — Smart PATCH, Insight Model Alignment & Workflow Completion

This release completes the **end-to-end query → refine → PATCH → refresh workflow**, establishing DV Quick Run as a **true interactive Dataverse workbench**.

It focuses on:
- introducing **Smart PATCH (preview-first, safe mutation)**
- aligning all post-execution behaviour with the **Insight Model as source of truth**
- stabilising **PATCH → Result Viewer refresh loop**
- tightening UX, logging, and interaction consistency

---

### ✏️ Smart PATCH (Preview → Apply → Refresh)

- Introduced **Smart PATCH workflow**
  - Update Dataverse records directly from Result Viewer interactions

- Full workflow:
  1. user triggers update (e.g. from cell)
  2. PATCH preview document opens
  3. confirmation dialog shown
  4. PATCH executed on confirmation
  5. Result Viewer refreshes using original query context

- Preview includes:
  - entity + record ID
  - PATCH path
  - payload
  - HTTP representation
  - cURL example

👉 Results in:
- safe, transparent data mutation
- no hidden updates
- consistent preview-first behaviour across DV Quick Run

---

### 🔁 PATCH → Result Viewer Refresh (Stabilised)

- Result Viewer now refreshes **automatically after PATCH**

- Behaviour:
  - uses **original query context**
  - re-runs query to reflect latest data

- Improved resilience:
  - refresh failures do **not break workflow**
  - surfaced as warning instead of hard error

👉 Ensures:
- consistent feedback loop
- reliable post-update visibility
- smoother edit → verify experience

---

### 🧠 Insight Model as Source of Truth

- Introduced architectural invariant:

> Insight Model is the **single source of truth** for:
- query execution
- PATCH context
- Result Viewer refresh
- rerun actions

- Removed reliance on:
  - editor text reconstruction
  - ad-hoc query rebuilding

👉 Results in:
- consistent behaviour across workflows
- stronger foundation for future features

---

### 📊 Result Viewer Workflow Completion

- DV Quick Run now supports full loop:
  ```
  Query → Result → Refine → PATCH → Refresh → Continue
  ```

- Result Viewer continues to act as:
  - **command surface**
  - **mutation entry point**
  - **verification surface**

👉 Establishes:
- a complete, iterative data workflow
- reduced need to leave VS Code for updates

---

### 🧾 Logging & UX Improvements

- Improved execution logs:
  - clearer success states
  - reduced noise
  - consistent formatting

- Error handling improvements:
- PATCH failures → clear error messaging
- refresh failures → warning (non-blocking)

👉 Results in:
- better developer clarity
- less confusion during workflows
- improved trust in execution

---

### 🧪 Stability

- Verified:
- PATCH preview → apply flow
- Result Viewer refresh using Insight Model
- query path correctness across environments
- error handling for failed refresh scenarios

- No regression in:
- Guided Traversal
- Result Viewer interactions
- Query Doctor
- `$batch` execution
- preview-first mutation pipeline

---

## 🧭 Notes

This release marks a major milestone:

- DV Quick Run evolves from:
- **query tool**
→ to:
- **interactive Dataverse workflow environment**

Key principles reinforced:
- preview-first safety
- insight-driven execution
- result-driven refinement
- consistent interaction loop

---

## v0.9.3 — Result Viewer Command Surface & Preview-First Refinement

This release completes the transition of the **Result Viewer into a primary interaction surface**, enabling **preview-first, context-aware query refinement directly from data**.

It focuses on:
- unifying **Result Viewer actions** into a consistent system
- strengthening **preview-first mutation workflows**
- improving **UX clarity through disabled states and guardrails**
- reinforcing a predictable **inspect → preview → apply loop**

---

### 📊 Result Viewer as Command Surface (Expanded)

- Result Viewer now acts as the **primary query interaction surface**
  - users can refine queries directly from returned data
  - reduces reliance on manual query editing

- Supported interactions:
  - add `$select` from column
  - filter by value
  - order by column
  - investigate records

👉 Results in:
- tighter feedback loop between data and query
- more intuitive refinement workflow
- reduced cognitive load when building queries

---

### ✨ Add to `$select` from Column (NEW)

- Added **“Add this column to $select”** action
  - available from column/cell context menu

- Behaviour:
  - detects correct scope:
    - root query
    - `$expand`
    - nested `$expand`
  - updates `$select` accordingly

- Uses **preview-first workflow**:
  - generates preview query
  - allows confirmation before applying

👉 Results in:
- faster field selection
- safer query mutation
- consistent with Query-by-Canvas philosophy

---

### 👁️ Preview-First Mutation (Standardised)

- All Result Viewer actions now follow a **consistent preview-first pattern**

Workflow:
1. user triggers action
2. preview document opens
3. confirmation dialog shown
4. query updated only on explicit confirmation

- No silent mutations
- No hidden side effects

👉 Ensures:
- full user control
- predictable behaviour
- safe experimentation

---

### 🚫 Disabled Actions with Clear UX (NEW)

- Actions that are not valid are now:
  - visibly **disabled**
  - styled consistently across menus

- Examples:
  - `$orderby` on invalid scopes (e.g. single-valued expand)
  - unsupported mutation scenarios

- Disabled actions:
  - do not execute
  - do not trigger preview
  - communicate limitation clearly via UI

👉 Results in:
- reduced confusion
- better discoverability of supported operations
- stronger UX consistency

---

### ⚠️ Guardrail & Scope Validation Improvements

- Strengthened validation for query mutations:
  - prevents invalid `$orderby` usage
  - ensures correct scope application
  - avoids malformed queries

- Query mutation now:
  - respects entity boundaries
  - avoids incorrect nesting
  - merges safely with existing clauses

👉 Prevents:
- runtime Dataverse errors
- incorrect query generation
- unintended query side effects

---

### 🧠 Behaviour Improvements

- Result Viewer actions now:
  - use unified mutation pipeline
  - align with preview system
  - respect scope-awareness consistently

- Improved consistency across:
  - Result Viewer
  - editor mutations
  - preview pipeline
  - traversal outputs

- Cleaner interaction model:
  - no mixed behaviours between actions
  - no partial or silent updates

---

### 🧪 Stability

- All unit tests passing
- Verified:
  - `$select` mutation across scopes
  - preview → apply workflow
  - disabled action behaviour
  - Result Viewer interactions
- No regression in:
  - Guided Traversal
  - Graph rendering
  - `$batch` execution
  - Query Doctor

---

## 🧭 Notes

This release marks an important shift:

- Result Viewer evolves from:
  - **data display**
→ to:
  - **interactive query workspace**

DV Quick Run now:
- enables **data-driven query refinement**
- enforces **preview-first safety**
- provides **clear action boundaries via UI**

This establishes the foundation for:
- deeper Query-by-Canvas workflows
- result-aware Query Doctor actions
- richer table-driven analysis capabilities

---

## 🚀 v0.9.2 — Guided Traversal Graph, Context-Aware Query Mutation & Result Viewer Actions

This release expands **Guided Traversal** with a stronger **graph reasoning surface**, while also introducing **scope-aware query mutation** and enhancing the Result Viewer as an **interactive command surface**.

It focuses on:
- improving **visual traversal understanding**
- applying query changes in the **correct scope**
- enabling **data-driven refinement directly from results**
- improving **safety and guardrails** for OData operations

---

### 🧭 Guided Traversal Graph (Expanded)

- Significantly improved the **Guided Traversal Graph** experience
  - graph now acts as a clearer reasoning surface for route selection
  - focuses on **path-level understanding**, not full-schema noise

- Graph behaviour improvements:
  - highlights only the **selected traversal path**
  - dims non-selected nodes and edges to reduce confusion
  - prevents highlight leakage from unrelated visible routes
  - improves route focus consistency during graph interaction

- Search and filtering improvements:
  - graph search now filters to **searched paths**
  - selected route remains visually coherent after filtering
  - graph only keeps relevant route context instead of mixing unrelated paths

- Route selection UX improvements:
  - route chips remain the primary selection mechanism
  - selected route panel now better explains:
    - rank
    - hop count
    - confidence
    - warnings
    - route variants

- Confidence / variant presentation improvements:
  - route variants are grouped more clearly
  - confidence is surfaced in a more readable way
  - selected route remains the primary visual emphasis

👉 Results in:
- clearer route comparison
- stronger path reasoning
- less graph confusion
- better transition from visual selection → query action

---

### ✨ Context-Aware Query Mutators

- `$select`, `$filter`, and `$orderby` mutators are now **scope-aware**
  - Detects whether the cursor is inside:
    - root query
    - `$expand`
    - nested `$expand`
  - Applies mutations to the **correct entity scope**

- Example:
  - Right-click inside:
    ```
    $expand=owninguser(...)
    ```
  - `Add Select Fields` now updates:
    ```
    owninguser($select=...)
    ```
  - Instead of incorrectly modifying root `$select`

👉 Results in:
- correct query construction
- reduced manual fixes
- safer multi-entity queries

---

### 🔍 Scoped Filter 

- Added **scope-aware `$filter` mutation**
  - Filters can now be applied at:
    - root level
    - nested expand level

- Automatically:
  - detects correct scope
  - merges with existing filters using `and`

👉 Enables:
- precise filtering of expanded entities
- cleaner multi-entity query refinement

---

### 📊 Result Viewer → Filter by Value 

- Added **“Filter by this value”** action in Result Viewer
  - Available via kebab menu on cell values

- Supports:
  - OData → `$filter`
  - FetchXML → `<condition>`

- Workflow:
  - click value → preview filter → apply

👉 Results in:
- inspect → refine → rerun loop
- zero manual typing for common filters

---

### ↕️ Add Order By from Column Header 

- Right-click on **column headers** to add `$orderby`
  - Default:
    - ascending order

- Behaviour:
  - Applies only to **root-level fields**
  - Prevents invalid nested usage

👉 Results in:
- fast sorting from Result Viewer context
- improved discoverability of ordering

---

### ⚠️ Order By Guardrails 

- Added validation for `$orderby` usage inside `$expand`

- Behaviour:
  - ❌ blocks `$orderby` on **single-valued expands**
    - e.g. `owninguser`, `primarycontactid`
  - ⚠️ shows warning with guidance

👉 Prevents:
- invalid OData queries
- runtime API errors

---

### 🧠 Result Viewer Interaction Improvements

- Result Viewer evolves further into a **query command surface**
  - filter from values
  - order from headers
  - investigate records

- Improved UX:
  - consistent action naming:
    - “Filter by this value (OData)”
    - “Filter by this value (FetchXML)”
  - better action grouping under kebab menus

- Fixed:
  - header right-click positioning (z-index layering)
  - action menu visibility over table
  - suppression of default browser-style context menu on table headers

---

### 🧱 Behaviour Improvements

- Query mutation now:
  - respects entity scope
  - avoids overwriting unrelated clauses
  - merges intelligently with existing query options

- Graph rendering now:
  - keeps selected route visually intact
  - avoids misleading emphasis on unrelated nodes
  - better aligns with actual traversal reasoning

- Improved consistency between:
  - traversal graph
  - editor mutators
  - Result Viewer actions
  - preview pipeline

---

### 🧪 Stability

- Verified:
  - traversal graph rendering across route selections
  - searched-path graph filtering
  - scoped `$select`, `$filter` mutation
  - Result Viewer filter actions
  - header-based `$orderby`
  - guardrail behaviour

- No regression in:
  - Guided Traversal
  - `$batch` execution
  - Query Doctor
  - Result Viewer rendering

---

## 🧭 Notes

This release strengthens DV Quick Run in two major directions:

- **Guided Traversal** becomes a clearer **visual reasoning tool**
- **query mutation** becomes **context-aware and result-driven**

DV Quick Run now:
- helps users understand relationships more clearly through graph-assisted traversal
- understands **where** a change should be applied
- enables **data-driven refinement directly from results**
- prevents invalid query patterns through guardrails

---

## 🚀 v0.9.1 — Guided Traversal Graph & Result Viewer Stability

This release focuses on **visual traversal selection** and **webview stability fixes**, building on top of the Guided Traversal foundation introduced in v0.9.0.

It introduces a **graph-assisted reasoning surface** and resolves a critical **Result Viewer rendering issue** observed in newer VS Code environments.

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
  - highlights only the selected traversal route
  - avoids noisy system relationships
  - supports multi-hop paths (e.g. account → contact → team → task)

- Route selection UX:
  - route chips act as primary selectors
  - selecting a route updates:
    - graph view
    - selected route panel
  - variants displayed with confidence indicators

👉 Results in:
- clearer mental model of relationships
- faster route comparison
- reduced traversal guesswork

---

### ⚡ Graph → Traversal Execution (NEW)

- Added **Use this route** action in graph panel
- Selecting a route now:
  - triggers actual Guided Traversal execution
  - passes selected relationship chain to traversal engine
  - closes graph panel after selection

- Enables:
  - visual selection → immediate execution
  - seamless transition from reasoning → action

👉 Establishes graph as:
- a **decision surface**, not just visualization
- tightly integrated with traversal workflow

---

### 🧱 Result Viewer Stability Fix (Critical)

- Fixed **blank Result Viewer rendering issue**
  - caused by webview lifecycle changes in newer VS Code versions (1.116.0)

- Changes:
  - switched from panel reuse → **fresh webview panel creation**
  - ensured reliable HTML assignment and script execution
  - removed inconsistent render states

👉 Results in:
- consistent Result Viewer rendering
- no more intermittent blank screens
- improved reliability across environments

---

### 🧪 Stability

- Verified:
  - graph rendering across route selections
  - graph → traversal execution handoff
  - Result Viewer rendering across repeated runs
- No regression in:
  - Guided Traversal workflows
  - `$batch` execution
  - Binder suggestions
  - Query-by-Canvas interactions

---

## 🧭 Notes

This release extends Guided Traversal with a **visual reasoning layer**:

- traversal is no longer just step-based
- users can now:
  - see candidate routes
  - compare options visually
  - execute directly from selection

It establishes the foundation for:
- future graph-assisted traversal enhancements
- smarter route ranking and filtering
- deeper integration with Query Doctor and result insights

---

## 🚀 v0.9.0 — Guided Traversal, $batch Execution & Binder Suggestions

This release introduces **Guided Traversal**, **$batch execution workflows**, and a new **Binder suggestion system**, transforming DV Quick Run into a more complete **Dataverse query and workflow workbench**.

It focuses on:
- navigating relationships step-by-step
- executing multi-query workflows efficiently
- surfacing high-confidence next steps without adding noise

---

### 🧭 Guided Traversal (Renamed & Refined)

- Renamed **Find Path to Table** → **Guided Traversal**
- Improved discoverability:
  - available via Command Palette
  - available via editor right-click
- Simplified traversal output:
  - reduced noise and removed redundant metadata
  - clearer step-by-step progression
- Improved completion flow:
  - clearer indication when traversal is complete
  - better alignment with follow-up actions (e.g. $batch)

👉 Results in:
- faster understanding of relationships
- cleaner traversal experience
- more intuitive workflow progression

---

### ⚡ $batch Execution (NEW)

- Added support for running **multiple queries as `$batch`**
- Enables:
  - executing multiple queries in a single request
  - validating multiple endpoints together
  - more efficient query execution workflows

- Supports:
  - manual multi-query selection → run as `$batch`
  - traversal replay → run full traversal as `$batch`

- Result Viewer improvements:
  - displays per-query results
  - shows combined execution summary

👉 Establishes `$batch` as:
- both a **general execution tool**
- and a **natural continuation of Guided Traversal**

---

### 🧠 Binder Suggestions (NEW)

- Introduced **Binder** — a lightweight, context-aware suggestion system
- Surfaces **single, high-confidence recommendations** as a light-bulb hint

Examples:
- Continue traversal
- Run traversal as `$batch`
- Refine `$batch` execution
- Add `$top` / `$select` for broad queries

Key behaviour:
- only one suggestion shown at a time
- appears only when confidence is strong
- suggestion text is directly clickable
- suggestion is **consumed after click** (no stale hints)

👉 Results in:
- guided workflows without UI clutter
- faster iteration
- minimal, non-intrusive assistance

---

### 🧹 Traversal Denoising & UX Improvements

- Removed low-value output elements:
  - SQL-style mental notes
  - redundant relationship explanations
- Focused output on:
  - steps
  - entities
  - execution flow
- Improved readability of traversal logs and results

---

### ⚙️ Behaviour Improvements

- Binder now:
  - prioritises traversal and `$batch` workflows over generic suggestions
  - avoids suggesting `$top` when already present
  - handles no-active-editor scenarios safely
  - resolves queries using execution context instead of cursor position

- Improved consistency between:
  - traversal output
  - Result Viewer
  - Binder suggestions

---

### 🧪 Stability

- All unit tests passing
- Verified:
  - traversal workflows (start → continue → complete)
  - `$batch` execution (manual + traversal)
  - Binder suggestion lifecycle (show → click → consume)
- No regression in:
  - query execution
  - Result Viewer
  - Query-by-Canvas workflows

---

## 🧭 Notes

This release marks a shift from:

- **query execution tools**
→ **guided query + workflow execution experience**

It establishes the foundation for:
- smarter recommendation ranking
- deeper Query Doctor integration
- result-driven workflow suggestions

---

## 🚀 v0.8.5 — Explain UX Refinement & Actionable Execution Loop

This release focuses on **clarifying Explain output** and introducing a **tight action → preview → apply workflow**.

It transforms Query Doctor from **advisory-only** into a **directly actionable experience**, while keeping the interface minimal and noise-free.

---

### ✨ Explain Output Simplification

- Removed redundant phrasing:
  - eliminated `"Recommended next step:"` duplication
- Promoted **section title as the primary signal**
  - `### ⭐ Recommended next step` is now sufficient
- Tightened wording across:
  - actions
  - evidence
  - rationale

👉 Results in:
- cleaner scan
- faster comprehension
- stronger confidence in suggestions

---

### ⚡ Apply Preview (Pro)

- Introduced **`Apply preview` CodeLens inside Explain output**
- Appears directly within diagnostic sections:
  - Recommended next step
  - Advisory sections (e.g. `$select`, `$top`)

- Positioned:
  - **just above “Preview query”**
  - close to execution context (not header)

- Enables:
  - one-step transition from insight → execution
  - preview-first safe mutation workflow

---

### 🔓 Free vs Pro Behaviour

- **Free**
  - Shows:
    - Action
    - Evidence
    - Reasoning
    - Preview query
  - No execution shortcut

- **Pro**
  - Adds:
    - `Apply preview` inline action
  - Enables:
    - direct mutation workflow
    - faster iteration loop

👉 Maintains:
- full learning experience for free users
- execution acceleration for Pro users

---

### 🔁 Consistent Execution Pattern

- Standardised across Explain:
Action
Apply preview (Pro)
Preview query
Evidence


- Applied to:
- narrowing suggestions
- `$select` advisory
- `$top` advisory

👉 Establishes a consistent **Explain → Act → Iterate loop**

---

### 🧠 Query Doctor UX Evolution

- Shifts Query Doctor from:
- “analysis + suggestion”

- To:
- **analysis → recommendation → executable action**

- Aligns with:
- Query-by-Canvas principles
- preview-first mutation pipeline

---

### 🧹 UX Improvements

- Reduced visual clutter in Explain output
- Improved proximity between:
- suggestion
- execution action
- Removed unnecessary repetition and verbose phrasing

---

### 🧪 Stability

- All unit tests passing
- Verified:
- Explain rendering
- CodeLens injection
- Preview workflow integration
- No regression in:
- Run Query
- Investigate Record
- Query execution pipeline

---

## 🧭 Notes

This release marks the transition from:

- **advisory diagnostics**
→ **actionable diagnostics**

It lays the groundwork for:

- multi-option recommendations
- ranked suggestions
- deeper Query Doctor intelligence (v0.9+)

## 🚀 v0.8.4 — Intelligence Foundation Refactor (Stabilisation Release)

This release focuses on **internal architecture stabilisation** and **intelligence layer consolidation** across Investigate Record and Query Doctor.

No major UX changes, but this is a **foundational release** that enables deeper intelligence features moving forward.

---

### 🧠 Shared Intelligence Layer (NEW)

- Introduced shared primitives for:
  - identifier detection (e.g. `id`, `_id`, `fhirid`, etc.)
  - field semantics classification
  - candidate scoring and ranking
- Eliminates duplicated heuristics across:
  - Investigate Record
  - Query Doctor
- Establishes a reusable foundation for future intelligence features

---

### 🔍 Investigate Record — Decoupled from Traversal

- Investigate Record now operates independently from traversal
- Introduced dedicated configuration:
  - `dvQuickRun.investigate.searchScopeTables`
  - `dvQuickRun.investigate.maxSearchTables`
  - `dvQuickRun.investigate.maxSearchColumns`
- Default search scope now includes:
  - `account`
  - `contact`
- Removes reliance on traversal `allowedTables`

---

### ⚙️ Configurable Search Scope (NEW)

- Search scope is now:
  - explicit
  - bounded
  - user-configurable
- Improves transparency and avoids hidden behaviour limits

---

### 📊 Result Insight Pipeline (INTERNAL)

- Introduced structured pipeline:
  - Extract → Classify → Score → Rank → Suggest
- Enables:
  - better candidate prioritisation
  - cleaner extensibility for Query Doctor and Investigate
- Lays groundwork for future result-aware diagnostics

---

### 🧹 Logging & Output Cleanup

- Removed traversal-branded logging from Investigate flows
- Introduced concise investigate-specific logging:
[Investigate] Search scope applied: account, contact

- Eliminated noisy duplicate scope logs within a single run

---

### 🧱 Internal Refactor

- Reduced “God file” complexity across:
- Investigate Record
- Query Doctor (partial)
- Improved separation of concerns:
- detection vs scoring vs execution
- Prepared codebase for future modular rule expansion

---

### ⚡ Behaviour Improvements

- Improved weak-context identifier resolution (e.g. GUID pasted without entity context)
- Better handling of fields like:
- `msemr_azurefhirid`
- custom identifier-style columns
- More consistent ranking of candidate matches

---

### 🧪 Stability

- All unit tests passing
- No regression in:
- Query execution
- Explain
- Investigate Record flows
- Manual validation completed across common workflows

---

## 🧭 Notes

This is a **stabilisation and foundation release**.

The changes in v0.8.4 enable:
- deeper Query Doctor intelligence
- improved Investigate Record capabilities
- future result-aware diagnostics and suggestions

---

## [0.8.3] - Improved Investigate Record without Schema Context

### New

- 🔎 **Editor-first Investigate Record (GUID-only support)**
  - Investigate Record can now be triggered directly from a **selected GUID in the editor**
  - No Quick Pick or entity selection required
  - Enables fast workflow: copy GUID → run → resolve

- 🧠 **Context-aware identifier resolution**
  - Automatically resolves identifiers using:
    - Result Viewer context (when available)
    - Metadata-driven lookup across allowed tables (when no context)
  - Supports both:
    - standard primary IDs (e.g. `contactid`)
    - surfaced identifier-like fields

- ⚙️ **Bounded identifier search via `allowedTables`**
  - Resolution scope is limited to:
    - `dvQuickRun.traversal.allowedTables`
  - Prevents brute-force scanning in large environments
  - Keeps performance predictable and safe

- ⚡ **Investigate Record resolution accuracy**
  - Improved handling of primary ID fields using metadata instead of heuristics
  - Better support for non-obvious identifiers across entities

- 🧾 **Clear unresolved feedback**
  - When identifier cannot be resolved:
    - Displays searched scope
    - Avoids misleading or partial matches

---

## [0.8.2] — Result-Driven Query Doctor & Investigate Interpretation

### New

- Added **result-driven narrowing insights** to Query Doctor
  - Surfaces narrowing suggestions from **observed result patterns**
  - Supports:
    - repeated categorical values on the current page
    - meaningful null vs non-null splits
  - Keeps suggestions **page-aware** and scoped to the currently returned page
  - Continues to prioritise **business-meaningful fields** over low-signal technical fields

- Added **investigate support for surfaced business-like GUID columns** in the Result Viewer
  - Inline 🔎 investigate action now appears for eligible **non-primary-key GUID fields**
  - Supports surfaced business/reference-style fields such as:
    - address / related-record identifiers
    - other visible GUID columns that look like meaningful record references
  - Avoids promoting hidden lookup-backing noise such as `_..._value` columns

- Added **Interpretation** section to Investigate Record
  - Provides a fast heuristic meaning layer near the top of the investigation output
  - Highlights:
    - what the record likely represents
    - contextual cues when available
    - when a record may be easier to recognise by technical role or relationship than by display name

---

### Improved

- Improved **Query Doctor usefulness**
  - Moves from evidence-only pattern detection toward more readable **result-driven guidance**
  - Makes narrowing suggestions easier to notice and act on

- Improved **record investigation readability**
  - Investigation output now gives quicker “what am I looking at?” guidance
  - Helps make technical or system-linked records easier to understand at a glance

- Improved **Result Viewer actionability**
  - More surfaced GUID columns can now be investigated directly from the table
  - Maintains low-noise behaviour by avoiding obvious technical backing fields

---

### 🔧 Behaviour Changes

- Query Doctor now includes **result-driven narrowing hints** when current-page evidence is meaningful
- Investigate actions may now appear on **eligible surfaced non-PK GUID columns**, not just primary key columns
- Investigate Record output now includes an **INTERPRETATION** section before the detailed field summary

---

### 🧱 Architecture

- Introduced a lightweight **Result Insight Engine v1** inside the Query Doctor analysis flow
- Preserved separation between:
  - Query Doctor analysis
  - Result Viewer presentation
  - Investigate Record document generation

- Added a heuristic **interpretation builder** for investigation output
  - intentionally lightweight
  - advisory-only
  - non-authoritative

---

### 🧪 Testing

- Added coverage for:
  - result insight detection and rendering
  - surfaced business GUID investigate eligibility
  - investigation interpretation section generation

---

### ⚠️ Notes

- Result-driven insights are intentionally **current-page scoped**
  - they do not imply full dataset truth when paging is involved

- Investigate from business-like GUID columns is **best-effort**
  - some surfaced GUID fields may still require the correct target table choice to resolve successfully

- Lookup fields that do not expose a surfaced GUID value in the table may not show investigate actions in this release

- Interpretation output is heuristic guidance
  - it is designed to improve fast understanding, not to act as a source of truth

---

## [0.8.1] — Result Viewer Enhancements & Large Dataset Handling

### New

- Improved **business-aware field prioritisation in Query Doctor**
  - Boosts meaningful categorical fields (e.g. status, intent, type)
  - De-prioritises technical or low-signal fields (e.g. lookup IDs, GUIDs)
  - Produces more relevant and actionable narrowing suggestions

- Added **Save JSON action** in Result Viewer
  - Exports current dataset to file
  - Uses contextual filename:
    - `dvqr_<entity>-page-<n>.json`

- Introduced **Large Result Mode**
  - Automatically activates for large datasets (thousands of rows)
  - Prevents UI blocking during heavy renders

- Added **progressive rendering engine**
  - Rows render incrementally instead of all-at-once
  - Improves perceived responsiveness

- Added **auto-progressive loading (no user interaction required)**
  - Automatically continues rendering until full dataset is loaded
  - Eliminates need for manual “Load more”

- Added **render progress indicator**
  - Displays:
    - rendered row count vs total (e.g. `1400 of 5000 rows`)
  - Provides visibility into loading state

- Added **large dataset feedback banner**
  - Communicates:
    - partial rendering
    - ongoing background loading

---

### 🧠 Improvements

- Improved **Explain (Query Doctor) relevance**
  - Suggestions now favour business-meaningful fields over technically valid but low-value fields
  - Reduces noise from:
    - lookup `_..._value` fields
    - system identifiers
  - Surfaces fields users actually care about when analysing results

- Improved **Result Viewer responsiveness for large datasets**
  - Faster initial paint (partial render visible immediately)

- Improved **export usability**
  - Context-aware filenames replace generic defaults

- Improved **perceived performance**
  - Users can interact with partial data while rendering continues

---

### 🔧 Behaviour Changes

- Large datasets now:
  - render progressively instead of blocking UI
  - load automatically without requiring manual interaction

- Result Viewer prioritises:
  - early visibility of data
  - over full blocking render completion

---

### 🧱 Architecture

- Introduced **chunked rendering pipeline**
  - Breaks large datasets into smaller render batches

- Added **auto-progressive render loop**
  - Continues rendering asynchronously until completion

- Strengthened separation between:
  - data retrieval
  - rendering pipeline

---

### ⚠️ Notes

- Query Doctor now applies lightweight heuristics to prioritise business-relevant fields
- Field selection is still heuristic-based and will continue to improve in future releases
- Rendering very large datasets (thousands of rows) is still subject to browser/DOM limits
- Progressive rendering improves visibility and responsiveness but does not eliminate total render cost
- This release prioritises **perceived performance and usability** over full virtualization

---

## [0.8.0] — Evidence-Aware Query Doctor & Structured Narrowing Insights

### 🚀 New

- Introduced **evidence-aware Query Doctor**
  - Uses query shape, returned row patterns, and lightweight execution evidence
  - Moves beyond static advisory text into **result-aware guidance**

- Added **structured narrowing insights**
  - Surfaces narrowing opportunities based on observed result patterns
  - Supports:
    - **Categorical splits** (repeated low-cardinality values such as status/state)
    - **Presence splits** (null vs non-null patterns)

- Added **explainable suggestion reasoning**
  - Each suggestion includes *why* it was surfaced
  - Examples:
    - repeated values with counts
    - populated vs null distribution
  - Improves trust and transparency of Query Doctor outputs

- Introduced **structured narrowing model (foundation)**
  - Separates:
    - observed evidence
    - narrowing candidates
    - deterministic suggested queries
  - Prepares for future interactive refinement workflows

---

### 🧠 Improvements

- Improved **Query Doctor usefulness**
  - From generic advice → **evidence-based narrowing guidance**

- Improved **metadata accuracy of suggestions**
  - Suggested queries now use valid fields for the target entity
  - Prevents incorrect cross-entity field suggestions

- Improved **formatted value usage**
  - Prefers human-readable values (e.g. `Active`, `Married`)
  - Falls back safely when formatted values are not available

- Improved **narrowing candidate quality**
  - De-prioritises low-signal fields:
    - GUIDs / IDs
    - booleans
    - timestamps (initial release)
  - Prioritises:
    - choice / status fields
    - repeated categorical values
    - meaningful null/non-null splits

---

### 🔧 Behaviour Changes

- Query Doctor is now **analysis-first**
  - Surfaces:
    - observed patterns
    - narrowing opportunities
    - suggested queries
  - Focuses on insight before action

- Narrowing suggestions are triggered by:
  - **actual observed result patterns**
  - not static or predefined rules

---

### 🧱 Architecture

- Introduced **structured narrowing model**
  - Clean separation of:
    - evidence
    - suggestions
    - deterministic queries

- Reinforced separation between:
  - Result Viewer (presentation)
  - Query Doctor (analysis)

- Preserved formatted annotations for analysis while reducing UI clutter

---

### 🧪 Testing

- Added coverage for:
  - narrowing suggestion rendering
  - metadata-correct query generation
  - formatted-value-aware handling
  - result viewer behaviour (including resize)

---

### 🎯 Design Alignment

- Establishes Query Doctor as:
  - **evidence-driven**
  - **explainable**
  - **metadata-aware**

- Reinforces:
  - insight-first workflows
  - user-controlled refinement

- Prepares the foundation for:
  - interactive query refinement
  - richer execution workflows
  - without changing the analytical model introduced here

---

### ⚠️ Notes

- This release focuses on:
  - insight quality
  - trust
  - explainability
  - correctness

- Interactive refinement workflows will build on top of the structured narrowing foundation introduced in this release

---

## [0.7.7] — Preview System + Query Refinement Improvements

### 🚀 New

- Introduced a **unified preview system**
  - All query refinements now go through a single preview layer
  - Ensures consistency between suggested changes and executed queries
  - Supports multiple refinement workflows (apply or copy)

- Enhanced **Query Doctor with actionable insights**
  - Suggestions are now structured into:
    - informational guidance
    - actionable refinements
  - Enables a smoother “refine-as-you-go” experience

---

### 🧠 Improvements

- Query Doctor now:
  - Surfaces **clear refinement opportunities**
  - Differentiates between:
    - hints (informational)
    - refinements (actionable)
  - Aligns more closely with the **Query-by-Canvas** workflow

- Improved overall **trust and transparency**
  - All changes are preview-first
  - No implicit or hidden query mutations

---

### 🔧 Behaviour Changes

- Query refinements now follow a **preview-first interaction model**
  - Users can review suggested changes before applying or reusing them
  - Supports both direct refinement and manual control workflows

- Output now includes:
  - clearer classification of suggestions
  - consistent preview pathways for all refinements

---

### 🧱 Architecture

- Introduced a centralised **capability resolution layer**
  - Ensures consistent behaviour across different interaction modes
  - Simplifies future extensibility of refinement features

- Enforced:
  - single entry point for capability decisions
  - consistent preview → execution pipeline

- Removed:
  - redundant or unused configuration paths
  - early-stage extension hooks that were not yet in use

---

### 🧪 Testing

- Expanded coverage for:
  - refinement behaviour across interaction modes
  - preview consistency
  - classification of Query Doctor suggestions

---

### 🎯 Design Alignment

- Reinforces core principles:
  - Preview-first interactions
  - User-controlled refinement
  - Clear and explainable system behaviour
  - No hidden automation

---

### ⚠️ Notes

- Current scope focuses on **Query Doctor refinements**
- Other areas (Traversal, Investigate, Explain) remain unchanged

---

## [0.7.6] - 2026-04-XX

### ✨ New — Interactive Filter Refinement (Guardrail + Cue)

- Added intelligent filter value refinement for OData queries
  - Detects `eq` filter values on hover
  - Provides actionable replacement suggestions using metadata (Choice fields)
  - Displays preview options before applying changes (no silent mutation)

- Introduced inline interactive cue system
  - Subtle dotted underline on refinable values
  - Cursor changes to `?` to indicate available actions
  - Enhances discoverability without adding UI clutter

- Hover experience redesigned for choice fields
  - Replaced static value dump with actionable suggestions
  - Shows:
    - Preview replacement options
    - Human-readable labels for current value
    - Clean, focused output (reduced noise)

### 🧠 Architecture

- Introduced reusable refinement engine:
  - `buildChoiceRefinementOptions`
  - Designed for future extensibility (operators, clauses, Query Doctor)

- Separation of concerns:
  - Cue layer (editor UX)
  - Hover layer (insight + preview)
  - Command layer (execution)

### ⚠️ Guardrails

- Only supports safe first-pass scenarios:
  - `eq` operator
  - Single-value filters
  - Standard (non-polymorphic) fields

- Skips:
  - multi-condition (`and` / `or`) ambiguity
  - complex expressions
  - unsupported attribute types

### 📝 Notes

- Static “full value list” removed in favour of action-first UX
- Designed as foundation for:
  - operator mutation (future)
  - inline editing workflows
  - Query Doctor integration

---

## [0.7.5] – Query-by-Canvas (Preview-First Query Construction)

> Introduces **Query-by-Canvas**, a new interaction model for building Dataverse queries through guided, incremental refinement instead of writing full syntax upfront.

### Added

- **Query-by-Canvas (Preview-First Query Construction)**
  - Start with a minimal query (e.g. `contacts`)
  - DV Quick Run detects missing elements and suggests safe refinements
  - Establishes a consistent workflow:
    - detect → suggest → preview → apply
  - Enables progressive query construction without requiring full syntax upfront

- **Preview Add `$top` (Guardrail Actions)**
  - Detects missing `$top`
  - Offers:
    - `Preview add $top=10`
    - `Preview add $top=50`
  - Opens preview document before applying
  - Helps prevent large, unbounded queries

- **Preview Add `$select` (Guardrail Actions)**
  - Detects missing `$select`
  - Offers:
    - `Preview add $select...`
  - Guides users to choose fields before applying
  - Encourages focused, efficient queries

- **Hover-based Filter Value Refinement**
  - Hover on filter values (e.g. `statuscode eq 1`)
  - Shows:
    - decoded meaning (e.g. Active)
    - available alternative values
  - Provides:
    - `Preview replace current filter value`
  - Enables safe, in-place refinement of query semantics

### Improved

- **Guardrail → Preview workflow consistency**
  - Guardrails now provide actionable preview options instead of warnings only
  - Aligns with preview-first philosophy across the extension

- **Query construction UX**
  - Moves from:
    - manual syntax writing
  - to:
    - guided, incremental refinement
  - Reduces need to memorise OData syntax

### Notes

- Query-by-Canvas establishes the foundation for future capabilities:
  - guided `$filter` construction
  - relationship expansion
  - traversal-driven query building
- Focus is on **safe, deterministic, user-approved refinement**
- Complex query generation is intentionally deferred to future releases

---

## [0.7.4] – Preview-First Query Refinement (OData + FetchXML)

> Introduces safe, preview-first query mutation directly from the Result Viewer. Establishes a consistent “generate → preview → apply” workflow across OData and FetchXML.

### Added

- **Preview OData Filter (Result Viewer)**
  - Generate OData `$filter` clauses directly from cell values
  - Opens a reusable preview document showing:
    - original query
    - proposed filter clause
    - full preview query
  - Requires explicit confirmation before applying changes
  - Supports:
    - GUID, numeric, boolean, and string values
  - Automatically merges with existing `$filter` using logical `and`

- **Preview FetchXML Condition (Result Viewer)**
  - Generate FetchXML `<condition>` elements from cell values
  - Preview-first workflow with:
    - original FetchXML
    - proposed condition
    - updated query preview
  - Safe insertion into existing `<filter type="and">` blocks
  - Applies only after user confirmation
  - Fallback to copy when safe insertion is not possible

- **Reusable Query Preview Document**
  - Single preview document reused across all preview actions
  - Prevents tab spamming and keeps workflow focused
  - Standardized structure for:
    - OData
    - FetchXML
    - future mutation features

### Improved

- **Result Viewer → Query refinement workflow**
  - Result Viewer now acts as a **direct mutation surface**
  - Enables:
    - inspect → preview → apply → rerun loop
  - Reduces need for manual query editing

- **Context-aware action visibility**
  - Preview actions are now gated by visible editor mode:
    - OData editor → shows OData preview only
    - FetchXML editor → shows FetchXML preview only
  - Prevents misleading actions and fallback warnings

- **Safer mutation boundaries**
  - Preview actions limited to:
    - root-level scalar fields
  - Aliased / flattened fields (e.g. `a.name`) are excluded from preview
  - Copy actions remain available as fallback

- **Action clarity and UX consistency**
  - Removed confusing “preview → fallback to copy” flow
  - Actions now reflect only what is executable in the current context

### Notes

- Preview actions are intentionally scoped to **safe, deterministic scenarios**
- Complex cases (e.g. nested `link-entity` conditions, polymorphic joins) are deferred to future releases
- Establishes foundation for:
  - Query Doctor auto-fix (preview → apply)
  - table-driven query refinement
  - multi-step mutation workflows

## [0.7.3] – First-Run Experience, Result Viewer UX & Search

> Focused UX release improving onboarding, discoverability, and day-to-day usability. Establishes the Result Viewer as a true command surface for data exploration and action.

### Added

- **First-Run Quickstart Experience**
  - Automatically launches on first install
  - Provides runnable examples with CodeLens integration
  - Guides users through:
    - Run Query
    - Explain Query
    - Expand usage
    - FetchXML execution
    - Relationship exploration (Find Path to Table)
  - Reduces initial friction and improves discoverability of core features

- **Result Viewer Search (Table + JSON)**
  - Unified search across:
    - Table view
    - JSON view
  - Enables fast field/value discovery without manual scanning
  - Significantly improves usability for large result sets

### Improved

- **Result Viewer Empty State UX**
  - Improved “No results found” messaging
  - Added actionable guidance:
    - remove filters
    - increase `$top`
    - run without `$filter`
  - Enhanced spacing and readability for better visual clarity

- **Result Viewer as Command Surface (UX refinement)**
  - Reinforced interaction model:
    - view → search → act → refine
  - Improved alignment with:
    - traversal workflows
    - row-level actions
  - Sets foundation for future table-driven actions (investigate, traversal, mutators)

- **Onboarding discoverability**
  - Key capabilities are now visible immediately on first run
  - Reduces reliance on documentation or prior knowledge

### Notes

- This release focuses on **usability and workflow clarity**, not new core features
- Establishes a stronger foundation for:
  - table-driven actions
  - Query Doctor evolution
  - actionable insight expansion

## [0.7.2] – Sibling Expand & Actionable Insight Foundation

> Introduces metadata-driven enrichment within traversal and lays the foundation for intent-driven execution through the Actionable Insight model.

### Added

- **Sibling Expand (Traversal Enrichment)**
  - Enrich traversal results without leaving the current context
  - Triggered directly from Result Viewer (row/table-driven)
  - Allows selection of fields and related entity for expansion
  - Works on:
    - intermediate legs
    - final legs
    - single-leg traversal
  - Additive behaviour:
    - does not overwrite existing `$expand`
    - merges when expanding the same entity
  - Guardrails:
    - max 3 expands per leg
    - single-level expand only
    - suppressed when no valid relationship exists

- **Actionable Insight (Foundation Layer)**
  - Introduced structured execution intent model
  - Represents user actions (e.g. sibling expand) as deterministic intent
  - Execution flow:
    - user action → insight → mutation pipeline → query execution
  - Enables:
    - additive operations
    - replayable execution patterns
    - future optimisation strategies (composition / $batch)
  - Internal-only foundation (not exposed as user-facing feature)

- **Traversal + Result Viewer integration (enhanced)**
  - Sibling expand available alongside traversal continuation
  - Operates on current landing node
  - Fully compatible with:
    - Continue Traversal
    - multi-leg workflows
    - table viewer interactions

- **Expand mutation behaviour (additive + merge-aware)**
  - Expand is now:
    - additive (no reset of existing expand)
    - merge-aware (same entity expansions combined)
  - Prevents:
    - duplicate expand paths
    - accidental overwrite of previous expansions

- **Traversal enrichment workflow**
  - Users can now:
    - navigate → land → enrich → continue
  - Removes need for manual query rewriting mid-traversal

- **Execution consistency via shared mutation pipeline**
  - All expand operations now flow through the shared mutation pipeline
  - Aligns behaviour across:
    - Add Expand mutator
    - traversal-driven expand

- **Logging clarity (reduced noise)**
  - Removed duplicate scope logs
  - Improved signal-to-noise ratio in execution output

### Notes

- Sibling expand is **not traversal**
  - traversal = navigation
  - sibling expand = enrichment

- Actionable Insight is currently:
  - scoped to traversal/enrichment workflows
  - not yet used across all mutation features

- Future releases will build on this foundation to support:
  - composed multi-hop queries (single query execution)
  - `$batch` execution for multi-request optimisation
  - broader migration of mutation features into Actionable Insight model

## [0.7.1] – Guided Traversal & Continuation Workflow

> Introduces guided traversal with continuation, enabling step-by-step navigation across Dataverse relationships directly from VS Code.

### Added

- **Guided Traversal (Find Path to Table)**
  - Discover relationship paths between Dataverse tables directly from the editor
  - Supports multi-hop traversal with variant (route) selection
  - Introduces itinerary concepts:
    - **Compact** (nested expand / join-like execution)
    - **Mixed** (step-by-step continuation)
  - Provides structured execution output with step-by-step breakdown

- **Traversal Continuation (Multi-leg execution)**
  - Continue traversal across hops using **Continue Traversal**
  - Step-based execution model:
    - `Step X/Y` progression
    - clear landing context at each hop
  - Row-driven continuation:
    - traversal proceeds from selected/landed records
  - Traversal session state maintained across steps

- **Traversal-aware Result Viewer integration**
  - Row-level action:
    - **Continue to {Entity}**
  - Contextual continuation only shown when applicable
  - Traversal state cleared on completion or new traversal
  - Prevents invalid continuation via session key validation

- **Execution strategy support (itinerary-based)**
  - Introduced multiple execution strategies:
    - step-based continuation (sampling-safe)
    - nested expand (context-preserving)
  - Compact itinerary uses nested expand for multi-hop joins
  - Mixed itinerary uses controlled step traversal with safety limits

- **Traversal outcome clarity**
  - Explicit outcomes after each step:
    - landed entity
    - row counts
    - next step availability
  - Clear messaging for:
    - successful landing
    - empty results
    - traversal completion

- **Proven Route Detection (in-session)**
  - Tracks successful traversal variants during session
  - Highlights previously successful paths in picker
  - Displays:
    - ⭐ Proven routes
    - usage count
  - Enables faster reuse of known-good traversal paths

- **Configuration Migration Loader**
  - Automatically injects new settings for existing users:
    - `dvQuickRun.productPlan`
    - `dvQuickRun.traversal.allowedTables`
    - `dvQuickRun.traversal.excludedTables`
  - Runs on activation
  - Only applies when settings are missing (non-destructive)
  - Ensures backward compatibility for existing installations

---

### Notes

- Guided Traversal introduces a new **multi-leg workflow model** for Dataverse queries
- Step-based traversal may return empty results when intermediate sampling does not preserve relationship continuity
- Compact (nested expand) itinerary provides better results for **dependent multi-hop relationships**
- Proven routes are currently **in-memory only** (session-scoped)
- Future enhancements will focus on:
  - adaptive execution strategy
  - persisted traversal history
  - shareable traversal keys

### [0.7.0] – Query Doctor Foundation & Suggested Fix Engine

### Added
- **Query Doctor (Foundation)**
  - Introduced a structured diagnostic engine for Dataverse queries
  - Provides:
    - issue detection
    - advisory guidance
    - prioritised diagnostic output
  - Designed as a non-blocking, developer-assist layer (not strict validation)

- **Suggested Fix Engine**
  - Diagnostics now include actionable suggested fixes where applicable
  - Suggested fixes provide:
    - clear intent (`label`)
    - explanation (`detail`)
    - optional examples for direct usage
  - Enables future expansion into auto-fix and interactive query refinement

- **Diagnostic pipeline architecture**
  - Introduced:
    - `DiagnosticFinding`
    - `DiagnosticSuggestedFix`
  - Separation between:
    - issue detection
    - suggested remediation
  - Supports confidence scoring and future ranking strategies

- **Rule-based diagnostic engine**
  - Introduced modular rule sets:
    - `basicQueryShapeRules`
    - `metadataValidationRules`
  - Enables incremental expansion of Query Doctor capabilities
  - Clean separation between:
    - syntax/shape guidance
    - metadata-aware validation

- **Capability-gated Query Doctor levels**
  - Query Doctor behaviour now scales via capability levels
  - Foundation supports:
    - Level 1: query shape diagnostics
    - Level 2: metadata-aware validation
  - Designed to support future Pro-level expansion

- **Expand advisory (boundary awareness)**
  - Detects `$expand` usage in OData queries
  - Surfaces advisory:
    - Expand diagnostics are currently partial
  - Prevents misleading or incomplete diagnostic guidance
  - Establishes clear capability boundaries for Query Doctor

### Improved
- **Explain Query output with diagnostics integration**
  - Diagnostics are now embedded into Explain output
  - Clear separation between:
    - explanation
    - diagnostics
  - Improved readability and developer guidance

- **Developer experience (actionable feedback)**
  - Queries now provide:
    - what is wrong
    - why it matters
    - how to fix it
  - Reduces guesswork when debugging Dataverse queries

- **Extensibility for future diagnostic features**
  - Architecture now supports:
    - auto-fix generation
    - interactive query refinement
    - deeper semantic reasoning
  - Aligns with future “Query Doctor+” capabilities

### Notes
- Query Doctor in v0.7.0 focuses on **foundation and correctness**
- Advanced scenarios (e.g. deep `$expand`, complex FetchXML semantics) are intentionally scoped for future releases
- Emphasis on **trustworthy guidance over exhaustive validation**

### [0.6.3] – Architecture Consolidation & Investigation Engine Refactor

### Added
- **Investigation engine modular architecture**
  - Split investigation logic into focused modules:
    - `investigationSummaryFields`
    - `investigationLookupSuggestions`
    - `investigationReverseLinks`
  - Introduced `investigationDisplayHelpers` as a shared utility layer
  - Improved separation of concerns across investigation pipeline

### Improved
- **Investigate Record maintainability and structure**
  - Refactored previously large and multi-responsibility modules into cohesive units
  - Reduced complexity of investigation logic for easier future enhancements
  - Improved readability and reasoning of:
    - summary field generation
    - lookup suggestion analysis
    - reverse relationship discovery

- **Result Viewer architecture (render layer separation)**
  - Extracted rendering logic into:
    - `scriptRenderers`
    - `scriptUtilities`
  - Simplified `resultViewerHtml` into a lightweight bootstrap layer
  - Improved separation between:
    - data preparation
    - rendering logic
    - UI interaction handling

- **Codebase consistency and reuse**
  - Consolidated shared helpers:
    - label formatting
    - entity name formatting
    - normalization logic
  - Removed duplicate helper implementations across modules

### Fixed
- Fixed edge cases introduced during refactor where helper dependencies were not correctly resolved
- Fixed reverse-link generation inconsistencies during modular extraction
- Fixed minor type mismatches uncovered during module separation

---

(Structural refactor release focused on maintainability, modularity, and long-term extensibility)

### [0.6.2] – FetchXML Explain (Teaching Mode) & Reasoning Foundation

### Added
- **FetchXML Explain Query (Teaching Mode)**
  - Explain FetchXML queries directly from the editor
  - Provides a structured, human-readable walkthrough of the query
  - Designed to help developers understand query intent, not just syntax

- **Query Overview & Result Shape Explanation**
  - Explains:
    - root entity
    - number of linked entities
    - selected attributes
    - expected result structure
  - Introduces **Result Shape** section describing what each row represents

- **Structure Walkthrough (hierarchical)**
  - Explains FetchXML tree structure in execution order
  - Covers:
    - root entity
    - nested link-entities
    - attribute selection per scope
  - Preserves full hierarchy (no flattening)

- **Relationship Explanation (purpose-based)**
  - Explains joins in plain language
  - Describes:
    - how entities are connected
    - why linked entities are included
    - join direction and behaviour

- **Scope-aware Filter Narration**
  - Groups filters by entity / alias scope
  - Clearly distinguishes:
    - root-level filters
    - linked-entity filters
  - Supports:
    - nested filters
    - AND / OR groupings
    - multi-value conditions (`contain-values`)

- **Operator Meaning Integration**
  - Reuses operator intelligence system from v0.6.1
  - Explains operators such as:
    - `eq`, `not-null`, `this-month`, `contain-values`
  - Includes value contract awareness

- **Advisory Diagnostics & Suggestions**
  - Non-blocking guidance including:
    - missing alias recommendations
    - deep nesting readability notes
  - Maintains advisory (non-mutating) philosophy

- **FetchXML Explain CodeLens support**
  - `Explain` now available for FetchXML queries
  - Aligns FetchXML with OData developer workflow

### Improved
- **FetchXML developer experience**
  - FetchXML evolves from:
    - execution-only → semantic understanding → full query explanation
  - Significantly reduces cognitive load when reading complex queries

- **Metadata enrichment consistency**
  - Unified enrichment for:
    - attributes
    - conditions
    - choice values
  - Choice labels displayed when metadata is available locally
  - Graceful fallback to raw values when metadata is unavailable

- **Metadata enrichment performance**
  - Parallel metadata loading for all entities in the query
  - Deduplicated metadata access per entity
  - Reduced repeated metadata lookups for large queries

- **Explain output readability**
  - Improved narrative flow:
    - Executive Summary
    - Query Overview
    - Result Shape
    - Structure Walkthrough
    - Relationship Explanation
    - Filter Narration
  - More natural, teaching-oriented wording

---

(Major functional expansion introducing FetchXML reasoning and explanation capabilities)

### [0.6.1] – FetchXML Semantic Hover & Operator Intelligence

### Added
- **Full FetchXML operator hover support**
  - Hover on `<condition operator="...">`
  - Displays:
    - polished operator meaning (human-readable)
    - raw operator name
    - grouped classification (comparison, set, relative date, etc.)
    - value expectations (none / single / multiple / range)
    - supported data categories
    - usage examples and diagnostics
  - Covers:
    - comparison (`eq`, `gt`, `on-or-after`, etc.)
    - pattern (`like`, `begins-with`, etc.)
    - set (`in`, `contain-values`, etc.)
    - range (`between`)
    - relative date (`last-x-days`, `this-week`, etc.)
    - fiscal, hierarchy, and ownership operators

- **Choice / OptionSet hover enrichment**
  - Hover on:
    - `<condition attribute="statecode" ... />`
    - `<value>1</value>` and `value="1"`
  - Displays:
    - selected label (e.g. `Active`)
    - full available choice set
  - Aligns FetchXML experience with existing OData choice awareness

- **Relationship-aware hover (FetchXML)**
  - Hover on:
    - `<link-entity name="...">`
    - `from`, `to`, `alias`
  - Displays:
    - relationship metadata
    - target/source entity context
  - Enables understanding of joins directly from the editor

- **Linked-entity field hover**
  - Hover on attributes inside nested `<link-entity>`
  - Displays metadata from the correct related entity scope
  - Supports multi-level nesting

- **Expanded metadata-aware hover coverage**
  - Hover now supports:
    - entity names
    - attribute names
    - operators
    - relationship attributes
    - choice literals
  - Brings FetchXML hover close to OData parity

- **Operator catalog expansion (data-driven)**
  - Fully seeded operator registry covering:
    - core operators
    - relative date family
    - fiscal operators
    - hierarchy operators
    - ownership/context operators
  - Clean grouping and ordering across categories
  - Enables future features (Explain, validation, query doctor)

### Improved
- **FetchXML hover quality and consistency**
  - Hover output now uses:
    - polished labels (human-readable)
    - structured diagnostics
    - consistent formatting across all operator types

- **Scope-aware metadata resolution**
  - Correct entity resolution across:
    - root entity
    - linked entities
    - nested link-entities
  - Eliminates incorrect hover results in complex queries

- **Parity with OData experience**
  - FetchXML now provides:
    - comparable metadata awareness
    - comparable choice decoding
    - comparable developer guidance

- **Foundation for semantic reasoning**
  - Operator metadata now includes:
    - classification
    - value contracts
    - diagnostics
  - Prepares groundwork for:
    - Explain FetchXML
    - query validation
    - query optimisation suggestions

### [0.6.0] – FetchXML Execution & Hover Foundation

### Added
- **FetchXML execution support**
  - Execute FetchXML queries directly from the editor (Run FetchXML)
  - Unified execution pipeline alongside existing OData support
  - Results open in the Result Viewer with full table/JSON toggle support
  - Supports:
    - multiple attributes
    - aliased fields
    - empty result sets
    - Dataverse error propagation (invalid entity, malformed XML, etc.)

- **FetchXML-aware query detection**
  - Automatic detection of FetchXML queries under cursor
  - Context-aware CodeLens:
    - **Run FetchXML** shown for FetchXML queries
    - **Explain Query** remains OData-only

- **FetchXML hover support (first cut)**
  - Hover on:
    - `<entity name="...">`
    - `<attribute name="...">`
  - Displays:
    - logical name
    - display name (if available)
    - basic metadata context
  - Aligns FetchXML experience with existing OData hover model

- **Operator catalog foundation (data-driven)**
  - Introduced JSON-based operator registry
  - Supports:
    - multiple label modes (polished, raw, grouped)
    - diagnostics metadata
    - value contract definition (none/single/multiple)
  - Enables future extensibility without code changes

### Improved
- **Unified query execution experience**
  - OData and FetchXML now share a consistent execution + viewer pipeline
  - Improved consistency across result handling and error surfacing

- **CodeLens clarity**
  - Clear separation between OData and FetchXML actions
  - Reduced confusion by removing unsupported actions for FetchXML

### Fixed
- Fixed incorrect action rendering where FetchXML queries previously showed OData-specific options
- Fixed edge cases in query detection when switching between OData and FetchXML contexts

---

(Minimal UI changes — major functional expansion introducing FetchXML execution and metadata-aware hover)

### [0.5.2] – Stability & Foundations Release

- Improved Result Viewer architecture for future enhancements
- Improved reliability and consistency of table rendering
- Strengthened model-driven rendering pipeline for future features
- Improved handling of object values in the Result Viewer
  - Objects are now correctly classified and rendered via the model-driven pipeline
  - Prevents incorrect table rendering or silent fallback behaviour for object cells
- Metadata retrieval (`Get Metadata`) now opens in the Result Viewer (Table view) instead of raw JSON document
  - Aligns metadata inspection with the standard result exploration workflow
  - Enables consistent use of table, JSON toggle, and future viewer actions
- Expanded test coverage and improved overall stability

(Minimal UI changes — primarily a foundation release with improved consistency and unified result viewer behaviour)

## [0.5.1] - Result Viewer Stabilization & Investigation Input Hardening

### Added
- **Enhanced investigation input handling**
  - Improved support for extracting identifiers from:
    - noisy log text
    - partial JSON fragments
    - mixed content selections
  - Normalized GUID handling (case-insensitive resolution)
  - More reliable candidate selection when multiple identifiers are present

- **Expanded Result Viewer behaviour coverage**
  - Improved handling of complex cells (objects, arrays) via drawer inspection
  - Strengthened raw vs display value separation for action correctness
  - Additional safeguards for column-aware actions on flattened data

### Improved
- **Result Viewer stability**
  - Improved reliability of table rendering across nested and aliased data
  - Reduced UI fragility during re-render cycles
  - Improved consistency of row-level and column-level actions

- **Investigation engine robustness**
  - More resilient input resolution across real-world payloads and logs
  - Improved fallback behaviour when metadata inference is ambiguous
  - Better error messaging when identifier extraction fails

- **Test coverage expansion**
  - Added and refined tests for:
    - investigation input resolution
    - candidate selection edge cases
    - result view model behaviour (flattening, ordering, raw values)

## [0.5.0] - Metadata Engine Stabilization & Explain Query Foundations

### Added
- **Disk-backed metadata cache storage**
  - Metadata caches are now persisted to disk under VS Code `globalStorageUri`
  - File-per-entity storage model for:
    - fields
    - choices
    - relationships
    - relationship explorer
  - Environment-scoped metadata storage directories
- **Metadata storage abstraction layer**
  - Introduced structured storage modules:
    - `storagePaths`
    - `jsonStorage`
    - `metadataStorage`
  - Centralized metadata read/write operations via storage facade
- **Enhanced metadata diagnostics**
  - Diagnostics now show:
    - storage mode (disk-backed vs legacy state)
    - per-cache bucket sizes
    - total persisted metadata size
  - Improved visibility into metadata cache health
- **Lightweight Explain Query relationship advice (Phase 2A)**
  - Explain Query now surfaces **Field Provenance & Relationship Advice**
  - Provides guidance when fields belong to related entities instead of the base entity
  - Supports:
    - `$select`
    - `$orderby`
  - Advice is derived safely from validation results (no heavy runtime traversal)

### Improved
- **Extension host performance and stability**
  - Eliminated large metadata payloads from VS Code extension state
  - Reduced risk of extension host freezes during metadata-heavy operations
  - Improved responsiveness of:
    - Explain Query
    - metadata-aware features
    - relationship exploration
- **Metadata persistence granularity**
  - Updates now occur at entity level instead of rewriting large environment-wide blobs
  - More efficient cache writes and reads
- **Cache clear behavior**
  - Clear metadata command now removes disk-backed files
  - Legacy state keys are also cleared for consistency
- **Foundation for future metadata reasoning**
  - Enables safe expansion into deeper Explain Query reasoning
  - Prepares groundwork for:
    - structured provenance signals
    - scope-aware hover
    - advanced investigation features

### Fixed
- Fixed extension host performance degradation caused by large persisted metadata state
- Fixed repeated growth of metadata payloads in VS Code global state
- Fixed metadata cache inconsistencies during repeated metadata operations


## [0.4.4] - Result Viewer Usability Fix

### Fixed
- Fixed horizontal scrolling behaviour for wide tables in the Result Viewer
- Table now expands based on column content instead of compressing into viewport
- Improved usability when working with large Dataverse result sets (many columns)

### Improved
- Result Viewer now correctly supports horizontal exploration of data
- Significantly better experience when inspecting real-world enterprise datasets


## [0.4.3] - Result Viewer Intelligence & Action Foundations

### Added
- **Column-aware result viewer actions** for Dataverse query results
- Query helper actions for visible cell values:
  - **Copy OData filter**
  - **Copy FetchXML condition**
- **Schema / Metadata** toolbar action directly from the Result Viewer
- **CSV export** for the current table view
  - exports the current filtered and sorted result set
  - exports the currently displayed values shown in the table
- Result viewer toolbar action icons for:
  - **Relationships**
  - **Schema / Metadata**
  - **Export**
- Result viewer environment indicator shown in the viewer header
- Hover-reveal row actions for a cleaner result grid experience

### Improved
- Result Viewer now behaves more like an interactive Dataverse investigation surface
- **Primary key column** is consistently shown first in the table when available
- **Choice / Option Set values** are rendered using labels in the table view instead of raw numeric codes
- Result viewer now supports:
  - **client-side sorting**
  - **client-side filtering**
  - **resizable columns**
- Improved toolbar visual grouping by separating view modes from tool actions
- Improved kebab / overflow menu behavior for row actions
- Result viewer action handling was consolidated to better support future command-surface features
- Stabilized viewer event handling and reduced fragility during rerenders

### Fixed
- Fixed result viewer cases where the table failed to render due to embedded webview script issues
- Fixed overflow / kebab menu clipping and positioning issues near the bottom of the table
- Fixed filter input losing focus during rerender
- Fixed row action inconsistencies caused by repeated event rebinding
- Fixed schema toolbar action so metadata can be opened directly for the current query entity
- Fixed query helper actions so they correctly use raw underlying values even when labels are displayedh

## [0.4.2] - Interactive Result Viewer

### Added
- **Interactive Query Result Viewer** providing a structured table interface for Dataverse query results
- Results now display in a dedicated viewer panel instead of raw JSON output
- Toolbar actions allowing users to switch between:
  - **TABLE view**
  - **JSON view**
  - **RELATIONSHIPS** analysis
- Inline **record actions** for primary key values including:
  - 🔎 **Investigate Record**
  - ↗ **Open Record in Dataverse UI**
- Automatic detection of Dataverse **primary key fields** using metadata
- Primary key cells now surface contextual record actions directly within the result grid
- Consistent result viewer behavior across:
  - Run Query
  - Run Query Under Cursor
  - Smart GET

### Improved
- Query execution results now open in the **Result Viewer** by default for improved inspection workflows
- Smart GET queries now use the same result viewer interface for consistent developer experience
- Result viewer automatically resolves entity metadata to enable contextual record actions
- Improved discoverability of record investigation and navigation actions
- Result viewer header now includes **row count and environment context**

### Fixed
- Fixed Smart GET results opening in raw JSON instead of the result viewer
- Fixed inconsistent result rendering between different query execution commands

## [0.4.1] - Stabilization & Investigation Reliability

### Added
- Relationship analysis documents now include entity-aware filenames:
  - `Relationship Explorer - entity.txt`
  - `Relationship Graph - entity.txt`
- Improved investigation handling for mixed JSON documents containing multiple `@odata.context` blocks

### Improved
- Stabilized **Investigate Record** behavior for real-world Dataverse payloads
- Improved entity inference when investigating records from:
  - partial JSON fragments
  - copied API responses
  - mixed diagnostic logs
- Improved investigation candidate selection to avoid incorrect entity resolution
- Improved handling of custom tables and non-standard entity names
- Improved error transparency when relationship traversal encounters Dataverse permission restrictions

### Fixed
- Fixed incorrect entity inference when earlier `@odata.context` values appeared elsewhere in the document
- Fixed duplicate entity selection prompts in some investigation scenarios
- Fixed incorrect request URL formatting in investigation error messages
- Fixed investigation failures caused by incorrect context resolution in multi-block JSON payloads
- Fixed several investigation edge cases discovered during real-world testing against enterprise Dataverse environments

## [0.4.0] - Investigate Record

### Added
- **Investigate Record** feature for rapid Dataverse record analysis directly from VS Code
- Investigation report generation including:
  - structured **SUMMARY**
  - **POINTS TO** lookup relationships
  - **REVERSE LINKS** suggestions
  - **SUGGESTED QUERIES** for further exploration
- Deterministic candidate extraction for record identifiers from:
  - GUID selections
  - JSON payloads
  - OData entity paths
  - query results
- Entity inference engine for resolving record entity types using:
  - JSON `@odata.context`
  - query path hints
  - metadata lookup relationships
- Canonical **Resolved Investigation Context** ensuring consistent entity resolution across the investigation pipeline
- Polymorphic lookup awareness for relationships with multiple valid target entities
- Investigation reports now include meaningful document titles:
DV Investigation [ENV] - entity - guid
- Metadata-enriched summary fields including choice label resolution:
Priority : 1 (Normal)
- Investigation summaries organized into ranked categories:
- Identity
- Lifecycle
- Ownership
- Business-relevant fields
- Automated regression tests covering the investigation engine components:
- candidate extraction
- candidate scoring
- candidate selection
- input resolution
- resolved investigation context
- investigation document generation
- signals and suggested queries

## [0.3.2] - Execution Transparency, Test Coverage & Developer UX

### Added
- Comprehensive automated test suite covering core DV Quick Run subsystems
- Query mutation pipeline
- Guardrail execution logic
- Environment runtime state handling
- Smart GET workflows and GUID flows
- Smart PATCH workflows
- Explain Query parsing and section generation
- Metadata access and session caching
- Hover field, navigation, and choice resolution
- Structured execution logging for Dataverse operations
- Shared execution logging helpers for consistent command output
- Result timing and record-count summaries for GET operations

### Improved
- Execution output now clearly displays the exact query executed:
    [DV:DEV] GET contacts?$select=fullname&$top=10
    → 10 records returned (85ms)
- Improved developer visibility when running queries directly from the editor
- Consistent execution output format across Smart GET, Run Query, and metadata operations
- Review menu UX improvements for Smart GET workflows
- Clipboard actions now produce human-readable query paths instead of URL-encoded strings
- Improved command output clarity by reducing noisy intermediate messages
- Refactored action-level execution flows for improved runtime safety and consistency

### Fixed
- Result preview window not appearing after query execution in certain refactor scenarios
- Incorrect URL-encoded query text produced by **Copy Query Path**
- Inconsistent query history entries when opening queries via the review menu
- Several minor execution-flow edge cases uncovered during test expansion

## [0.3.1] - Architecture Stabilization & Query Reliability

### Added
- Unit tests covering core query intelligence components
  - query detection
  - filter expression rules
  - filter value validation
  - choice metadata interpretation
- Validation safeguards for `$filter` value formatting across string, numeric, datetime, and lookup fields
- Shared utilities for query mutation and filter construction
- Additional internal diagnostics coverage for metadata interpretation logic

### Improved
- Refactored metadata architecture separating **metadata loading** from **value interpretation**
- Centralized metadata retrieval and caching through `metadataAccess`
- Introduced pure interpretation layer `valueAwareness` for choice metadata resolution
- Reduced duplication across query mutation actions using a shared mutation runner
- Improved field picker experience by hiding non-selectable fields
- Improved string escaping for OData filter expressions
- Improved handling of numeric, GUID, and datetime filter values
- Improved testability of core query analysis components

### Fixed
- Incorrect quoting behavior for datetime filter expressions
- Duplicate query detection logic across mutation actions
- Edge cases where non-selectable metadata fields appeared in `$select` field pickers
- Several internal metadata interpretation inconsistencies

## [0.3.0] - Environment Profiles & Safe Multi-Environment Metadata

### Added
- Environment profile system supporting multiple Dataverse environments
- First-run environment setup wizard
- Commands to add, select, and remove environments
- Status bar indicator showing the active Dataverse environment
- Configurable environment status colors (white / amber / red)
- Environment-aware metadata diagnostics showing active environment and cache prefix

### Improved
- Persisted metadata caches are now scoped per environment
- Metadata diagnostics clearly show which environment cache is being inspected
- Cache keys normalized using environment prefix to prevent cross-environment reuse
- Prevented metadata leakage between environments when switching contexts
- Cleared session metadata caches automatically when environment changes
- Cleared hover and navigation enrichment caches during environment switch
- Persisted cache clear command now clears caches for the active environment only

## [0.2.2] - Performance & Cache Observability

### Added
- Metadata diagnostics command to inspect runtime cache state
- Commands to clear session metadata cache
- Commands to clear persisted metadata cache
- Versioned metadata cache keys to support safe future upgrades

### Improved

- Reduced repeated metadata resolution during hover and Smart GET workflows
- Optimized CodeLens refresh behavior to avoid unnecessary recomputation while editing
- Improved metadata cache reuse across hover and query analysis features
- Reduced output noise by demoting non-critical logs to debug level
- Added lightweight entity-definition prewarm to improve first-use responsiveness

### Fixed

- Persisted metadata cache invalidation for entity definitions
- Duplicate hover request context property causing redundant lookup paths
- Cache key inconsistencies across metadata caches

## [0.2.1] - Hotfix

### Fixed
- Improved Azure CLI discovery across Windows environments
- Fixed authentication failures caused by brittle Azure CLI path assumptions
- Added safer handling for PATH-based Azure CLI installations

## [0.2.0] - Metadata Intelligence Foundation

### Added
- Choice metadata decoding
- Navigation metadata normalization
- Lookup target resolution
- Metadata caching stabilization

### Improved
- Explain Query accuracy
- Metadata hover intelligence
- Query validation reliability

## [0.1.0] - Initial Release

### Added

- Run Dataverse Web API queries directly from VS Code
- Run query under cursor
- Smart GET query builder
- Smart GET from GUID
- Query explanation engine
- Query mutation helpers
- Add Select, Filter, Expand, and OrderBy helpers
- Relationship explorer and relationship graph view
- Generate query from JSON record
- Inline metadata hover for Dataverse queries
- CodeLens actions for quick query execution
- Azure CLI authentication support
- Added Ctrl+Enter, Ctrl+Shift+R shortcut to run query under cursor