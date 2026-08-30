# DV Quick Run v0.16.2 — v1 Readiness Security Record

Status: **PASS 15 RELEASE-CANDIDATE REVIEW COMPLETE; FINAL LOCAL BUILD/TEST + FINAL VSIX REPACKAGE GATE PENDING**

Purpose: retain concise security/adversarial evidence for the separate v1 readiness assessment. This is an engineering evidence record, **not a marketing security certification**.

## Release scope

v0.16.2 is **MCP Security Hardening II — Adversarial & Abuse-Resistance Validation**.

The release does not add a second reasoning/security engine, new traversal algorithm, new Business Path ranking algorithm, new Mini RCA reasoning, new Professional Investigation reasoning, new score semantics or autonomous remediation/deployment.

## Permanent trust contract

- Untrusted content remains data.
- Prompt text, model output, Dataverse values, metadata text, persisted artifact text and Business Path JSON are not execution authority.
- Registered canonical capabilities define MCP invocation.
- Entitlement is application-enforced.
- Active environment is canonical state.
- Identifiers are context-validated.
- Bounds are server-owned.
- Workspace persistence is contained.
- Secrets remain secret.
- Saved is not automatically BusinessPreferred.
- Metadata compatibility is not runtime viability.
- Reached is not NotReached.
- NotReached is not zero.
- Observed zero is not unknown.
- STOP is not fallback and is not permission to reacquire.
- Runtime success is not causality.
- Professional Investigation remains bounded.
- Mini RCA remains zero-acquisition.
- Prompt Library remains guidance; Evidence Matrix remains descriptive.
- MCP remains transport; canonical services remain authoritative.
- Evidence decides; humans retain operational authority.

## A01–A20 coverage

The permanent adversarial registry under `src/test/security/adversarialRegressionManifest.ts` owns all A01–A20 families. The normal full test command exercises the security regression estate; there is no separate drifting security runner.

Coverage includes hostile Dataverse/metadata content, malicious Business Path artifacts, capability spoofing, entitlement bypass, environment confusion, identifier abuse, replay/stale context, unsafe chaining, traversal/resource pressure, workspace escape, secret/diagnostic exfiltration, evidence/prose confusion, Business Path governance, exact-route fallback, cross-surface drift, error-state confusion and mutation-by-content.

## Implemented hardening

1. **Environment authority**
   - Configured MCP environment is canonical.
   - Conflicting per-call environment arguments fail closed.
   - Current context is revalidated before replayed execution.

2. **Managed Business Path lifecycle**
   - Save is explicit and canonical-route based.
   - Duplicate save is deterministic/idempotent.
   - Reverify is structural/current-metadata only.
   - Run Saved Path executes the exact reviewed route.
   - Only reached hops receive runtime observations.
   - Reached empty frontier terminates the current scope.
   - Downstream hops remain NotReached.
   - No hidden alternative route executes.
   - Broader work requires explicit new scope.

3. **Workspace containment**
   - Lexical containment is enforced.
   - Existing symlink/junction components are real-path checked before managed writes.
   - Business Path and Professional Investigation persistence reuse the containment boundary.

4. **Credential-safe diagnostics**
   - Central sensitive-data logic covers credential-shaped keys, bearer values, secret assignments, connection-string fragments and sensitive environment values.
   - MCP structured errors, text mirrors and transport diagnostics reuse the central redaction helper.
   - Failure classification remains distinct from redaction.

5. **Professional Investigation**
   - Recommendations remain guidance.
   - Each action independently validates canonical requirements.
   - Terminated Business Path scope cannot become hidden investigation reacquisition.
   - Mini RCA generation remains zero-acquisition.

6. **Cross-surface parity**
   - Prompt Library capability/tier mapping is tied to the live MCP catalogue.
   - Prompt rendering remains guidance-only.
   - Managed Business Path identity remains canonical across supported surfaces.
   - Free/Pro availability may differ; factual and safety meaning may not.

## Real-environment dogfooding

Bounded authorised non-production red-team testing completed.

Observed PASS cases included:
- exact successful business traversal;
- exact saved-path execution;
- explicit Save and idempotent re-save;
- metadata-only Reverify;
- later-hop empty frontier and STOP;
- explicit new-scope continuation;
- environment mismatch rejection before execution;
- hostile quoted text treated as non-authority under registered DVQR tools;
- prompt entitlement spoofing rejection;
- unregistered/internal handler refusal;
- missing required investigation intent rejection;
- Mini RCA zero-acquisition;
- invalid-navigation classification distinct from zero rows;
- bearer-shaped fake secret redaction in structured and text projections.

No canonical DVQR trust-boundary defect remained unexplained after focused retesting.

## Package/privacy review

The provided `0.16.2-beta-1` VSIX had valid ZIP structure and matching beta manifest/package identity, but packaged internal textual documentation under `docs/`, including red-team/internal investigation material.

Pass 15 corrects this in source by excluding internal `docs/**/*.md`, `docs/**/*.txt`, `docs/**/*.json`, `docs/**/*.log` and `docs/security/**` from VSIX packaging while retaining media assets needed by public surfaces.

The release packaging privacy regression now locks these exclusions.

Model-facing Business Path examples were also changed to generic schema-neutral examples.

**Final VSIX must be rebuilt from this Pass 15 source and rechecked before release.**

## Source-health conclusion

