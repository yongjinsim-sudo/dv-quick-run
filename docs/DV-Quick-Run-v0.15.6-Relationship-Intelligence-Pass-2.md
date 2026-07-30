# DV Quick Run v0.15.6 — Relationship Intelligence Pass 2

## Purpose

Pass 2 makes relationship guidance more deterministic and portable across MCP hosts. It does not introduce learned or workspace-persisted business paths.

## Implemented

- Added a shared relationship guidance contract.
- Added an explicit recommendation basis:
  - `ExplicitRelationshipIntent`
  - `DeterministicRanking`
- Added path-shape and business-category summaries.
- Added a clear instruction not to substitute another relationship when an exact hint was honoured.
- Added an evidence boundary explaining that metadata ranking does not prove business meaning or row-level data availability.
- Added explicit runtime-probe outcomes:
  - `TargetObserved`
  - `NoContinuationObserved`
- Added target record counts and actionable no-match guidance.
- Bumped relationship MCP contracts additively:
  - relationship paths v5
  - relationship query v5
  - relationship probe v3

## Invariants

- Metadata remains canonical.
- A relationship hint never silently falls back to another path.
- Runtime no-match does not invalidate metadata.
- Runtime probing remains bounded and read-only.
- Suggested business meaning is explanatory, not persisted organisational knowledge.

## Verification

- Compile and run the full unit test suite.
- Verify Contact → Task returns a deterministic recommendation basis.
- Verify an explicit `parentcustomerid` hint produces `ExplicitRelationshipIntent` and a no-substitution instruction.
- Probe a path using a source row with matching records and confirm `TargetObserved` plus target count.
- Probe a valid path using a row with no continuation and confirm `NoContinuationObserved` without invalidating the metadata path.
