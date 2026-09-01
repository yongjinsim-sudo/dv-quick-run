# DV Quick Run

> **DV Quick Run v1.0.0 is here. 🎉**

**Understand Dataverse applications. Investigate operational behaviour. Stay grounded in evidence.**

DV Quick Run is a metadata-aware **Dataverse investigation workbench for VS Code** with an extension-owned **Local MCP server**. It brings querying, schema intelligence, relationship discovery, reusable Business Paths, operational evidence, professional investigation and bounded Mini RCA into one local-first workflow.

Instead of jumping between metadata browsers, query tools, logs, spreadsheets and disconnected AI conversations, DV Quick Run lets you move through the investigation as one explainable journey:

```text
understand
   ↓
query
   ↓
discover relationships
   ↓
verify real business paths
   ↓
collect evidence
   ↓
investigate
   ↓
assess readiness & gaps
   ↓
Mini RCA
   ↓
handoff / preserve
```

**Metadata-backed · Evidence-aware · Preview-first · Local-first · Human-controlled**

[Website](https://www.dvquickrun.com) · [Pricing](https://www.dvquickrun.com/pricing) · [GitHub Discussions](https://github.com/yongjinsim-sudo/dv-quick-run/discussions)

---

# 🎉 DV Quick Run v1.0.0

After evolving from a Dataverse query utility into a complete investigation workbench, **DV Quick Run has reached v1.0.0**.

v1 establishes the stable product contract for DVQR:

- understand unfamiliar Dataverse applications from metadata
- query and explain OData, FetchXML and `$batch`
- discover how tables actually relate
- test multi-hop routes against real records
- preserve verified routes as Managed Business Paths
- investigate operational behaviour with canonical evidence
- compare environments and reconstruct timelines
- inspect Operational Profiles, Access Context and execution evidence
- run persisted Professional Investigations
- assess evidence readiness and gaps
- generate bounded, evidence-backed Mini RCA
- talk to Dataverse through an extension-owned Local MCP server
- keep execution authority, evidence meaning and final judgement outside the model

This is not simply a version-number milestone. **v1 is the point where DVQR's query, understanding, traversal and investigation capabilities form one coherent product.**

---

## ✨ What Ships in v1.0.0

### 🧠 Metadata-Aware Dataverse Understanding
DVQR starts from Dataverse metadata rather than guessing schema semantics.

- deterministic table, column and relationship discovery
- navigation-property and polymorphic-lookup understanding
- business architecture and operational workflow intelligence
- capability and Custom API discovery
- confidence, provenance and uncertainty preserved

### 🔎 Query, Explain & Refine
- OData and FetchXML execution
- `$batch` workflows
- natural-language OData through Local MCP
- Query Doctor and Query Explain
- metadata-aware suggestions
- Query-by-Canvas refinement
- lookup-aware `$expand` guidance
- Result Viewer
- preview-first Smart PATCH in the editor

### 🧭 Relationship Intelligence & Guided Traversal
- discover and rank relationship paths
- resolve exact navigation properties
- Relationship Graph
- carry landed records from hop to hop
- distinguish metadata-valid from data-viable routes
- explain the exact frontier where traversal becomes empty

### 🛤️ Test Business Traverse & Managed Business Paths
One of v1's defining capabilities is turning discovered traversal knowledge into reusable workspace knowledge.

```text
discover candidate paths
        ↓
test against real records
        ↓
observe reached hops
        ↓
rank viable routes
        ↓
explicit Save
        ↓
Reverify metadata
        ↓
Runtime Verify exact saved route
        ↓
reuse / govern
```

DVQR keeps **metadata-valid**, **runtime-observed**, **ObservedNonEmpty**, **ObservedEmpty**, **NotReached**, **saved**, **Runtime Verified** and **BusinessPreferred** meaningfully separate.

If an exact route reaches an empty frontier, that route **STOPs**. DVQR does not silently substitute another relationship or turn the empty frontier into a table-wide query. Broader exploration requires an explicit new Business Path scope.

### 📊 Operational Profiles & DVQR Score
Operational Profiles provide a bounded, evidence-backed view of an entity's operational footprint, including relationship complexity, plugin orchestration, async participation, Power Automate/workflow involvement and managed-state context.

The **DVQR Score** is a calibrated investigation aid—not a risk, health or root-cause score.

### 👤 Access Context
Investigate bounded identity participation across users, application identities, teams, roles and business units.

Access Context does **not** simulate RBAC or claim effective record access.

### 📸 Evidence Workspace & Snapshot Library
Preserve snapshots, comparisons, Business Paths, reports, investigation artifacts and handoff material locally under `.dvforgelab`.

### 🔀 Cross-Environment Diff
Compare compatible evidence across environments, review grouped operational drift, preserve verification state and export investigation-ready reports.

### 🕒 Timeline Reconstruction & Audit Evidence
Reconstruct snapshot-bounded change intervals with Timeline Graph, trust, findings, handoff and optional Audit Evidence Enrichment.

First-observed drift is not presented as an exact historical change time or proof of causality.

### ⚙️ Custom API Intelligence & Governed Execution
- Functions vs Actions
- bound vs unbound operations
- metadata-backed definitions
- architecture recommendations
- execution readiness
- preview
- explicit confirmation
- guarded eligible execution
- execution interpretation

```text
discover → explain → preview → confirm → execute → inspect evidence
```

### 🧪 Professional Investigation
**Pro** turns individual evidence tools into a persisted investigation workflow.

```text
Start Investigation
      ↓
confirm / edit intent
      ↓
bounded Continue
      ↓
acquire explicit evidence
      ↓
inspect trace & evidence
      ↓
Readiness / Evidence Gaps
      ↓
Mini RCA
      ↓
verify / hand off
```

Professional Investigation coordinates. **Providers acquire evidence.** Resume restores state; it does not silently reacquire evidence.

### 🎯 Investigation Readiness & Evidence Gaps
DVQR keeps acquired, observed-zero, unavailable, unsupported, access-limited, failed, stale/historical and NotReached states distinct.

Evidence Gaps remain visible instead of being filled with confident prose.

### 🔬 Evidence Correlation
DVQR can correlate evidence across providers while preserving a permanent rule:

> **Participation is not causality.**

### 🧩 Mini RCA
Mini RCA synthesizes already-acquired evidence into bounded observations, hypotheses, limitations, verification recommendations and handoff material.

**Mini RCA is zero-acquisition. Regenerate Mini RCA is also zero-acquisition.**

DVQR stops at explanation and handoff rather than silently progressing into remediation or deployment.

### 🤖 Talk to Dataverse with Local MCP
DV Quick Run includes an extension-owned Local MCP server.

**v1 catalogue**
- **32 Free MCP tools**
- **32 Pro MCP tools**
- **64 tools total**

**Prompt Library**
- **69 Free prompts**
- **25 Pro prompts**
- **94 guided prompts total**

> **The model can propose work. DVQR decides what may execute and what the resulting evidence means.**

---

## 🚀 Three Ways to Use DV Quick Run

| Start here | Best for | What you get |
|---|---|---|
| **Prompt Library** | You know the outcome but not the DVQR capability | 94 guided prompts, parameters and next steps |
| **Local MCP** | You want to talk to Dataverse through an AI client | 64 metadata-aware, bounded investigation tools |
| **Editor Workbench** | You already have a query, record or investigation | Querying, Result Viewer, traversal, evidence and reports |

```text
DV Quick Run: Open Prompt Library
DV Quick Run: Open Hub
```

---

## 🆓 Free vs Pro

DV Quick Run follows an open-core model.

**Free is the investigation foundation. Pro accelerates and deepens professional investigation.**

```text
Free truth = Pro truth
Free safety = Pro safety
```

| Capability | Free | Pro |
|---|:---:|:---:|
| Prompt Library and Quick Starts | ✓ | ✓ |
| Deterministic metadata discovery | ✓ | ✓ |
| Natural-language OData and bounded GET | ✓ | ✓ |
| OData / FetchXML / `$batch` workbench | ✓ | ✓ |
| Query Doctor / Query Explain | ✓ | ✓ |
| Relationship Intelligence and Guided Traversal | ✓ | ✓ |
| Operational Profile + DVQR Score | ✓ | ✓ |
| Result Viewer | ✓ | ✓ |
| Managed Business Paths | ✓ | ✓ |
| Governed eligible Custom API execution | ✓ | ✓ |
| Persisted Professional Investigation |  | ✓ |
| Advanced investigation evidence acquisition |  | ✓ |
| Investigation Readiness / Evidence Gaps |  | ✓ |
| Cross-Environment Diff | Preview / samples where provided | ✓ |
| Timeline Reconstruction | Mock preview | ✓ |
| Audit Evidence Enrichment |  | ✓ |
| Mini RCA |  | ✓ |
| Advanced handoff/reporting workflows |  | ✓ |
| Online / Offline Pro licensing |  | ✓ |

A **14-day Pro Trial** is available for evaluating the complete investigation workflow.

---

## 🛡️ Built for Evidence, Not AI Guesswork

DVQR application code—not prompt text or model output—owns the active environment, registered capability, entitlement, canonical identifiers, execution bounds, workspace containment, confirmation requirements and evidence-state semantics.

Security hardening includes permanent deterministic adversarial regression across hostile content, capability spoofing, entitlement bypass, environment confusion, replay, unsafe tool chaining, traversal/resource abuse, path escape and diagnostic exfiltration scenarios.

This is engineering security qualification—not a security certification.

---

## 🛑 Guardrails That Matter

DVQR does not:

- silently persist Business Paths
- treat runtime success as BusinessPreferred
- substitute a different relationship during exact-route verification
- continue past an empty Business Path frontier
- treat NotReached as zero
- convert metadata validity into runtime truth
- convert participation into causality
- simulate effective RBAC
- treat first-observed drift as an exact historical timestamp
- treat audit rows as proof of causality
- allow Mini RCA to acquire evidence
- treat generated recommendations as execution authority
- automatically remediate or deploy from an investigation

**Humans retain operational authority.**

---

## 🌟 Why v1 Matters

DV Quick Run started with a simple idea: make Dataverse investigation faster without making it less trustworthy.

v1 brings the pieces together:

```text
query workbench
   + metadata intelligence
   + relationship understanding
   + runtime traversal
   + reusable Business Paths
   + evidence workspace
   + professional investigation
   + bounded AI assistance
   = DV Quick Run v1
```

The goal is not to make Dataverse investigation magical.

The goal is to make it **faster, more explainable, more repeatable and easier to hand off—without losing sight of what was actually observed.**

---

## 5-Minute Quick Start

### A. Run DV Quick Run normally

1. Install **DV Quick Run** in VS Code.
2. Configure and select a Dataverse environment.
3. Run a query such as:

   ```http
   contacts?$top=10
   ```

4. Open **DV Quick Run: Open Hub** whenever you need orientation.

### B. Enable Local MCP

1. Select the Dataverse environment to expose to the local server.
2. Run:

   ```text
   DV Quick Run: Enable Local MCP Server
   ```

3. Sign into the environment tenant with Azure CLI. For a tenant without an Azure subscription:

   ```bash
   az login --tenant <tenant-id> --allow-no-subscriptions
   ```

4. Open GitHub Copilot Chat and make sure the DV Quick Run MCP tools are enabled.
5. Open **DV Quick Run: Open Prompt Library**, or ask directly:

   ```text
   Using DV Quick Run, show me what I can investigate in this Dataverse environment and recommend where to start.
   ```

DV Quick Run remembers MCP enablement per workspace. VS Code starts the extension-owned local stdio server on demand.

---

## Local MCP

DV Quick Run owns its local MCP lifecycle inside the extension. The Hub shows the selected environment, mode, tool count, authentication guidance and traffic-light health state.

The foundational MCP surface is deliberately bounded. It supports metadata understanding, relationship intelligence, natural-language querying and evidence acquisition without turning the assistant into an unrestricted Dataverse administrator.

Typical prompts:

```text
Using DV Quick Run, find tables related to customers.

Using DV Quick Run, explain this OData query:
accounts?$select=name,revenue&$filter=statecode eq 0&$orderby=name asc&$top=10

Using DV Quick Run, starting only from Contact metadata, discover the business capabilities and explain where operational work is coordinated and performed.

Using DV Quick Run, find and runtime-verify a relationship path from account to task.
```

### Business Architecture Understanding

Operational Workflow Intelligence separates structural evidence into:

- **Core Domain** — principal business, service, case, plan or request concepts
- **Coordination** — journey, process, routing and orchestration records
- **Execution** — tasks, activities and downstream work items
- **Governance** — eligibility, consent, approval, safety and control records
- **Platform** — plugins, flows, asynchronous jobs and integration participation

Strong structural evidence does not prove that a particular record participated. Runtime evidence remains investigation-scoped and does not overwrite metadata confidence.

---

## Managed Business Paths

Managed Business Paths turn verified traversal knowledge into a reusable workspace asset.

```text
metadata-valid path
        ↓
runtime verification
        ↓
explicit save
        ↓
Preferred workspace path
        ↓
record-scoped exact-hop Guided Traversal
```

A Preferred path is **top visible**, not exclusive. Metadata-derived alternatives remain available. Preference records useful team knowledge; it does not replace Dataverse metadata truth or prove universal business authority.

Saved paths live under:

```text
.dvforgelab/dvqr/business-paths
```

The runtime frontier is intentionally bounded:

```text
landed record IDs → exact next relationship → landed record IDs
```

If a hop returns no rows, traversal stops. DVQR does not convert an empty frontier into a table-wide query.

---

## Result Viewer & Guided Traversal

The Result Viewer is the main interactive surface for exploring query results.

```text
start simple → run → explore → refine → investigate → verify
```

Use it to:

- view records as table or JSON
- search and inspect results
- refine queries
- launch record investigation
- open relationship navigation
- continue Guided Traversal
- inspect operational context
- preview compatible bound Actions
- export evidence and supported handoff artifacts

Guided Traversal carries actual landed records from hop to hop. Managed Business Paths can reuse the exact saved route from a supplied source record.

---

## Operational Profiles & DVQR Score

Operational Profiles describe the **operational footprint** of a Dataverse entity before deeper troubleshooting.

Profiles can surface:

- plugin orchestration density
- relationship complexity
- metadata footprint
- async participation
- Power Automate involvement
- workflow participation
- managed-state context

![Operational Profile](docs/entity-profile-card.png)

Profiles are entity-scoped, user-triggered, evidence-backed, bounded and advisory-only. The DVQR Score is a calibrated investigation aid, not a risk or root-cause score.

---

## Access Context

Access Context investigates bounded identity participation for:

- users and application identities
- teams
- roles
- business units

It can show business-unit context, direct and inherited participation, team membership and supporting evidence.

It does **not** simulate RBAC, calculate effective record access, generate privilege matrices or infer security risk.

---

## Managed Investigation

Pro managed investigations preserve professional investigation continuity rather than treating each prompt as an isolated answer.

```text
prepare & confirm
      ↓
acquire bounded evidence
      ↓
assess readiness
      ↓
generate bounded Mini RCA
      ↓
verify / hand off
```

The evidence model keeps supported, weakened and unresolved hypotheses distinct and preserves gaps rather than filling them with speculation.

---

## Evidence Workspace, Comparison & Timeline

DV Quick Run uses a local DV ForgeLab Evidence Workspace for investigation artifacts and reconstruction handoffs.

```text
.dvforgelab
└─ dvqr
   ├─ business-paths
   ├─ comparisons
   ├─ reports
   └─ snapshots
```

### Snapshot Library

Snapshot Library coordinates saved operational snapshots and comparison/timeline selection.

![Operational Snapshot Library](docs/snapshot-library.png)

### Cross-Environment Diff

Compare compatible snapshots across environments and review grouped operational drift with evidence references, verification state and handoff context.

### Timeline Reconstruction

Select 3+ compatible snapshots from the same environment and entity to reconstruct snapshot-bounded intervals and first-observed drift.

DVQR can surface:

- Timeline Graph
- provider and significance distributions
- Timeline Trust
- Timeline Findings Summary
- Timeline Investigation Handoff
- optional Audit Evidence Enrichment

Timeline findings describe **when drift was first observed between captures**. They do not claim an exact change time, root cause, human responsibility or remediation status.

---

## Capability Explorer & Governed Execution

Capability Explorer discovers and explains supported Dataverse operations and Custom APIs.

It distinguishes:

- Functions vs Actions
- bound vs unbound operations
- public vs private visibility
- preview-ready vs inspect-only capability
- execution eligibility
- operational-impact cautions

Supported execution follows:

```text
preview → explicit confirmation → execution → inspect result → investigate evidence
```

Custom API metadata is discovery truth; OData metadata is execution-exposure truth; bound route metadata is execution-route truth; the active environment remains the execution authority boundary.

AI-related operation execution is blocked by default unless explicitly allowed by policy, and generated output still requires human review.

---

## DV ForgeLab Ecosystem

DV Quick Run investigates. Other DV ForgeLab utilities reconstruct or execute focused changes through explicit handoff artifacts.

Supported ecosystem handoffs include:

- **DVBUR** — focused bulk upsert artifacts
- **DVAF** — supported attribute reconstruction intent
- **DVIM** — identity management artifacts
- **DVCE** — choice artifacts
- **DVEVM** — environment variable artifacts

Investigation and reconstruction remain separate concerns.

---

## Guardrails

DV Quick Run favours explicit, preview-first, user-controlled workflows.

Key boundaries include:

- bounded queries and explicit execution context
- no silent Managed Business Path persistence
- no broadening after an empty traversal frontier
- no causal claims from participation alone
- no effective-access claims from Access Context participation
- no cross-environment timeline reconstruction
- no treatment of first-observed drift as exact historical time
- no treatment of audit rows as proof of causality
- no treatment of reports or exports as approval/certification
- no treatment of reconstruction artifacts as automatic remediation
- explicit confirmation for supported execution-capable workflows

DV Quick Run does not treat generated or AI-assisted responses as operational truth. Human verification remains the authority boundary.

---

## Pro Activation

DV Quick Run is available in Free and Pro editions.

Pricing: https://www.dvquickrun.com/pricing

Purchase: https://dvforgelab.lemonsqueezy.com

Activate Online Pro from the Command Palette:

```text
DV Quick Run: Activate Pro License
```

Inspect entitlement:

```text
DV Quick Run: License Status
```

Restricted or disconnected environments can use signed Offline Pro licensing:

```text
DV Quick Run: Import Offline License
```

---

## Who Is This For?

- Dataverse / Dynamics 365 developers
- Power Platform engineers
- integration and API developers
- support engineers investigating Dataverse behaviour
- consultants working across complex Dataverse environments
- teams onboarding into unfamiliar Dataverse solutions

---

## Why DV Quick Run?

Because useful Dataverse investigation is more than running a query:

```text
understand → query → verify → investigate → compare → explain → hand off
```

DV Quick Run reduces tool switching while keeping metadata truth, runtime evidence, user preference, execution authority and human judgement explicitly separated.

---

## Community & Feedback

GitHub Discussions: https://github.com/yongjinsim-sudo/dv-quick-run/discussions

Official website: https://www.dvquickrun.com

Use Discussions to report bugs, suggest features, share workflow feedback, discuss investigation patterns and submit evidence edge cases.

---

## Development

```bash
npm install
npm run compile
```

Press **F5** to run the extension.

For direct developer MCP verification after compiling:

```powershell
npm run mcp:start
```

For interactive inspection:

```powershell
npm run mcp:inspect
```

Azure CLI authentication must already be available through `az login`.

---

## License & Open-Core Model

DV Quick Run follows an open-core model.

The MIT-licensed core preserves foundational Dataverse understanding workflows. Proprietary Pro modules provide advanced investigation acceleration, persistence, comparison, timeline, reporting and governed execution capabilities.

```text
/src/core
MIT open-core functionality

/src/pro
Private proprietary acceleration modules
Not included in the public repository or MIT grant
```

Foundational operational understanding remains accessible. Commercial acceleration funds continued development.
