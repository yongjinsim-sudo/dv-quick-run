# MCP Pass 8 — Evidence-Backed Hypothesis Mini RCA

Pass 8 evolves the managed Mini RCA from an evidence recap into a bounded investigation checkpoint.

The artifact now records:

- a leading evidence-backed hypothesis;
- supported, plausible, weakened and unresolved hypotheses;
- evidence identifiers supporting and contradicting each hypothesis;
- explicit missing evidence;
- a bounded next investigative step;
- qualitative confidence capped at Medium, Low or Unknown.

The engine does not infer a causal root cause. Observed runtime participation supports only a participation hypothesis. Empty observations are scoped to the tested record, path, time and probe budget. Failed or inaccessible observations are treated as acquisition limitations rather than absence evidence.

Mini RCA deduplication now uses a stable synthesis fingerprint based on the evidence-set identity, readiness posture and provider contribution state. Reassessing readiness without changing evidence therefore reuses the existing artifact.
