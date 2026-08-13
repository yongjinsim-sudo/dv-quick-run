# MCP Capability Pass 6.3 — Runtime Investigation Correctness

- Managed readiness is bound to an evidence-set fingerprint and becomes stale when evidence changes.
- Stale readiness no longer completes the readiness strategy step.
- Runtime provider contributions aggregate by strongest qualifying evidence; later empty or failed probes do not downgrade an observed result.
- Record-scoped runtime acquisition validates the supplied GUID against the investigation subject table before relationship probing.
- Record GUIDs are masked from persisted title, question, and display label text.
- Explicit evidence-acquisition prompts are routed directly to the acquisition tool without prerequisite continuation or readiness calls.
