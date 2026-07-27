# DV Quick Run v0.15.4 — MCP Compile Fix

This patch addresses the first local MCP compile failures:

- replaces the ESM-only `import.meta.url` entry-point check with the CommonJS-compatible `require.main === module` check;
- gives the SDK request-handler parameter an explicit type boundary;
- documents that `npm install` is required after upgrading from v0.15.3 because the MCP SDK is a new runtime dependency.

The MCP SDK remains pinned to `@modelcontextprotocol/sdk` 1.29.0.
