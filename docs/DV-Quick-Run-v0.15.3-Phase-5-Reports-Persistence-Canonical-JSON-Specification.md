# DV Quick Run v0.15.3 — Phase 5 Reports, Persistence and Canonical JSON

Status: Implemented and compatibility-tested  
Scope: Timeline and Cross-Environment Diff Mini RCA  
Entry: Phase 4 Timeline parity accepted

## Purpose

Phase 5 makes a generated Mini RCA a frozen investigation artifact instead of a live view over changing evidence. Markdown, HTML and JSON exports use one report instance for the active investigation surface. Evidence or readiness is recomputed only when the investigator selects **Regenerate Mini RCA**.

Readiness remains advisory. It does not certify truth, causality, completeness, remediation, deployment correctness or operational authority.

## Artifact Boundary

The canonical persisted envelope is `mini-rca-artifact-v1`:

| Field | Meaning |
|---|---|
| `kind` | Constant `dvqr-mini-rca-report` |
| `artifactVersion` | Constant `mini-rca-artifact-v1` |
| `persistence.state` | Constant `frozen` |
| `persistence.persistedAtIso` | Time at which this report assessment was generated |
| `persistence.regeneration` | Constant `explicit` |
| `persistence.investigationId` | Stable identity of the normalized investigation input |
| `persistence.sourceArtifactId` | Source Timeline or comparison identity when available |
| `persistence.readiness` | Frozen readiness contract/profile/timestamps/fingerprint reference |
| `investigationInput` | The normalized `investigation-input-v1` used for assessment |
| `report` | The complete `mini-rca-v2` report rendered by all formats |

The envelope is detached from mutable source models, recursively frozen in memory and serialized with recursively sorted object keys. Array order remains semantic and is preserved.

The JSON Schema is:

`src/pro/miniRca/persistence/mini-rca-artifact-v1.schema.json`

## Generation and Regeneration

1. The first Mini RCA HTML, Markdown or JSON action on an active surface normalizes the current investigation evidence.
2. Readiness is assessed with one generation timestamp and one assessment timestamp.
3. The input, readiness reference and report are frozen as one artifact.
4. Later HTML, Markdown and JSON actions on that surface reuse the same artifact.
5. Evidence changes do not silently refresh the artifact.
6. **Regenerate Mini RCA** explicitly creates a new artifact from the current source evidence.
7. The previously saved files remain unchanged.
8. Opening another Timeline or comparison starts a new surface session and clears the in-memory artifact.

Mini RCA filenames use the frozen artifact generation time with second-level precision (`YYYY-MM-DD-HHMMSS`). HTML, Markdown and JSON from one frozen artifact therefore share one timestamped basename. Explicit regeneration produces a new basename, while repeated export of the same unchanged artifact remains stable.

No hosted upload or automatic background refresh is part of v0.15.3.

## Format Parity

| Format | Source | Role |
|---|---|---|
| Markdown | `artifact.report` | Human-readable investigation report |
| HTML | `artifact.report` | Progressive-disclosure investigation report |
| JSON | complete artifact | Canonical machine-readable persisted boundary |

The Markdown and HTML main sections show the posture, confidence effect and at most the first three material readiness gaps/recommendations. Their Appendices retain the complete contributor states, quality dimensions, canonical gap IDs, recommendation IDs, timestamps and input fingerprint. JSON retains the entire input and report.

## Historical Compatibility

`parseMiniRcaArtifactJson` accepts:

- a `mini-rca-artifact-v1` envelope; or
- a historical raw `mini-rca-v2` report.

A historical report without `investigationReadiness` remains without readiness. Parsing and rendering never synthesize or backfill a current assessment. Unsupported JSON fails with a deterministic error instead of being guessed into a report shape.

## Implementation Map

| Concern | Location |
|---|---|
| Artifact DTO | `src/pro/miniRca/persistence/miniRcaArtifactTypes.ts` |
| Generation, regeneration and compatibility reader | `src/pro/miniRca/persistence/miniRcaArtifactService.ts` |
| Canonical serializer | `src/pro/miniRca/persistence/miniRcaArtifactSerializer.ts` |
| Artifact JSON Schema | `src/pro/miniRca/persistence/mini-rca-artifact-v1.schema.json` |
| Timeline frozen-session integration | `src/commands/timeline/timelineSurfaceController.ts` |
| Cross-Diff frozen-session integration | `src/commands/comparison/comparisonSurfaceController.ts` |
| Markdown/HTML progressive disclosure | `src/pro/miniRca/miniRcaMarkdownRenderer.ts`, `src/pro/miniRca/miniRcaHtmlRenderer.ts` |
| Persistence and parity tests | `src/test/readiness/miniRcaArtifactPersistence.test.ts` |

## Phase 5 Exit Evidence

Automated tests demonstrate:

- canonical JSON is deterministic and validates against the artifact schema;
- Markdown, HTML and JSON resolve to the same report;
- generated artifacts and their nested report data are immutable;
- changed source evidence does not mutate or silently replace a persisted artifact;
- explicit regeneration creates a new assessment while preserving the old one;
- historical raw reports render without fabricated readiness;
- the main readiness section is concise and the Appendix contains every canonical gap;
- report boundary wording remains non-remediating;
- both report menus expose JSON persistence and explicit regeneration.

Manual review should verify:

- HTML disclosure controls keep the initial page scannable;
- Markdown reads coherently before the Appendix;
- JSON saved from both surfaces opens as valid UTF-8 and has the same report timestamp, posture and evidence as HTML/Markdown exported before regeneration;
- exporting after evidence changes but before regeneration remains byte-identical for JSON;
- selecting regeneration changes the artifact timestamp and includes the current evidence.
