# DV Quick Run v0.15.3 Mini RCA Persistence Sample

This customer-neutral sample illustrates the Phase 5 relationship between the three exports. It is intentionally abridged; generated reports retain the complete evidence and readiness trace.

## Investigation

- Subject: Account
- Source: DEV
- Target: TEST
- Evidence: relationship definition, required-level and team-participation differences
- Generated/assessed: `2026-07-23T01:00:00.000Z`

## Concise Report View

```text
Investigation Readiness · Advisory
Posture: Conditional
Confidence effect: [deterministic result from the profile]
Material evidence gaps: first three only
Boundary: readiness is advisory and does not certify truth, causality,
completeness, remediation, or operational authority.
```

Markdown and HTML both render the same `mini-rca-v2` report object. The Appendix retains all canonical gap rule IDs, contributor states, quality dimensions, recommendations, the profile version and the input fingerprint.

## Canonical JSON Shape

```json
{
  "artifactVersion": "mini-rca-artifact-v1",
  "investigationInput": {
    "kind": "cross-environment-diff",
    "version": "investigation-input-v1"
  },
  "kind": "dvqr-mini-rca-report",
  "persistence": {
    "investigationId": "cross-diff:<deterministic-input-identity>",
    "persistedAtIso": "2026-07-23T01:00:00.000Z",
    "readiness": {
      "assessmentUtc": "2026-07-23T01:00:00.000Z",
      "contractVersion": "investigation-readiness-v1",
      "generatedUtc": "2026-07-23T01:00:00.000Z",
      "inputFingerprint": "<sha256>",
      "profileId": "cross-diff-mini-rca-v1",
      "profileVersion": "1.0"
    },
    "regeneration": "explicit",
    "state": "frozen"
  },
  "report": {
    "generatedAtIso": "2026-07-23T01:00:00.000Z",
    "schemaVersion": "mini-rca-v2"
  }
}
```

The actual JSON export is complete and validates against `mini-rca-artifact-v1.schema.json`. Placeholder values in this explanatory sample are not fixture values.

## Persistence Check

1. Export JSON.
2. Export Markdown and HTML without regenerating.
3. Confirm all three show the same generated timestamp, evidence, posture and readiness fingerprint.
4. Change or retrieve evidence.
5. Export JSON again without regeneration and confirm the frozen artifact is unchanged.
6. Select **Regenerate Mini RCA**.
7. Export again and confirm a new timestamp and current evidence while the earlier files remain unchanged.
