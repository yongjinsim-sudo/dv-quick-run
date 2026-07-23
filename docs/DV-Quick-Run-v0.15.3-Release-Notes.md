# DV Quick Run v0.15.3 — Investigation Readiness

DV Quick Run v0.15.3 makes Mini RCA clearer about what the available evidence can—and cannot—support.

Timeline and Cross-Diff Mini RCA now include an Investigation Readiness section showing:

- whether the supplied evidence is Ready, Conditional, Limited or NotAssessable;
- which contributors are available, missing, not consulted, permission-limited, unsupported or stale;
- which evidence-quality dimensions limit the investigation;
- the most material evidence gaps;
- what evidence is worth collecting next.

Readiness is deliberately bounded. It has no numeric score, never raises confidence, does not certify root cause and does not authorise remediation.

## Frozen report artifacts

Mini RCA HTML, Markdown and canonical JSON now come from one frozen report artifact. Evidence changes do not silently rewrite an existing assessment. Select **Regenerate Mini RCA** when you intentionally want a new assessment.

Each artifact set uses a second-precision timestamp:

```text
YYYY-MM-DD-HHMMSS-subject-environment-mini-rca-report.html
YYYY-MM-DD-HHMMSS-subject-environment-mini-rca-report.md
YYYY-MM-DD-HHMMSS-subject-environment-mini-rca-report.json
```

Historical Mini RCA reports without readiness remain readable and are not retroactively assigned a current posture.

## Preparing for MCP Foundation

v0.15.3 also stabilises a headless, deterministic Investigation Readiness service with versioned request, result, error and JSON Schema contracts.

This release does not ship an MCP server. Authentication, consent, hosting, capability gating, transport security and server lifecycle remain explicit decisions for the next MCP Server Foundation milestone.

Public summary:

> DVQR now shows how prepared an investigation is, which evidence gaps limit confidence, and what evidence is worth collecting next.
