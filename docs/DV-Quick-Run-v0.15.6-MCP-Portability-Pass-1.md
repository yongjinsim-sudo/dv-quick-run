# DV Quick Run v0.15.6 — MCP Portability Pass 1

## Implemented

DVQR now emits MCP tool results in two compatible representations:

1. `content` text blocks for hosts that surface text only, including the currently observed Visual Studio 2026 Copilot Agent behaviour.
2. `structuredContent` for VS Code and richer MCP clients.

The first text block remains the concise DVQR summary. When structured content exists, a second text block contains a JSON mirror. Large mirrors are bounded and replaced by an explicit `dvqr-mcp-portable-text-v1` truncation envelope; the original bounded structured payload remains unchanged.

## Runtime settings

- `DVQR_MCP_EMIT_TEXT_MIRROR=false` disables the mirror. Default: enabled.
- `DVQR_MCP_TEXT_MIRROR_MAX_CHARACTERS=<number>` changes the text limit. Default: `32768`; minimum: `1024`.

Restart the stdio MCP server after changing settings or upgrading the extension.

## Corporate TLS inspection

When Node reports `SELF_SIGNED_CERT_IN_CHAIN`, DVQR can use its bounded read-only Windows PowerShell fallback. For faster native fetch calls, users may configure Node's `NODE_EXTRA_CA_CERTS` environment variable to point to their organisation's trusted PEM-encoded CA certificate. Certificate material must be supplied and governed by the organisation; DVQR does not install or bypass certificate trust.

## Verification

- Compile the TypeScript source and inspect `out/mcp/dvqrMcpStdioServer.js` for the second text content block.
- Run syntax validation with `node --check out/mcp/dvqrMcpStdioServer.js`.
- In Visual Studio 2026, restart the `dvqr` MCP server and execute `contacts?$select=fullname&$filter=statecode eq 0&$top=10`; row JSON should be visible.
- Repeat in VS Code and confirm structured results remain available.
- Verify large payloads produce the bounded portable-text envelope.
