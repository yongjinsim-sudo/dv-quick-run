# MCP Pass 7.1 — Mini RCA Tool Registration

## Purpose

Ensure the managed Investigation Mini RCA entry points are exposed by the actual stdio MCP protocol tool list and are refreshed by VS Code when the extension version changes.

## Changes

- Registers `dvqr_generate_mini_rca` and `dvqr_get_mini_rca` as explicit first-class live MCP tool definitions.
- Keeps their internal Pro application operation mappings (`dvqr.generateMiniRca` and `dvqr.getMiniRca`).
- Exposes the exact stdio protocol projection through `listDvqrMcpProtocolTools()` so registration is directly regression-tested.
- Passes the extension package version into the MCP process and uses it as the MCP server identity version.
- Removes the stale hard-coded MCP identity version `0.15.6`, which could cause hosts to retain an older tool catalogue.
- Adds protocol-level tests proving both Mini RCA tools are visible and the evidence-acquisition provider IDs are explicitly advertised.

## Verification

After installing a newly packaged VSIX, restart the DV Quick Run MCP server (or reload VS Code) and confirm the tool list contains:

- `dvqr_generate_mini_rca`
- `dvqr_get_mini_rca`
- `dvqr_acquire_investigation_evidence` with provider IDs `metadata`, `relationship-context`, and `runtime-relationship`
