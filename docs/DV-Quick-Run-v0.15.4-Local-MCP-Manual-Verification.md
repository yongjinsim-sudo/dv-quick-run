# DV Quick Run v0.15.4 — Local MCP Manual Verification

## Prerequisites

- Node.js 20 or later
- Azure CLI installed
- `az login` completed for a user with Dataverse access
- Project dependencies installed and TypeScript compiled

## Configure

PowerShell:

```powershell
$env:DVQR_MCP_ENVIRONMENT_URL = "https://yourorg.crm6.dynamics.com"
$env:DVQR_MCP_PRO_ENABLED = "false"
```

Optional tenant selection:

```powershell
$env:DVQR_MCP_TENANT_ID = "your-tenant-id"
```


## Start directly

The package exposes a direct startup command:

```powershell
npm run mcp:start
```

A healthy stdio server remains silent because stdout is reserved for MCP JSON-RPC messages. Stop it with `Ctrl+C`. Direct startup proves that the process stays alive, but it does not provide an interactive client.

## Start from VS Code

The repository includes `.vscode/mcp.json` with a workspace-local `dvQuickRun` server definition.

1. Compile the project with `npm run compile`.
2. Complete `az login` in a terminal.
3. Open the Command Palette and run **MCP: List Servers**.
4. Select **dvQuickRun** and choose **Start**.
5. Enter the Dataverse environment URL when prompted.
6. Choose Free capabilities or local Pro capability verification.
7. Confirm that you trust the local server when VS Code requests approval.
8. Open Chat, select **Configure Tools**, and enable the `dvQuickRun` tools.

Use **MCP: List Servers → dvQuickRun → Show Output** for startup diagnostics. When the tool catalogue changes, run **MCP: Reset Cached Tools** and restart the server.

## Inspector

```powershell
npm run compile
npm run mcp:inspect
```

Verify the Inspector lists:

- `dvqr_list_capabilities`
- `dvqr_explain_odata`
- `dvqr_execute_odata`
- `dvqr_get_entity_metadata`
- four Pro investigation readiness tools

## Free verification

Call `dvqr_list_capabilities` with `{}`.

Call `dvqr_explain_odata`:

```json
{ "query": "accounts?$select=name,accountnumber&$filter=statecode eq 0&$top=5" }
```

Call `dvqr_execute_odata`:

```json
{ "query": "accounts?$select=name&$top=5", "maxRecords": 5 }
```

Call `dvqr_get_entity_metadata`:

```json
{ "logicalName": "account" }
```

Expected: all are read-only, return structured content, and never write ordinary logs to stdout.

## Pro gating verification

With `DVQR_MCP_PRO_ENABLED=false`, call `dvqr_get_evidence_recommendations` using any canonical readiness request. Expected: `capability_required` preview without the recommendation payload.

Set:

```powershell
$env:DVQR_MCP_PRO_ENABLED = "true"
```

Restart Inspector and call the same tool. Expected: the existing deterministic readiness adapter result.

## Negative verification

- Missing environment URL causes `EnvironmentRequired`.
- Invalid query causes `InvalidArguments`.
- Unknown tool causes `ToolNotFound`.
- No PATCH, POST, DELETE, HTTP listener, WebSocket or workspace mutation tool is registered.

## Dependency installation after upgrading from v0.15.3

The live MCP runtime introduces `@modelcontextprotocol/sdk`. Existing working copies and `node_modules` folders from v0.15.3 do not contain it.

Run this once before compiling v0.15.4:

```powershell
npm install
npm run compile
```

Do not compile against an unchanged v0.15.3 `node_modules` directory without first installing the new dependency.

## Windows Dataverse transport fallback verification

When `dvqr_execute_odata` or `dvqr_get_entity_metadata` encounters a low-level Node `fetch failed` error on Windows, DVQR retries the same bounded GET through Windows PowerShell.

Expected successful structured output includes:

```json
{
  "transport": "powershell-fallback",
  "nativeFetchFailure": "fetch failed (...)"
}
```

The fallback:

- is Windows-only;
- supports GET only;
- receives the access token through the child-process environment rather than command-line arguments;
- preserves the existing request timeout;
- does not add PATCH, POST, DELETE, or workspace mutation capability.

Verification prompt:

```text
Using DV Quick Run, retrieve the first 10 active accounts and return their names and revenue.
```

If both transports fail, the MCP response should identify both the Node failure and the PowerShell failure, together with the final Dataverse URL.

## Deterministic Metadata Search

After restarting the MCP server, confirm that VS Code reports **9 tools** and test:

```text
Using DV Quick Run, show me employee-related tables.
```

Expected behaviour:

- Copilot selects `dvqr_search_metadata` rather than constructing an `EntityDefinitions` OData filter.
- DVQR retrieves a bounded entity metadata projection and ranks results locally.
- Results include a score, confidence, matched terms and deterministic reasons.
- Likely matches include `systemuser`, `team` and `businessunit` when present.

Additional examples:

```text
Using DV Quick Run, find tables related to customers.
Using DV Quick Run, which tables are related to security?
Using DV Quick Run, find tables related to appointments.
Using DV Quick Run, search metadata for revenue.
```

The v0.15.4 search surface is intentionally entity-only. Attribute, relationship, lookup and choice search remain future expansions.
