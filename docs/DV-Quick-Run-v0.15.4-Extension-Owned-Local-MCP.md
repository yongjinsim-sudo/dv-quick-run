# DV Quick Run v0.15.4 — Extension-Owned Local MCP

## Status

Implemented.

## User experience

DV Quick Run now registers its local MCP server directly with VS Code through the extension MCP server definition provider API.

Users no longer need to:

- create or maintain `.vscode/mcp.json`;
- enter the active Dataverse environment again;
- manually launch `node out/mcp/dvqrMcpStdioServer.js`;
- reinstall a development VSIX after every source change.

## Enable once per workspace

Run:

```text
DV Quick Run: Enable Local MCP Server
```

DVQR stores the enabled state in workspace state. The setting survives:

- closing and reopening VS Code;
- reopening the workspace;
- operating-system restart;
- extension-host restart.

VS Code owns the stdio child-process lifecycle. It discovers and starts the server on demand when MCP tools are inspected or used, and stops the process when the owning VS Code session closes.

## Runtime context

When VS Code resolves the server definition, DVQR supplies:

- the current active Dataverse environment URL;
- the current Free or Pro entitlement mode;
- the packaged MCP server entry point;
- the extension installation directory as the working directory.

The current v0.15.4 execution adapter still uses Azure CLI authentication. Users must remain signed in through `az login` until a later transport-neutral authentication bridge is implemented.

## Commands

- `DV Quick Run: Enable Local MCP Server`
- `DV Quick Run: Disable Local MCP Server`
- `DV Quick Run: Local MCP Server Status`

When enabled, the DVQR status bar displays `DVQR MCP`. Selecting it opens the current workspace status and allows the feature to be disabled.

## Development workflow

1. Run `npm run compile`.
2. Press `F5` to launch the Extension Development Host.
3. Run `DV Quick Run: Enable Local MCP Server` once in that workspace.
4. Open Chat and enable the DV Quick Run MCP tools.

The Extension Development Host registers the MCP server from the current compiled development output. No marketplace installation is required.