Review of the v0.16.2 hardening changes found:
- MCP remains decomposed around the existing dispatcher/application services.
- No second security dispatcher was introduced.
- No second entitlement engine was introduced by v0.16.2.
- Environment mismatch validation remains in the MCP argument/security boundary rather than a parallel environment authority.
- Business Path identity remains owned by the canonical core identity helper.
- Traversal hardening reuses existing traversal/runtime services.
- Workspace containment is centralized in `workspacePathSecurity`.
- Sensitive-data handling is centralized in `sensitiveData`.
- No test-only production backdoor was introduced.
- No unsafe catch-all execution fallback was added.
- Security test infrastructure remains under `src/test/security`.
- Pass 14 operational documents are source evidence only and are now excluded from release packaging.

### Non-security genericity observation for v1 readiness

Some older production investigation heuristics still contain healthcare-oriented schema aliases/examples from pre-v0.16.2 work. They were not introduced by Security Hardening II and no v0.16.2 trust-boundary bypass depends on them. Public/model-facing v0.16.2 examples have been sanitised. The remaining legacy heuristic genericity should be evaluated separately during the v1 product-completeness/contract-freeze assessment rather than silently expanded into this security release.

## Definition-of-Done review

### Trust boundary
- [x] Registered capability boundary adversarially tested.
- [x] Entitlement bypass attempts rejected.
- [x] Active-environment confusion rejected/contained.
- [x] Context-sensitive identifier abuse tested.
- [x] Replay/stale-context abuse tested.
- [x] Unsafe chaining tested.

### Untrusted content
- [x] Hostile Dataverse values tested.
- [x] Hostile metadata text tested.
- [x] Hostile persisted/imported artifact text tested.
- [x] Malicious Business Path artifacts tested.
- [x] Content cannot grant capability/environment/mutation authority.

### Bounds / availability
- [x] Cycles tested.
- [x] High fan-out tested.
- [x] Deep paths tested.
- [x] Oversized payloads tested.
- [x] Server-owned bounds deterministic.
- [x] No unbounded traversal/resource behaviour discovered.

### Managed Business Paths
- [x] Save explicit.
- [x] Exact-hop identity canonical.
- [x] Idempotent Save proven.
- [x] Saved/BusinessPreferred distinction preserved.
- [x] Reverify structural-only.
- [x] Run Saved Path exact-route only.
- [x] Reached/NotReached semantics proven.
- [x] First/later empty-frontier semantics covered.
- [x] No implicit fallback.

### Workspace / diagnostics
- [x] Workspace/path escape cases tested.
- [x] Secret sentinel corpus tested.
- [x] Structured MCP output redaction tested.
- [x] Text-mirror redaction tested.
- [x] Provider/fallback error redaction tested.
- [x] Error classification factual after redaction.

### Investigation / parity
- [x] Professional Investigation chaining/STOP tested.
- [x] Mini RCA zero-acquisition preserved.
- [x] Cross-surface security parity reviewed.
- [x] Free/Pro factual/safety parity preserved.

### Regression quality
- [x] Permanent adversarial harness committed.
- [x] Taxonomy A01–A20 represented.
- [x] Dogfooding findings reviewed against permanent regression coverage.
- [ ] Final Pass 15 source compile green — operator gate pending.
- [ ] Final Pass 15 full unit suite green — operator gate pending.
- [ ] Final Pass 15 adversarial suite green — covered by full suite, operator gate pending.
- [ ] Final rebuilt VSIX verified after Pass 15 packaging fix — pending.
- [x] Source health reviewed.
- [x] Documentation/release surfaces updated.
- [x] Public/model-facing v0.16.2 examples sanitised.

## Final prompt-dogfood corrective review

Final natural-language dogfooding found two bounded release-polish defects rather than trust-boundary failures:

1. MCP capability/server identity still contained stale hard-coded pre-v0.16 release versions. MCP identity now resolves the packaged `package.json` version at runtime, with a v0.16.2 fallback, so beta/pre-release VSIX identities are reported consistently.
2. Host guidance conflated “Reverify this saved path against the current environment” with runtime verification. Tool descriptions and capability/discovery guidance now route reverify/revalidate/current-environment compatibility requests to metadata-only `dvqr_revalidate_business_path` (pathId only, no source record, no runtime traversal). Runtime verify remains explicitly source-record-bound.

Both are protected by permanent regression assertions. These changes do not weaken exact-route, STOP, entitlement, environment or investigation authority contracts.

## Release blockers review

No known v0.16.2 release-blocking trust-boundary defect remains from the implemented/adversarial/dogfooding evidence.

The only remaining gates are mechanical verification of this final Pass 15 source:
1. compile;
2. lint/full unit suite;
3. rebuild VSIX;
4. verify final package identity/privacy exclusions.

## Deferred non-blocking scope

Still deferred beyond v0.16.2:
- source-code-only Business Path inference;
- richer hosted/team collaboration;
- new intelligence subsystems;
- new traversal algorithms;
- new RCA algorithms;
- new score semantics;
- autonomous remediation/deployment.

## Decision after final mechanical gates

If the final Pass 15 build/tests and rebuilt VSIX are green, v0.16.2 is ready to close and the next activity is the **separate v1 READINESS ASSESSMENT**:

`product completeness → security/adversarial evidence → public contracts → packaging/licensing → documentation → source health → genuine v1 blockers only`

If no genuine blocker remains, freeze contracts/semantics and prepare v1.0.0.
