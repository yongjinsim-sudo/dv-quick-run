# DV Quick Run v0.15.3 — Phase 0 Fixture Specification

## Investigation Readiness & Evidence Gap Intelligence

**Version:** v0.15.3  
**Phase:** 0 — Specification & Golden Fixtures  
**Status:** Implemented  
**Date:** 22-Jul-2026  
**Fixture contract:** `investigation-readiness-phase0-fixtures-v1`  
**Golden scenario contract:** `investigation-readiness-phase0-golden-v1`

---

## Purpose

Phase 0 freezes the semantic inputs that Phase 1 contracts and Phase 2 engine behavior must satisfy.

It deliberately does not implement:

- the readiness request/result DTOs;
- readiness profile resolution;
- contributor normalization;
- gap evaluation;
- readiness posture calculation;
- confidence-effect execution;
- readiness rendering;
- persistence;
- MCP transport.

Those remain dependency-ordered Phase 1 and later work.

---

## Canonical Fixture Artifacts

### Catalogue fixture

```text
src/test/fixtures/readiness/readiness-phase0-catalogue.fixture.json
```

The catalogue locks:

- four readiness postures;
- seven contributor states;
- four contributor roles;
- four evidence-quality states;
- eight gap categories;
- three gap priorities;
- four readiness confidence effects;
- four synthesized confidence levels;
- exact Timeline and Cross-Diff profile matrices;
- exactly 18 initial gap rules;
- all 16 confidence transitions;
- the initial contextual freshness policies.

### Golden scenario fixture

```text
src/test/fixtures/readiness/readiness-phase0-golden-scenarios.fixture.json
```

The golden corpus locks one representative input and expected semantic result for each posture:

| Scenario | Investigation kind | Expected posture | Confidence effect |
|---|---|---|---|
| `cross-diff-ready` | Cross-Environment Diff | `Ready` | `Preserve` |
| `timeline-conditional` | Timeline | `Conditional` | `Qualify` |
| `cross-diff-limited` | Cross-Environment Diff | `Limited` | `Dampen` |
| `timeline-not-assessable` | Timeline | `NotAssessable` | `Withhold` |

The four scenarios collectively exercise all seven contributor states.

### Executable governance test

```text
src/test/readiness/investigationReadinessPhase0Fixtures.test.ts
```

The test prevents silent fixture drift. It validates vocabulary, matrices, rule count and identity, category coverage, confidence transitions, freshness policy, posture coverage, state coverage, gap/recommendation linkage, deterministic fingerprints and customer-neutral language.

---

## Locked Semantic Vocabulary

```text
Readiness postures
Ready | Conditional | Limited | NotAssessable

Contributor states
Available | Partial | PermissionLimited | Missing |
NotConsulted | Unsupported | Stale

Contributor roles
Primary | Required | Recommended | Optional

Evidence-quality states
Sufficient | Limited | Unknown | NotApplicable

Gap categories
Coverage | Permission | Provenance | Freshness | Scope |
Repeatability | Conflict | ContributorUnavailable

Confidence effects
Preserve | Qualify | Dampen | Withhold
```

No numeric readiness score is part of the Phase 0 corpus.

---

## Profile Matrix Lock

The catalogue contains the exact `1.0` matrices from the locked implementation plan.

### Timeline profile

- Primary: `timeline.reconstruction`
- Required: `timeline.understanding`, `timeline.trust`
- Recommended: `audit.evidence`, `identity.evidence`, `relationship.evidence`, `configuration.evidence`, `crossDiff.evidence`
- Optional: `query.evidence`, `metadata.evidence`

### Cross-Diff profile

- Primary: `crossDiff.comparison`
- Required: `crossDiff.sourceSnapshot`, `crossDiff.targetSnapshot`, `crossDiff.providerFindings`
- Recommended: `relationship.evidence`, `metadata.evidence`, `configuration.evidence`, `identity.evidence`, `audit.evidence`, `timeline.evidence`
- Optional: `query.evidence`

Applicability is expressed through structured identifiers in the fixtures. Phase 1 must not replace these conditions with free-text keyword matching.

---

## Gap Rule Lock

The shipped v1 catalogue is fixed at 18 rules:

