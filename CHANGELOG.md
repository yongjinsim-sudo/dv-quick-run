# Change Log

All notable changes to the **DV Quick Run** extension will be documented in this file.

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/).

---

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