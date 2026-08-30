# DVQR Permanent Adversarial Regression Suite

This directory is the permanent v0.16.2 adversarial security regression layer.

## Purpose

The suite proves application-code invariants at the model ↔ MCP ↔ DVQR ↔ Dataverse trust boundary. It does not create a second security engine. Production capability policy, entitlement, environment binding, traversal budgets, Business Path governance, persistence, evidence semantics, and redaction remain authoritative.

`npm test` is the canonical command that exercises this suite together with the full DVQR regression estate.

## A01–A20 ownership

The machine-readable ownership registry is `adversarialRegressionManifest.ts`. Every attack family has one primary owner test file and may have supporting owners.

Test names that exercise a taxonomy family should begin with the family ID, for example:

`A06 rejects a stale environment override before provider execution`

Use stable IDs inside `AdversarialCase` definitions where the harness is appropriate:

`A06-ENVIRONMENT-001`

Do not renumber an existing permanent case merely because a new case is inserted.

## Fixture ownership

Reusable hostile inputs live under `src/test/security/fixtures/`.

- `hostileText.ts` — instruction-like and control-like untrusted text.
- `hostileMetadata.ts` — hostile metadata labels/descriptions.
- `hostileBusinessPaths.ts` — malicious persisted Business Path shapes.
- `malformedIdentifiers.ts` — identifier/path/query-shaped IDs.
- `oversizedPayloads.ts` — depth/width/query/array bounds.
- `pathologicalGraphs.ts` — cycles, depth and fan-out.
- `providerErrors.ts` — deterministic provider failures and fake sentinel secrets.

Prefer shared fixtures over one-off random payloads when the same attack shape can recur.

## Determinism rules

Permanent adversarial tests must not depend on wall-clock timing, sleeps, random numbers, network access, customer tenants, or real credentials. Use fixed clocks, fixed IDs, local temporary workspaces, deterministic fake sentinels, and stubbed providers.

Tests may use OS temporary directories for isolation. They must clean them up and must not depend on the generated directory name.

## Forbidden side effects

Where practical, use `runAdversarialCase()` and `AdversarialEffectRecorder` to assert the absence of effects such as provider calls, mutation, wrong-environment calls, hidden continuation, alternative path execution, extra budget consumption, workspace escape, secret exposure, fabricated evidence, or BusinessPreferred mutation.

A rejected call is not considered secure merely because the returned error looks correct; the test should also prove that dangerous downstream effects did not occur.

## Failure diagnostics

Failure messages must identify the family/case and the violated invariant or forbidden effect. Keep diagnostics safe: no real tokens, customer data, environment secrets, or raw sensitive provider payloads.

## Customer-data rule

This directory must remain customer-neutral. Do not add customer organisation names, tenant URLs, custom table names copied from a customer, real GUIDs tied to customer records, or real credentials.

Use generic names such as `contact`, `account`, `careplan`, `task`, `example.crm.dynamics.com`, and deterministic fake IDs/secrets.

## Adding a future case

1. Choose the existing A01–A20 family that owns the threat.
2. Add the test to the primary owner unless a supporting owner is clearly a better architectural fit.
3. Reuse or add a deterministic shared fixture.
4. Assert the expected typed outcome.
5. Assert forbidden side effects.
6. Keep canonical production services under test; do not duplicate production security logic in the test.
7. Add a new owner only if responsibility genuinely moves, then update `adversarialRegressionManifest.ts`.
8. Run the full `npm test` suite.
9. Keep this directory free of customer-specific data and timing/network dependencies.

New threat families beyond A01–A20 require an explicit taxonomy/design update rather than an ad-hoc local label.
