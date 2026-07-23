# DV Quick Run v0.15.3 — Phase 6 MCP-Readiness and Release Validation

Status: Implemented; publish candidate validation requires the normal Windows VS Code test and manual UI gates  
Scope: Investigation Readiness application boundary and v0.15.3 release hardening  
Entry: Phase 5 report, persistence and canonical JSON gate passed

## Outcome

v0.15.3 stabilises the application-layer Investigation Readiness capability that a future MCP transport can reuse. It does not include an MCP server, protocol adapter, authentication, hosting, capability gating or server lifecycle.

The core remains local, deterministic, read-oriented and transport-neutral:

```text
investigation-readiness-request-v1
        ↓
InvestigationReadinessService.assess
        ↓
investigation-readiness-v1
or investigation-readiness-error-v1
        ↓
exact semantic projections
```

## Future Semantic Operations

The application layer exposes four transport-neutral operations:

| Operation | Canonical input | Semantic output |
|---|---|---|
| Assess Investigation Readiness | `investigation-readiness-request-v1` | result or structured error |
| Retrieve Investigation Gaps | readiness result/error | exact `gaps` array or preserved error |
| Retrieve Contributor Availability | readiness result/error | exact `contributorStates` array or preserved error |
| Retrieve Evidence Recommendations | readiness result/error | exact `recommendations` array or preserved error |

The projection functions return the canonical result collections directly. They do not rename, re-rank, reinterpret or manufacture fields. Final MCP tool names and transport envelopes remain v0.15.4 decisions.

Implementation:

- `src/core/readiness/readinessSemanticOperations.ts`
- `src/test/fixtures/readiness/readiness-phase6-semantic-operations.fixture.json`
- `src/test/readiness/investigationReadinessMcpHardening.test.ts`

## Contract and Error Boundary

The checked-in Draft 2020-12 schema remains:

```text
schema: dvqr.investigation-readiness
version: 1.0
```

It validates request, result, profile, gap-rule descriptor and error definitions. The structured error vocabulary remains:

- `InvalidInput`
- `UnsupportedInputVersion`
- `UnsupportedProfileVersion`
- `ContractViolation`

Missing, NotConsulted, PermissionLimited, Unsupported, Stale or conflicting evidence normally produces a valid readiness result. These states are not transport or service failures.

## Host Isolation

Automated source-boundary tests verify that the readiness core and its recommendation rules do not import or invoke:

- VS Code;
- webviews or Mini RCA renderers;
- filesystem or child-process APIs;
- HTTP, HTTPS, sockets or TLS;
- `fetch`;
- MCP runtime packages.

The service accepts plain serializable DTOs and returns JSON-round-trippable DTOs. Rendering and persistence remain consumers outside the core engine.

## Performance Baseline

Baseline environment:

- Node `v24.14.0`
- Linux x64
- 800 warm-up assessments
- 1,000 measured assessments
- four locked golden scenarios in round-robin order

Observed on 23 July 2026:

| Measurement | Observed |
|---|---:|
| Median assessment | 0.082 ms |
| p95 assessment | 0.168 ms |
| p99 assessment | 0.318 ms |
| Maximum assessment | 0.387 ms |
| Maximum canonical request | 2,311 bytes |
| Maximum canonical result | 14,975 bytes |
| Maximum contributors | 11 |
| Maximum gaps | 3 |
| Maximum recommendations | 3 |
| Maximum top-level evidence references | 3 |

The timing is an observational baseline, not a cross-machine service-level guarantee. Release tests use a deliberately broad 25 ms p95 regression ceiling. Current public golden fixtures remain below 64 KiB per canonical request and 256 KiB per canonical result.

Machine-readable baseline:

`src/test/fixtures/readiness/readiness-phase6-performance-baseline.fixture.json`

## Packaging and Privacy Gates

Automated validation checks:

- final package and lock-file version identity is `0.15.3`;
- compiled tests, TypeScript sources, source maps and stale VS Code test runtimes are excluded from VSIX;
- agent instructions, Git metadata, nested archives and obvious credential artifacts are excluded;
- no MCP runtime dependency or runtime directory exists;
- public readiness fixtures and v0.15.3 documentation contain no customer-specific organisation, schema or email identifiers;
- prohibited authority and marketing claims are absent;
- public release copy states the advisory and no-MCP-runtime boundaries.

The generated publish candidate was inspected as an archive after packaging:

- package identity: `dv-quick-run` `0.15.3`;
- entry point: `./out/extension.js`;
- 1,817 files, 16.54 MB;
- project TypeScript sources, compiled tests, source maps, agent residue, secrets, nested archives and MCP runtime paths absent;
- ZIP integrity test passed.

`vsce` reports the existing unbundled-extension optimisation warning (1,130 JavaScript files). This is a future package-size/startup optimisation, not a v0.15.3 semantic or privacy failure.

## v0.15.4 MCP Foundation Entry Gate

The application-layer entry requirements are satisfied:

- stable readiness request/result/error contracts;
- stable `investigation-input-v1` compatibility;
- deterministic canonical JSON;
- evidence provenance and limitation preservation;
- host-independent readiness service;
- Timeline/Cross-Diff parity;
- exact semantic-operation projections;
- no hidden reads, writes, uploads or authority escalation;
- transport-consumable public fixtures.

Still intentionally deferred to the v0.15.4 implementation lock:

- final MCP tool names and descriptions;
- local/hosted topology;
- authentication and consent;
- workspace resolution;
- capability manifests and commercial gating;
- transport security;
- server lifecycle and diagnostics.

## Release Validation Evidence

Automated gates:

- compile;
- lint;
- Phase 0–6 contract, engine, parity, persistence, semantic-operation, performance and privacy tests;
- canonical schema validation;
- deterministic fixture hashes and result sizes;
- source/VSIX archive content scans.

Manual gates:

1. Run the complete VS Code-hosted unit suite on Windows.
2. Generate Timeline and Cross-Diff Mini RCA HTML, Markdown and JSON.
3. Confirm one frozen artifact gives all formats the same second-precision basename and semantics.
4. Confirm explicit regeneration produces a new basename and leaves the earlier report set intact.
5. Confirm historical reports without readiness remain readable.
6. Review Markdown density and HTML progressive disclosure.
7. Inspect the packaged VSIX, install it, and repeat a smoke test.
8. Publish the prepared website/release copy when the website source is available.

## Residual Release Blockers

- The Linux work container cannot extract the downloaded VS Code Electron runtime because archive uid/gid ownership changes are rejected. Compile, lint and host-independent suites run here; the full VS Code-hosted suite must run in the normal Windows environment.
- Website source is not part of this implementation workspace. Website publication remains a separate release-surface action.

These blockers do not require a readiness semantic redesign. They are publish-process gates.
