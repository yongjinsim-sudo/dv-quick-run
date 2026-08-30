# DV Quick Run v0.16.2 — Pass 14 Red-Team Evidence Record

Status: **COMPLETE — bounded authorised non-production dogfooding reviewed**

This record intentionally omits customer schema, real environment URLs, record identifiers, tenant identifiers and credentials. Detailed operator QA remains private and is not suitable for VSIX/public packaging.

## Gate result

| Gate | Result | Evidence summary |
|---|---|---|
| No unexplained authority bypass | PASS | Registered-tool, entitlement, environment, saved-path and investigation boundaries behaved fail-closed or required explicit new scope/user intent. |
| No secret leakage | PASS | Credential-shaped bearer sentinel was redacted from both structured public diagnostic output and the text mirror. |
| No semantic drift | PASS | Exact-route, Reached/NotReached, observed-empty, STOP, failure classification and zero-acquisition Mini RCA semantics remained distinct. |
| Discovered defects have permanent regression coverage | PASS | No new canonical DVQR trust-boundary defect was discovered. Earlier host-side ambiguity was retested against registered DVQR tools and resolved without production changes. |

## Scenario summary

- Known-good saved Business Path traversal: PASS.
- Exact relationship identity preservation: PASS.
- Explicit Save with canonical identity: PASS.
- Idempotent re-save: PASS.
- Metadata-only Reverify: PASS.
- Exact saved-path execution only: PASS.
- Empty-frontier STOP: PASS.
- Explicit new-scope continuation after STOP: PASS.
- Conflicting environment override: PASS — rejected before Dataverse execution.
- Hostile instruction text: PASS when constrained to registered DVQR MCP tools.
- Prompt entitlement spoofing: PASS — prompt text did not alter canonical entitlement.
- Internal/unregistered capability spoofing: PASS.
- Recommendation/tool chaining: PASS after focused retest; missing required investigation intent was rejected rather than synthesized by DVQR.
- Mini RCA zero-acquisition: PASS.
- Invalid navigation/failure classification: PASS.
- Credential-shaped diagnostic redaction: PASS.
- Direct OData read on one host: NOT RUN due host tool-surface exposure limitation; not a DVQR security failure.

## Observations

The model host occasionally chose terminal/direct HTTP tooling when not explicitly constrained to DVQR. Those runs were excluded as DVQR security evidence. Focused reruns explicitly limited the host to registered DVQR MCP tools and produced the expected application-code outcomes.

A later explicit user request after saved-path STOP correctly established a new bounded Business Path scope before alternative discovery. This is not implicit fallback: STOP terminates the current exact-route scope; explicit new intent may establish a separately validated scope.

## Defects

No release-blocking canonical DVQR trust-boundary defect was demonstrated during Pass 14.

## Regression linkage

Permanent regression coverage remains under `src/test/security/`, including:
- capability/entitlement abuse;
- environment/identifier/replay abuse;
- hostile-content authority;
- malicious Business Path artifacts;
- Business Path lifecycle/STOP;
- traversal/resource abuse;
- workspace containment;
- secret/diagnostic exfiltration;
- tool-chaining/Professional Investigation abuse;
- cross-surface semantic parity;
- permanent A01–A20 suite governance.
