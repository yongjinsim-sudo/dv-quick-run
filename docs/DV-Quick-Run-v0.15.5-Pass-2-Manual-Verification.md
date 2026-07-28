# DV Quick Run v0.15.5 — Pass 2 Manual Verification

## Query generation

Ask Copilot:

> Generate a query from contact to task.

Expected:

- `dvqr_generate_relationship_query` is selected.
- The response identifies the verified path and ranking score.
- A direct vanilla path produces `direct-expand`.
- A path with an intermediate collection produces `staged-traversal`.
- Entity-set names, primary IDs, primary names and navigation properties come from metadata.
- Placeholders remain visible when no source record GUID is supplied.

## Explicit runtime probe

Use a known record GUID and ask:

> Probe the relationship path from contact to task for contact `<guid>`, returning at most 3 records per step.

Expected:

- `dvqr_probe_relationship_path` is selected only after a source GUID is supplied.
- Every request is GET-only and bounded.
- Each step reports query, returned record count, continuation count and transport.
- A no-match step returns `NoMatchingDataObserved` and stops calmly.
- A successful final step returns `reachedTarget: true` and bounded target IDs.
- No-match does not claim the relationship is invalid.

## Compact relationship response

Ask:

> How do I get from contact to task?

Expected:

- The result is concise enough to render inline.
- At most five ranked paths are returned.
- Each path includes score, tables, exact navigation properties and `whySelected`.
- Suggested next actions point to query generation and optional probing.

## Safety

- No PATCH, POST or DELETE tool is present.
- Probing requires an explicit source record GUID.
- Maximum depth is 6.
- Maximum records per probe step is 10.
- Results state that one successful probe is record-specific and time-specific.
