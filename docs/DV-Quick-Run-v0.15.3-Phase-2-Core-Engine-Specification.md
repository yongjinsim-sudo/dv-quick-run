# DV Quick Run v0.15.3 — Phase 2 Core Readiness Engine

Status: Implemented and golden-tested

Authority:

- `DV Quick Run — Implementation Plan v0.15.3`
- Phase 0 catalogue and golden scenarios
- Phase 1 contract, profiles, schema and 18-rule registry

## Delivered Boundary

Phase 2 implements the host-independent Investigation Readiness engine. It consumes canonical `investigation-input-v1`, Understanding Bundle v2 data and a versioned readiness profile. It performs no Dataverse retrieval, editor operation, rendering, persistence or product-surface integration.

The engine now performs this deterministic sequence:

1. Validate contract and input versions.
2. Resolve the versioned profile.
3. Normalize profile contributors and preserve unknown contributors without assigning a known role.
4. Evaluate six categorical evidence-quality dimensions.
5. Apply explicit freshness semantics without a global TTL.
6. Evaluate registered gaps with specific-rule precedence.
7. De-duplicate and canonically order gaps.
8. Resolve the conservative readiness posture.
9. Apply one confidence effect through the locked transition matrix.
10. Produce evidence-only recommendations through the shared recommendation primitives.
11. Validate canonical result invariants.
12. Return `investigation-readiness-v1` or a structured error envelope.

## Source Layout

| Responsibility | Source |
|---|---|
| Headless service | `src/core/readiness/investigationReadinessService.ts` |
| Structured applicability | `src/core/readiness/readinessConditionEvaluator.ts` |
| Contributor normalization | `src/core/readiness/contributorStateNormalizer.ts` |
| Quality evaluation | `src/core/readiness/quality/readinessQualityEvaluator.ts` |
| Gap evaluation and precedence | `src/core/readiness/gaps/gapEvaluator.ts` |
| Stable gap identity | `src/core/readiness/gaps/gapIdentity.ts` |
| Canonical gap ordering | `src/core/readiness/gaps/gapOrdering.ts` |
| Posture resolution | `src/core/readiness/readinessPostureResolver.ts` |
| Confidence transition | `src/core/readiness/readinessConfidenceEffect.ts` |
| Evidence recommendations | `src/core/recommendations/readinessRecommendationRules.ts` |
| Fail-closed invariants | `src/core/readiness/readinessInvariantValidator.ts` |
| Golden engine tests | `src/test/readiness/investigationReadinessEngine.test.ts` |
| Canonical result hashes | `src/test/fixtures/readiness/readiness-phase2-engine-snapshots.fixture.json` |

## Normalization Rules

- Profile roles override caller-supplied role labels.
- Applicability uses structured intent flags and finding-family fields only; free-text keyword matching is prohibited.
- Missing, NotConsulted and PermissionLimited remain distinct states.
- Unknown contributor IDs remain inspectable as non-applicable Optional/Unsupported contributors; no known role is inferred.
- `Available` without a qualifying evidence reference becomes `Partial` with an explicit limitation.
- Stale evidence retains its evidence references.
- A supplied Stale label requires an explicit freshness rule, provider validity or source-input mismatch. Without one, freshness remains Unknown rather than inventing staleness.
- Historical Timeline event age alone never creates a Stale state.

## Quality and Gap Semantics

The engine emits all six quality dimensions in fixed order:

1. Provenance
2. Coverage
3. Freshness
4. Scope
5. Repeatability
6. Consistency

Quality remains categorical: Sufficient, Limited, Unknown or NotApplicable.

Gap evaluation uses only the 18 registered v1 rule IDs. Permission, Freshness, Provenance, Scope and Conflict rules suppress duplicate generic coverage or contributor-unavailable gaps for the same contributor condition. No qualifying Primary evidence short-circuits to the modeled `GAP-COVERAGE-001` NotAssessable outcome.

Gap identity hashes the canonical subject, rule ID and sorted contributor IDs. Generated timestamps and display wording do not affect identity. Ordering is priority, category, rule ID, contributor ID and stable gap ID using ordinal comparison.

## Posture and Confidence

The posture resolver is non-numeric and conservative:

- no qualifying Primary evidence → NotAssessable;
- any High gap → Limited;
- otherwise any Medium gap → Conditional;
- otherwise → Ready.

The engine applies one default confidence effect:

- Ready → Preserve;
- Conditional → Qualify;
- Limited → Dampen;
- NotAssessable → Withhold.

Dampen lowers High to Medium or Medium to Low once. Low remains Low with a severe limitation. Unknown remains Unknown. Only Withhold converts known synthesized confidence to Unknown. Provider evidence confidence, Evidence Correlation and dominance are neither readjusted nor mutated.

## Recommendation Boundary

Recommendations are derived from registered gap recommendation families and use the existing shared stable-ID and de-duplication primitives. They remain limited to evidence acquisition, authorised retry, refresh, scope alignment, provenance capture, repeatability and conflict verification. The invariant validator rejects repair, deployment, approval, execution, apply, blame or certification actions.

Every recommendation links to its source gaps, and every gap links back to its recommendations.

## Determinism and Failure Behavior

- No system clock is read.
- No network, filesystem, editor, renderer or VS Code API is used by the service.
- Contributor and evidence-reference inputs are normalized into canonical order.
- Semantic request fingerprints ignore `generatedUtc` and normalize profile contributor order.
- Fixed timestamps produce byte-equivalent canonical results.
- Duplicate contributor/evidence IDs and malformed inputs fail closed.
- Unsupported input/profile versions return structured errors.
- Result invariant failures return `ContractViolation`; partially valid results are never exposed.

## Phase 2 Exit Evidence

Automated tests demonstrate:

- all four Phase 0 golden outcomes match exactly;
- all four complete canonical results have snapshot-locked SHA-256 hashes and byte sizes;
- all seven contributor states remain distinct;
- both profile applicability and caller-role resistance work;
- freshness Unknown/Stale ownership is deterministic;
- historical age does not imply staleness;
- provenance, permission, coverage, freshness, scope, repeatability and conflict rules are exercised;
- specific gap precedence suppresses duplicate generic gaps;
- all 16 confidence transitions match the locked matrix;
- multiple High gaps dampen confidence once;
- recommendation wording and cross-references pass invariants;
- shuffled contributor input produces byte-equivalent canonical output;
- assessment does not mutate the request;
- generated time does not alter semantic fingerprints or gap identity;
- every golden result validates against the Phase 1 JSON Schema;
- the Phase 2 service contains no host or side-effect imports.

Phase 2 introduces no user-facing surface. Cross-Diff adapter and provisional rendering integration remain Phase 3 work.
