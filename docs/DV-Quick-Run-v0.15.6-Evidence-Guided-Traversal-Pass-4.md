# DV Quick Run v0.15.6 — Evidence-Guided Traversal (Pass 4)

## Purpose

Pass 4 adds an investigation-scoped runtime evidence layer to relationship intelligence. Metadata remains the immutable source of structural truth. Bounded read-only observations can change which path DVQR recommends for the current source record, but they never rewrite the metadata score or persist organisational assumptions.

## Behaviour

When `dvqr_probe_relationship_path` is called without `pathId` or `relationshipHint`, DVQR:

1. discovers metadata-verified candidate paths;
2. groups materially different relationship families;
3. optionally expands generic target concepts such as `task` to related metadata entities such as custom task tables;
4. probes candidate paths within one shared GET-request budget;
5. records intermediate continuation and final target rows;
6. returns separate metadata and runtime-observed recommendations.

Explicit `pathId` and `relationshipHint` calls continue to probe only the selected relationship intent.

## Evidence model

- **Metadata score** remains unchanged.
- **Runtime evidence score** is investigation-scoped.
- A target row observation raises runtime evidence.
- Intermediate continuation provides a smaller positive signal.
- A no-row result lowers only the runtime evidence for the sampled source record.
- Budget exhaustion is reported as incomplete evidence, not a failed relationship.

## Default bounds

- Maximum depth: 4, hard maximum 6.
- Maximum records per step: 3, hard maximum 10.
- Maximum Dataverse GET requests across all paths: 8, hard maximum 20.
- Maximum path families: 4, hard maximum 8.
- Maximum candidate paths: 6, hard maximum 12.

## MCP contract

`dvqr-mcp-relationship-probe-v5` returns:

- `metadataRecommendation`
- `runtimeRecommendation` when target rows are observed
- `runtimeEvidence.observations`
- candidate families and target-table resolution
- probe budget usage
- per-path bounded probe steps

## Target concept expansion

For generic `task` or `tasks` requests, concept expansion defaults to enabled. DVQR uses deterministic entity metadata ranking and keeps each resolved table distinct. A standard `task` path and a custom `bu_task` path are never represented as the same schema relationship.

## Safety boundaries

- All probes are explicit, read-only MCP calls.
- No runtime observation is persisted.
- No empty result invalidates metadata.
- No successful result proves organisation-wide business preference.
- Exact relationship intent still prevents silent substitution.
