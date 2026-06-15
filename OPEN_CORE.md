# DV Quick Run — Open-Core Model

DV Quick Run follows an open-core model.

The MIT-licensed core preserves foundational operational understanding workflows for Dataverse.

Commercial Pro capabilities focus on operational acceleration workflows such as:

- Cross-Environment Diff
- Timeline Diff
- Runtime Behaviour Drift
- Snapshot Replay
- Report Export Workflows
- Investigation Handoff Export
- future collaboration and persistence workflows

The public repository intentionally excludes proprietary Pro implementation modules.

## Repository Structure

```text
/src/core
MIT licensed open-core functionality

/src/pro
Private proprietary acceleration modules
Not included in the public repository or MIT grant
```

## Commercial Philosophy

DV Quick Run preserves the principle:

```text
Understanding remains accessible.
Acceleration may be premium.
```

The Free experience focuses on foundational operational understanding and explainability.

Commercial Pro capabilities focus on workflow acceleration, replay continuity, comparison workflows, reporting workflows, and future collaboration acceleration.

## Important Boundary

Only the public MIT-licensed core is covered by the root LICENSE file.

Any proprietary Pro implementation modules, if distributed separately by DV ForgeLab, are governed by their own commercial licensing terms and are not included in the MIT grant.


## Developer Entitlement Commands

Internal entitlement seed/cache commands are development-only and are hidden from the production Command Palette.

Production users should only see public licensing commands such as activation, offline license import, deactivation, and status inspection.