| Rule family | Rule IDs |
|---|---|
| Coverage | `GAP-COVERAGE-001` through `GAP-COVERAGE-004` |
| Permission | `GAP-PERMISSION-001` through `GAP-PERMISSION-002` |
| Provenance | `GAP-PROVENANCE-001` through `GAP-PROVENANCE-002` |
| Freshness | `GAP-FRESHNESS-001` through `GAP-FRESHNESS-002` |
| Scope | `GAP-SCOPE-001` through `GAP-SCOPE-002` |
| Repeatability | `GAP-REPEATABILITY-001` through `GAP-REPEATABILITY-002` |
| Conflict | `GAP-CONFLICT-001` through `GAP-CONFLICT-002` |
| Contributor unavailable | `GAP-CONTRIBUTOR-001` through `GAP-CONTRIBUTOR-002` |

Every rule has one explicit fixture containing its category, priority, trigger, recommendation family, contributor role/state input and expected posture ceiling.

No Phase 1 registry may add, remove or rename a v1 rule without revising the implementation plan and golden fixtures.

---

## Confidence Transition Lock

The fixture contains the complete 4 × 4 transition matrix.

Permanent constraints:

- readiness never raises confidence;
- `Qualify` preserves the label and adds a limitation;
- `Dampen` lowers by at most one level;
- `Low + Dampen` remains `Low` with a severe limitation;
- only `Withhold` converts a known confidence level to `Unknown`;
- `Unknown` never becomes known;
- the strongest effect is applied once, not once per gap.

---

## Freshness Lock

Phase 0 includes no hidden global TTL.

Freshness is evaluated only from:

- provider-owned capture and intrinsic-validity semantics;
- profile-owned applicability and explicit constraints;
- the request's explicit `assessmentUtc`.

Historical age alone does not make Timeline Reconstruction stale. Audit event age alone does not make Audit Evidence stale. An absent threshold produces `Unknown` or `NotApplicable`, never invented staleness.

---

## Golden Fingerprint Canonicalization

Phase 0 locks the fixture fingerprint algorithm as:

```text
sha256-recursive-sorted-key-json-v1
```

For the golden corpus:

1. remove `generatedUtc` from the semantic request;
2. recursively sort object keys using ordinal key order;
3. preserve array order because arrays are contract-owned ordered values;
4. serialize compact JSON as UTF-8;
5. calculate SHA-256;
6. emit lowercase hexadecimal with the `sha256:` prefix.

`generatedUtc` is excluded because it must not change posture, gaps, recommendations or input identity. `assessmentUtc` remains included because freshness semantics may depend on it.

Phase 1 may extract the canonicalizer into a production utility, but it must reproduce the Phase 0 fingerprints byte-for-byte.

---

## Existing Contract Mapping Boundary

The source currently exposes coarse contributor availability through `investigation-input-v1` and Understanding Bundle v2. Phase 0 does not mutate those released contracts.

Phase 1 must introduce an explicit adapter that maps released contributor/provider facts into the normalized readiness IDs and states. The adapter must preserve original contributor IDs and evidence references. Unknown contributors remain inspectable and unmapped.

This prevents fixture design from silently rewriting persisted v0.15.2 inputs.

---

## Phase 0 Exit Evidence

- [x] Exact Timeline matrix is fixture-backed.
- [x] Exact Cross-Diff matrix is fixture-backed.
- [x] Exactly 18 rule fixtures exist.
- [x] All four postures have golden scenarios.
- [x] All seven contributor states are exercised.
- [x] All eight gap categories have rule fixtures.
- [x] All 16 confidence transitions are fixture-backed.
- [x] Initial freshness semantics are fixture-backed.
- [x] Golden inputs and expected semantic results are customer-neutral.
- [x] Fingerprints are deterministic and ignore `generatedUtc`.
- [x] No unresolved semantic marker remains in the fixture corpus.
- [x] No readiness engine, renderer, persistence or MCP runtime has leaked into Phase 0.

Phase 1 entry remains blocked if the executable fixture-governance test fails.

---

## Final Phase 0 Invariant

```text
Fixtures define the meaning.
Contracts encode the meaning.
The engine evaluates the meaning.
Renderers only present the meaning.

Evidence remains canonical.
Readiness does not certify truth.
```
