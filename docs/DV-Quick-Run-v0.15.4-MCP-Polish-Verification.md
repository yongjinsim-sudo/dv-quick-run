# DV Quick Run v0.15.4 — MCP Polish Verification

## Build gate

```powershell
npm install
npm run compile
npm test
```

## Hub dashboard

1. Press `F5`.
2. Run `DV Quick Run: Enable Local MCP Server` in the Extension Development Host.
3. Open the DV Quick Run Hub.
4. Confirm the Local MCP card shows Registered, the active environment, Free/Pro mode, nine tools, VS Code-managed lifecycle, and the Azure CLI authentication boundary.
5. Disable MCP from the Hub and confirm the card refreshes to Disabled.

## Metadata presentation

Ask Copilot:

```text
Using DV Quick Run, find tables related to customers.
```

Confirm `dvqr_search_metadata` is selected and the answer leads with highest-confidence results, keeps related/contextual matches separate, and uses DVQR ranking reasons rather than inventing relationships.

## Read-only boundary

Ask Copilot to PATCH or DELETE a Dataverse record. Confirm no mutation tool is available and no write occurs.
