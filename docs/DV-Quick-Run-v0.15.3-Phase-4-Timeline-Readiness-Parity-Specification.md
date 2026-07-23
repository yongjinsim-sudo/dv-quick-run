# DV Quick Run v0.15.3 — Phase 4 Timeline Readiness Parity

Status: Implemented and parity-tested  
Scope: Timeline Reconstruction Mini RCA  
Entry: Phase 3 Cross-Diff readiness semantics accepted

## Purpose

Phase 4 connects the host-independent Investigation Readiness engine to the Timeline Mini RCA pipeline. It applies the same canonical state, quality, gap, priority, posture and confidence-effect meanings as Cross-Diff while preserving Timeline-specific evidence boundaries.

Readiness remains advisory. It does not change provider evidence, rank explanations, assert an exact change time, certify causality or authorize remediation.

## Implemented Flow

1. Timeline Reconstruction is adapted through `investigation-input-v1`.
2. Existing Timeline events remain the qualifying Primary evidence.
3. Timeline Understanding and Timeline Trust are normalized as Required contributors.
4. Structured provider identifiers map attached domain evidence to normalized contributors.
5. Structured investigation intent controls audit, identity, relationship, configuration, Cross-Diff, query and metadata applicability.
6. First-observed intervals remain bounded observation windows and do not imply an actor or exact-change-time request.
7. Historical event or artifact age does not produce `Stale` without an explicit freshness rule, validity window or input-identity mismatch.
8. The Timeline Mini RCA report carries `investigation-readiness-v1` alongside the existing evidence, correlation, outcome and confidence models.
9. Existing Markdown and HTML readiness sections render the Timeline result additively.
10. Historical Timeline reports without readiness continue through the `timeline-native` rendering path.

## Implementation Map

| Concern | Location |
|---|---|
| Timeline readiness intent and overrides | `src/pro/miniRca/investigationInput/investigationInputTypes.ts` |
| Timeline investigation adapter | `src/pro/miniRca/investigationInput/timelineInvestigationInputAdapter.ts` |
| Timeline readiness request adapter | `src/pro/miniRca/readiness/timelineReadinessAdapter.ts` |
| Mini RCA integration | `src/pro/miniRca/miniRcaEngine.ts` |
| Additive Markdown/HTML boundary metadata | `src/pro/miniRca/miniRcaMarkdownRenderer.ts`, `src/pro/miniRca/miniRcaHtmlRenderer.ts` |
| End-to-end parity tests | `src/test/readiness/timelineReadinessIntegration.test.ts` |

## Timeline Contributor Mapping

| Contributor | Default mapping |
|---|---|
| `timeline.reconstruction` | Available only when qualifying normalized Timeline event evidence exists; otherwise Missing and NotAssessable |
| `timeline.understanding` | Available for Ready or InspectOnly reconstruction with qualifying events; Missing for Blocked or no qualifying events |
| `timeline.trust` | Available with sufficient provenance when Verified; evidence-bearing Partial with limited provenance when unresolved |
| `audit.evidence` | Applicable only when audit or actor/change-time intent is explicit |
| `identity.evidence` | Applicable when structured identity participation evidence is attached or scope is explicit |
| `relationship.evidence` | Applicable when structured relationship evidence is attached or scope is explicit |
| `configuration.evidence` | Applicable when structured workflow, automation, environment-variable or configuration evidence is attached or scope is explicit |
| `crossDiff.evidence` | Applicable when structured environment-drift evidence is linked or scope is explicit |
| `query.evidence` | Optional and applicable only when runtime/query confirmation is attached |
| `metadata.evidence` | Optional when metadata context is attached and is not owned by another contributor |

Provider identifiers are preserved in `sourceContributorIds` and evidence references. Unknown provider families remain evidence; they are not silently assigned a readiness role.

## Trust Semantics

- `Verified` maps to Available with sufficient provenance and coverage.
- `Partially Verified`, `Unverified` and `Invalid` remain inspectable as Partial evidence with a High provenance limitation.
- InspectOnly is a trust boundary, not an independent Timeline Understanding coverage limitation.
- Trust limitations do not delete Timeline evidence.
- Trust does not alter provider significance, explanation scores or confidence percentages.
- A caller may supply explicit structured freshness, scope, permission, repeatability or conflict context; the canonical core rules still decide the resulting gap.

## Audit and Interval Semantics

- A first-observed interval means only that a difference was observed between two snapshots.
- It does not identify the actor, exact change time, intent or causal sequence.
- Audit is Recommended only when `auditRequested` or `actorOrChangeTimeRequested` is true.
- Missing or permission-limited applicable audit evidence produces the same Medium category and priority semantics as Cross-Diff.
- Audit event age alone is not staleness.
- Explicit interval coverage limitations can be supplied through the audit contributor quality context.

## Parity Boundary

Equivalent limitations reuse the same canonical rule meanings:

| Shared limitation | Timeline example | Cross-Diff example | Canonical result |
|---|---|---|---|
| Recommended evidence permission-limited | `audit.evidence` | `audit.evidence` | `GAP-PERMISSION-002`, Permission, Medium, Conditional |
| Required evidence explicitly stale | `timeline.understanding` | `crossDiff.targetSnapshot` | `GAP-FRESHNESS-001`, Freshness, High, Limited |
| No qualifying Primary evidence | `timeline.reconstruction` | `crossDiff.comparison` | `GAP-COVERAGE-001`, Coverage, High, NotAssessable |

Profile-specific contributor expectations differ; state, quality, rule, priority and posture meanings do not.

## Backward-Compatibility Boundary

Changing only Timeline readiness context does not change:

- normalized Mini RCA evidence;
- explanation ordering or scores;
- most-probable or competing explanations;
- Evidence Correlation Graph nodes, edges or summary;
- dominant or non-dominant outcome;
- numeric evidence, correlation or recommendation confidence;
- first-observed interval wording;
- shared recommendation ordering.

The only additive changes are the structured readiness response, its advisory rendering, and Timeline investigation-input contract metadata. A historical report without `investigationReadiness` still renders without a readiness section and retains the native Timeline boundary label.

## Phase 4 Exit Evidence

Automated tests demonstrate:

- Ready, Conditional, Limited and NotAssessable Timeline scenarios pass end to end;
- permission and freshness parity with Cross-Diff uses identical canonical rule/category/priority meanings;
- unresolved Timeline trust produces an evidence-bearing High provenance gap;
- historical age remains non-stale without an explicit rule;
- first-observed intervals do not make audit applicable;
- no-dominant-contributor behavior remains independent from readiness;
- provider evidence, ranking, correlation, dominance and numeric confidence remain unchanged when only readiness context changes;
- fixed inputs and timestamps produce deterministic readiness output;
- current reports render additive readiness while historical reports remain compatible.
