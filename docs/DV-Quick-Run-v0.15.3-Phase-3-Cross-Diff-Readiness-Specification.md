# DV Quick Run v0.15.3 — Phase 3 Cross-Diff Readiness Vertical Slice

Status: Implemented and end-to-end tested  
Scope: Cross-Environment Diff only  
Timeline parity: Deferred to Phase 4

## Purpose

Phase 3 connects the host-independent Investigation Readiness engine to the existing Cross-Environment Diff Mini RCA pipeline. It preserves the established evidence, ranking, correlation and dominance semantics while adding an explicit advisory answer to a separate question:

> Is the supplied Cross-Diff evidence ready for bounded Mini RCA synthesis, what materially limits it, and what evidence should be collected next?

Readiness is not a numeric score, a root-cause claim, a remediation instruction or an authority decision.

## Implemented Flow

1. The existing Cross-Diff adapter preserves provider-owned differences and source/target orientation.
2. A stable semantic comparison identity becomes the canonical investigation ID and source-artifact ID.
3. Structured finding families make profile applicability explicit without free-text inference.
4. Source snapshot, target snapshot, provider findings and applicable domain contributors are normalized into the v1 Cross-Diff readiness profile.
5. Snapshot trust informs provenance only. Historical age does not imply staleness.
6. Stale and permission-limited states require explicit structured readiness context.
7. The Understanding Bundle v2 contributes synthesized confidence and limitations without changing provider confidence.
8. The core engine returns `investigation-readiness-v1` or a structured error envelope.
9. The Mini RCA report carries that response alongside the existing evidence and correlation models.
10. Markdown and HTML expose a compact advisory section and a complete technical appendix.

## Implementation Map

| Concern | Location |
|---|---|
| Cross-Diff input and explicit readiness context | `src/pro/miniRca/investigationInput/investigationInputTypes.ts` |
| Stable Cross-Diff identity and finding-family mapping | `src/pro/miniRca/investigationInput/crossDiffInvestigationInputAdapter.ts` |
| Readiness request adapter | `src/pro/miniRca/readiness/crossDiffReadinessAdapter.ts` |
| Mini RCA pipeline integration | `src/pro/miniRca/miniRcaEngine.ts` |
| Report contract | `src/pro/miniRca/miniRcaTypes.ts` |
| Markdown dogfooding output | `src/pro/miniRca/miniRcaMarkdownRenderer.ts` |
| HTML dogfooding output | `src/pro/miniRca/miniRcaHtmlRenderer.ts` |
| End-to-end tests | `src/test/readiness/crossDiffReadinessIntegration.test.ts` |

## Cross-Diff Contributor Mapping

| Contributor | Default mapping |
|---|---|
| `crossDiff.comparison` | Available only when qualifying provider findings exist; otherwise Missing |
| `crossDiff.sourceSnapshot` | Available with explicit source-oriented artifact reference |
| `crossDiff.targetSnapshot` | Available with explicit target-oriented artifact reference |
| `crossDiff.providerFindings` | Available only when normalized provider findings exist |
| `relationship.evidence` | Applicable and Available when structured relationship-family findings exist |
| `metadata.evidence` | Applicable and Available when structured metadata-family findings exist |
| `configuration.evidence` | Applicable and Available when structured configuration-family findings exist |
| `identity.evidence` | Applicable and Available when structured identity-family findings exist |
| `audit.evidence` | Not applicable unless structured intent requests audit, actor or change-time evidence |
| `timeline.evidence` | Not applicable unless structured intent requests temporal progression |
| `query.evidence` | Not applicable unless structured intent says runtime confirmation is attached |

Caller-supplied contributor roles and applicability do not override the profile.

## Source and Target Semantics

- Source and target labels, capture timestamps and evidence orientation remain distinct.
- Source limitations can produce only source contributor gaps.
- Target limitations can produce only target contributor gaps.
- Verified snapshot trust maps to sufficient provenance.
- Modified, invalid or legacy/unverified trust maps to limited provenance.
- Missing trust metadata remains Unknown rather than being invented as sufficient or stale.
- Snapshot capture age alone never produces `Stale`.
- Explicit staleness retains the inspectable snapshot evidence reference.

## Confidence and Ranking Boundary

Readiness writes:

- `baseSynthesizedConfidence`;
- `confidenceEffect`;
- `effectiveSynthesizedConfidence`;
- explicit confidence limitations.

It does not rewrite:

- provider-owned evidence confidence;
- provider significance;
- evidence weights;
- explanation scores;
- evidence or correlation percentages;
- Evidence Correlation Graph v1;
- dominance or non-dominance output;
- contributor ordering.

Changing only readiness context therefore changes only the readiness response and its presentation.

## Provisional Rendering

The main report contains a compact Investigation Readiness section:

- posture;
- confidence effect;
- base-to-effective synthesized confidence;
- material readiness gaps;
- evidence-focused next steps;
- permanent advisory boundary.

The appendix contains:

- contract and profile versions;
- semantic input fingerprint;
- contributor states;
- evidence-quality dimensions;
- canonical rule IDs;
- readiness recommendation IDs and wording.

Structured readiness errors are rendered as errors. A partially valid readiness result is never exposed.

## Phase 3 Exit Evidence

Automated tests demonstrate:

- Ready, Conditional, Limited and NotAssessable Cross-Diff scenarios pass end to end;
- source permission and target freshness gaps retain correct orientation;
- explicit stale snapshot evidence remains inspectable;
- requested permission-limited audit evidence produces a Medium advisory gap;
- no qualifying Cross-Diff findings produce the modeled NotAssessable result;
- fixed inputs and timestamps produce byte-equivalent readiness responses;
- provider evidence, ranking, correlation edges, dominance and numeric confidence remain unchanged when only readiness context changes;
- Markdown and HTML contain both the compact readiness section and technical trace;
- no numeric readiness score or remediation authority is introduced.

Phase 4 will apply the same readiness semantics to Timeline Reconstruction and Mini RCA.
