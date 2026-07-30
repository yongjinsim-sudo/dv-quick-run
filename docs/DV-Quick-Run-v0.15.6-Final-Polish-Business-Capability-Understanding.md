# DV Quick Run v0.15.6 — Final Polish Pass

## Outcome

The final v0.15.6 pass presents Operational Workflow Intelligence as a complete investigation flow:

1. Business Capability Understanding
2. Operational Anchor Discovery
3. Metadata-verified Workflow Discovery
4. Investigation-scoped Runtime Evidence
5. Evidence-backed Continuation

## Capability model

The operational-anchor MCP result now classifies each candidate across Governance, Domain, Scheduling, Coordination, Execution and Integration dimensions. These dimensions are independent: a governance object can be central without being the execution layer, while a task-like table can be strong execution evidence without being the workflow anchor.

## Trust boundaries

- Structural metadata is primary.
- Names and descriptions are supporting semantic evidence.
- Capability classification does not claim runtime records exist.
- Runtime probing does not mutate metadata confidence.
- Generated continuation queries remain metadata verified and read-only.

## User surfaces

The Welcome page, Hub, README and changelog now use the completed v0.15.6 framing: **Understand Business Architecture** and **Operational Workflow Intelligence**.
