# DV Quick Run v0.15.3 — Phase 1 Contract Specification

Status: Implemented and contract-tested

Authority:

- `DV Quick Run — Implementation Plan v0.15.3`
- Phase 0 catalogue and golden scenarios
- schema identity `dvqr.investigation-readiness`, version `1.0`

## Delivered Boundary

Phase 1 establishes a host-independent application contract for Investigation Readiness. It does not assess readiness. Contributor normalization, quality evaluation, freshness evaluation, gap evaluation, posture, confidence transitions, recommendations and invariant validation remain Phase 2 work.

The application boundary accepts only plain serializable data:

- `investigation-readiness-request-v1`
- canonical `investigation-input-v1` data
- released `understanding-bundle-v2` data
- a readiness profile ID and version
- explicit `assessmentUtc` and `generatedUtc` values

The boundary emits either:

- `investigation-readiness-v1`; or
- `investigation-readiness-error-v1`.

No VS Code, webview, renderer, filesystem, network or Pro implementation type appears in the contract layer.

## Source Layout

| Area | Source |
|---|---|
| DTOs and closed vocabularies | `src/core/readiness/readinessContracts.ts` |
| Profile and rule descriptor contracts | `src/core/readiness/readinessProfile.ts` |
| Profile resolver | `src/core/readiness/readinessProfileResolver.ts` |
| Timeline profile v1 | `src/core/readiness/profiles/timelineReadinessProfileV1.ts` |
| Cross-Diff profile v1 | `src/core/readiness/profiles/crossDiffReadinessProfileV1.ts` |
| Seven explicit freshness policies | `src/core/readiness/readinessFreshnessRules.ts` |
| Six quality rule descriptors | `src/core/readiness/readinessQualityRules.ts` |
| Canonical 18-rule registry | `src/core/readiness/gaps/gapRuleRegistry.ts` |
| Draft 2020-12 JSON Schema | `src/core/readiness/serialization/investigation-readiness-v1.schema.json` |
| Canonical serializer and fingerprint skeleton | `src/core/readiness/serialization/` |
| Contract snapshots | `src/test/fixtures/readiness/readiness-phase1-contract-snapshots.fixture.json` |
| Host-independent tests | `src/test/readiness/investigationReadinessContracts.test.ts` |

## Version and Compatibility Rules

- Both initial profiles are version `1.0`.
- Unknown profile IDs fail with `InvalidInput`.
- Known profiles requested with another version fail with `UnsupportedProfileVersion`.
- A profile/investigation-kind mismatch fails with `InvalidInput`.
- Unsupported input versions are reserved for the `UnsupportedInputVersion` error envelope during Phase 2 request validation.
- Changing a contributor role, applicability condition, freshness rule, or the 18-rule registry requires profile/fixture compatibility review.
- Permission-limited, missing, not-consulted, unsupported and stale evidence are modeled readiness inputs; they are not contract errors.

## Serialization Rules

The serializer skeleton uses recursive ordinal key sorting and preserves array order. It rejects non-finite numbers, unsupported JavaScript values and cyclic data.

The request fingerprint is SHA-256 over canonical semantic request JSON:

- `generatedUtc` is excluded;
- `assessmentUtc` is included;
- no system clock is read;
- all four Phase 0 golden fingerprints are reproduced exactly.

## Phase 1 Exit Evidence

The Phase 1 contract suite proves:

- all four Phase 0 golden requests validate against the request schema;
- result and all four structured error variants validate against the schema;
- both versioned profiles validate and match the locked Phase 0 matrices;
- all seven freshness policies match their locked ownership and fallback semantics;
- exactly 18 unique gap rule IDs validate and match the locked catalogue;
- profile and registry canonical hashes are snapshot-locked;
- canonical serialization reproduces every Phase 0 input fingerprint;
- `generatedUtc` does not affect the semantic fingerprint;
- readiness core source contains no VS Code or UI/Pro application import.

Phase 1 has no user-facing surface, so no product UI manual-verification step is introduced by this phase.
