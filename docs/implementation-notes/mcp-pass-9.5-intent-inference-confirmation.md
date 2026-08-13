# MCP Pass 9.5 — Intent Inference and Confirmation

## Outcome

Pass 9.5 was rebuilt from the verified v0.15.7 Pass 9.4.1 source baseline. The live investigation entry point now creates or reuses one investigation, performs bounded metadata-only preparation, proposes a deterministic intent and stops for a later user confirmation or correction.

## Canonical cross-turn workflow

1. `dvqr_start_investigation` creates or safely reuses one recent pending investigation.
2. Preparation and Bootstrap infer a proposal containing subject, focus, goal and reported problem.
3. The Start response presents the proposal and stops. It advertises no immediate tool call.
4. A later user message confirms or corrects the proposal.
5. `dvqr_update_investigation_intent` persists version 1 using `CONFIRM` or `CORRECT` and the matching proposal fingerprint.
6. Only then may continuation, evidence acquisition, readiness and Mini RCA progress.

Bootstrap remains available as a recovery operation. It is not the normal second tool call after Start.

## Inference boundary

Inference is deterministic and transport-neutral. It consumes only the masked investigation request, normalized subject and bounded Preparation suggestions. Explicit expected outcomes outrank broader subject matches, so a Contact can remain the investigation subject while Care Plan, Care Plan Activity or a customer-specific table becomes the focus.

The inference output distinguishes `ReadyForConfirmation` from `NeedsClarification`, includes confidence, reasons and limitations, and never includes persistence arguments.

## Persistence boundary

- Start and Bootstrap persist confirmation state and a proposal fingerprint, not inferred intent values.
- Initial intent persistence requires `CONFIRM` or `CORRECT`, a matching fingerprint and a goal.
- Repeating the same initial confirmation is idempotent.
- Later changes require `UPDATE` and create the next intent version.
- Corrected reported problems are masked before persistence.

## Execution and evidence boundary

Before intent confirmation, live prepared investigations cannot continue, acquire evidence, calculate evidence intelligence or generate Mini RCA. The guard runs before metadata queries, runtime probes or adapter side effects. Preparation itself performs no runtime record query and persists no investigation evidence.

## Duplicate and failure behavior

A recent active pending investigation with the same environment and subject is reused unless `forceNew` is explicitly true. Empty requests and the exact placeholder `noop` are rejected. If inference or Bootstrap fails after creation, the existing investigation ID is preserved and the caller must stop; Start is not retried and no fallback chain is invoked.

## Verification

- TypeScript compilation passes.
- ESLint reports zero errors; the baseline warning-only findings remain.
- The complete direct MCP regression suite passes, including the Pass 9.5 live-dispatch workflow.
- The VS Code-hosted test result is recorded separately in the implementation plan because it depends on Electron support in the build environment.
