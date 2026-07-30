# DV Quick Run v0.15.6 — Operational Workflow Discovery Pass

This pass completes the missing candidate-generation layer exposed by dogfooding.

## Behaviour

Relationship discovery now continues after direct paths are found. It performs bounded, deterministic graph exploration and prioritises likely operational hubs such as plans, plan activities, cases, episodes, encounters, orders, work orders, bookings, appointments, processes, journeys, activities, tasks, and work items.

The priority is an exploration-order hint only. It does not assert business meaning, alter Dataverse metadata, or prove that records exist.

## Trust boundaries

- Metadata validity and runtime observations remain separate.
- Runtime evidence remains investigation-scoped.
- Empty probes do not invalidate metadata paths.
- Workflow hub priority influences bounded exploration order, not metadata confidence.
- No persistent organisational knowledge is created.

## Resilience

Many-to-one, one-to-many, and many-to-many relationship collections are fetched independently. If one collection fails or times out, DVQR continues with any usable relationship metadata returned by the others. The overall table relationship request fails only when all three collections fail.

## Coverage contract

`dvqr_find_relationship_paths` now includes `discoveryCoverage` with:

- tables inspected;
- direct paths found;
- bridged paths found;
- operational hubs inspected;
- bounded exploration completion state.
