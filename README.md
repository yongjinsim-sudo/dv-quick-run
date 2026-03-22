# DV Quick Run

A metadata-aware Dataverse query, investigation, and action workbench for VS Code.

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

## 🆕 What's New in v0.6.1

* **FetchXML semantic hover (major upgrade)**
  - Hover now works across the full FetchXML surface:
    - `<entity>`, `<attribute>`
    - `<condition operator="...">`
    - `<link-entity>` (`from`, `to`, `alias`)
    - nested linked entities
  - Displays:
    - metadata context (logical + display names)
    - operator meaning (polished + raw)
    - classification (comparison, set, relative date, etc.)
    - value expectations and usage guidance

* **Full operator intelligence**
  - Complete operator coverage including:
    - comparison, pattern, set, range
    - relative date (e.g. `last-x-days`, `this-week`)
    - fiscal operators
    - hierarchy operators
    - ownership/context operators
  - Data-driven operator catalog enables future extensibility (no code changes required)

* **Choice / OptionSet awareness (FetchXML)**
  - Hover on:
    - `value="0"`
    - `<value>1</value>`
  - Displays:
    - selected label (e.g. `Active`)
    - full available option set values
  - Achieves parity with OData choice decoding

* **Relationship-aware hover**
  - Hover on `link-entity` attributes shows:
    - relationship metadata
    - source/target entity context
  - Makes joins understandable directly from the editor

* **Linked-entity scope awareness**
  - Correct metadata resolution for:
    - linked entities
    - nested link-entities
  - Eliminates incorrect hover results in complex FetchXML queries

* **Near parity with OData experience**
  - FetchXML now provides:
    - metadata-aware hover
    - choice decoding
    - semantic operator guidance
  - Brings FetchXML to the same level of developer ergonomics as OData

---

## 🆕 What's New in v0.6.0

* **FetchXML execution support**
  - Run FetchXML queries directly from the editor (**Run FetchXML**)
  - Results open in the Result Viewer (table / JSON view supported)
  - Works alongside existing OData queries with a unified execution experience

* **FetchXML-aware editor experience**
  - Automatic detection of FetchXML queries under cursor
  - Context-aware CodeLens:
    - **Run FetchXML** for FetchXML queries
    - **Explain Query** remains OData-only

* **FetchXML hover (foundation)**
  - Hover on:
    - `<entity name="...">`
    - `<attribute name="...">`
  - Displays logical and display names using metadata
  - Introduced metadata-aware hover model for FetchXML

* **Operator foundation (extensible design)**
  - Introduced a data-driven operator catalog
  - Supports polished / raw / grouped label modes
  - Enables future extensibility without code changes

* **Unified query experience**
  - OData and FetchXML now share the same execution and result viewer pipeline
  - Improved consistency across query workflows

*(Minimal UI changes — major functional expansion introducing FetchXML support and metadata-aware hover foundation)*

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

### 🧠 Explain Query

* Break queries into human-readable explanations
* Understand filters, sorting, and structure instantly

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
