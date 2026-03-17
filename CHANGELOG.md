# Change Log

All notable changes to the **DV Quick Run** extension will be documented in this file.

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/).

---

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