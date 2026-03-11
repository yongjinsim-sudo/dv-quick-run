# DV Quick Run

**Run, build, and understand Dataverse Web API queries directly inside VS Code with metadata-aware developer tooling.**

DV Quick Run turns VS Code into a **Dataverse developer console**.  
Instead of jumping between Postman, browser tabs, maker portals, and documentation, you can **write, refine, execute, and explain queries without leaving the editor**.

---

## 🆕 What's New in v0.2.2

This release focuses on **performance, reliability, and metadata intelligence**.

Major improvements:

- Token reuse with in-memory caching
- Metadata request deduplication
- Layered metadata caching (session + persisted)
- Faster metadata hover resolution
- CodeLens refresh debounce for smoother editing
- Metadata diagnostics tools for cache inspection
- Reduced extension output noise

These improvements make metadata-powered features such as **Explain Query, hover metadata, builders, and relationship exploration significantly faster** during normal development sessions.

---

## 🚀 Animated Demo

![DV Quick Run Demo](docs/demo-run-query.gif)

Typical workflow:

write query  
→ refine query  
→ run query  
→ inspect results  
→ explain query  
→ improve query  

Everything happens **inside VS Code**.

---

# ⚡ Quick Start

1. Install **DV Quick Run**
2. Login with Azure CLI
    az login --allow-no-subscriptions

3. Write a Dataverse query in a file
    contacts?$top=10


4. Click **Run Query** in CodeLens.

That's it.

---

# ✨ Why DV Quick Run?

Working with the Dataverse Web API usually involves a fragmented workflow:

- Write a query
- Copy it into Postman
- Run it
- Inspect results
- Look up metadata
- Adjust the query
- Repeat

DV Quick Run collapses that loop into a **single editor experience**.

---

# 🔎 CodeLens Query Execution

DV Quick Run automatically detects probable Dataverse queries and adds **inline CodeLens actions**.

    [Run Query] [Explain]
    accounts?$top=10


This turns your editor into a **lightweight Dataverse query workbench**.

---

# 🧠 Explain Query

Understanding a Dataverse query can sometimes be harder than writing it.

DV Quick Run breaks a query into **human-readable sections**.

Example query:
    contacts?$select=fullname&$filter=contains(fullname,'john')&$orderby=createdon desc&$top=25


Explain Query shows:

- entity path
- record vs collection query
- selected fields
- filter meaning
- sort order
- query shape advice

Great for **learning and reviewing queries**.

---

# 🔍 Metadata Hover

Hover over fields inside a query to see **Dataverse metadata**.

Example:
    contacts?$select=fullname,emailaddress1


Hovering a field may display:

- logical name
- display name
- attribute type
- choice values (if applicable)

Metadata is cached for fast repeated lookups.

---

# 🔧 Smart GET from GUID

Select a GUID in the editor and instantly generate a record query.

Example selected GUID:
    7d29eec7-4414-f111-8341-6045bdc42f8b

Generated query:
    contacts(7d29eec7-4414-f111-8341-6045bdc42f8b)

Or pick fields:
    contacts(7d29eec7-4414-f111-8341-6045bdc42f8b)?$select=fullname,emailaddress1

---

# 🧰 Query Mutation Helpers

Incrementally refine existing queries.

Available helpers:

- **Add Fields ($select)**
- **Add Filter ($filter)**
- **Add Expand ($expand)**
- **Add Order ($orderby)**

Example transformation:

Original:
    contacts

Add fields:
    contacts?$select=fullname,emailaddress1

Add filter:
    contacts?$select=fullname,emailaddress1&$filter=contains(fullname,'john')


---

# ⚙️ Smart GET Builder

Generate Dataverse queries through guided prompts.

Workflow:

Choose entity  
→ Choose fields  
→ Optional filters  
→ Optional sorting  
→ Build query  
→ Run query  

Example generated query:
    accounts?$select=name,accountnumber

---

# ✏️ Smart PATCH Builder

Update Dataverse records using guided prompts.

Workflow:

choose entity  
→ choose record  
→ choose fields  
→ enter values  
→ execute PATCH  

No manual request construction required.

---

# 🔁 Generate Query from JSON

Convert a JSON record into a Dataverse query skeleton.

Example JSON:
    {
        "fullname": "John Smith"
    }

Generated query:
    contacts?$filter=fullname eq 'John Smith'


Useful when exploring Dataverse responses.

---

# 🔗 Relationship Explorer

Explore how Dataverse entities are connected.

Example:
    contact
    ├─ createdby → systemuser
    ├─ parentcustomerid_account → account
    └─ parentcustomerid_contact → contact

This helps developers understand **which `$expand` paths are available**.

### Relationship Graph View

Graph view currently shows **direct (1-level) relationships**.

Future versions will support **recursive traversal**.

---

# 🛡 Guardrails for Risky Queries

DV Quick Run detects risky query shapes such as:

- missing `$top`
- overly broad queries
- expensive query patterns

Instead of silently executing them, the extension **warns and asks for confirmation**.

---

# 🧠 Metadata Intelligence

DV Quick Run uses Dataverse metadata to power many of its features.

This enables:

- intelligent field pickers
- navigation property discovery
- query explanation
- schema-aware helpers
- relationship exploration

This metadata intelligence layer is the foundation for future features such as:

- query validation
- relationship traversal
- query intent suggestions

---

# 🔬 Metadata Diagnostics

DV Quick Run includes commands to inspect and manage metadata caches.

Available commands:

- Show Metadata Diagnostics
- Clear Metadata Session Cache
- Clear Persisted Metadata Cache

These tools help developers verify metadata loading behaviour and recover quickly after schema changes.

---

# 🔐 Authentication

DV Quick Run uses **Azure CLI authentication**.

If you are already logged in with Azure CLI, the extension will reuse that token.

Login example:
    az login --allow-no-subscriptions

No client secrets or OAuth configuration required.

---

# 👥 Who Is This For?

DV Quick Run is designed for:

- Dataverse developers
- Dynamics 365 engineers
- Power Platform technical teams
- API developers integrating with Dataverse
- Integration engineers

---

# 🛠 Development

Run locally:
    npm install
    npm run compile

Press **F5** in VS Code to launch the **Extension Development Host**.

---

# 📜 License

MIT License

---

# 💡 Final Thought

DV Quick Run is built around one idea:

**The fastest Dataverse workflow is the one that never leaves the editor.**