# DV Quick Run v0.15.6 — Relationship Intelligence Pass 3

## Scope

Pass 3 addresses two issues found through Visual Studio 2026 enterprise dogfooding:

1. Relationship queries generated as record-navigation paths, such as `contacts(<guid>)/Contact_Tasks`, were rejected by `dvqr_execute_odata` because the parser did not expose an entity set for that valid OData shape.
2. Metadata confidence was easy for an MCP host to misread as business confidence.

## Changes

- `dvqr_execute_odata` now accepts bounded Dataverse record-navigation queries by independently resolving the root entity set.
- Relationship contracts explicitly label confidence as `MetadataConfidence`.
- Business confidence is emitted as `UnknownFromMetadata` unless the caller explicitly selected a relationship.
- Guidance uses “top metadata-ranked traversal” rather than “recommended business path”.
- Generic activity/Regarding relationships are described as metadata relationship semantics only; DVQR does not claim they are the organisation's primary business interpretation.
- Contract versions advanced additively:
  - relationship paths v6
  - relationship query v6
  - relationship probe v4

## Evidence boundary

Metadata proves relationship existence, direction and navigation-property resolution. It does not prove organisational business preference or row-level data availability.
