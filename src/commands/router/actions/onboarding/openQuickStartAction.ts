import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";

export const QUICKSTART_FLAG_KEY = "dvQuickRun.hasSeenQuickStart";

function buildEnvironmentSection(hasActiveEnvironment: boolean): string {
  if (hasActiveEnvironment) {
    return [
      "## Environment",
      "✅ Active Dataverse environment detected and ready.",
      "You can run the samples below straight away.",
      ""
    ].join("\n");
  }

  return [
    "## Environment",
    "1. Open the Command Palette",
    '2. Run: DV Quick Run: Add Environment',
    '3. Come back here and click "Run Query" above one of the examples below',
    ""
  ].join("\n");
}

export function buildQuickStartContent(hasActiveEnvironment: boolean): string {
  return [
    "# DV Quick Run — Quick Start",
    "",
    "Get from a Dataverse question to useful evidence in a few minutes.",
    "",
    buildEnvironmentSection(hasActiveEnvironment),
    "## 1. Choose how you want to start",
    "",
    "### Prompt Library",
    "Use a guided prompt when you know the outcome you want but not the DV Quick Run tool or workflow.",
    "Open: DV Quick Run: Open Prompt Library",
    "",
    "### Query in the editor",
    "Start with a small OData or FetchXML query, run it, then refine from the Result Viewer.",
    "",
    "### DV Quick Run Hub",
    "Use the Hub when you want to explore metadata, relationships, capabilities, current investigation context, snapshots or professional investigation workflows.",
    "Open: DV Quick Run: Open Hub",
    "",
    "## 2. Run your first query",
    "",
    '👉 Click "Run Query" above this line, or place the cursor on the query and press Ctrl+Enter.',
    "contacts?$select=fullname,emailaddress1&$top=5",
    "",
    "After the query runs, use Result Viewer actions to inspect rows, refine the query, investigate a record, open an Operational Profile or continue into related evidence.",
    "",
    "## 3. Follow the evidence",
    "",
    "A typical DV Quick Run investigation grows only as far as the problem requires:",
    "",
    "query → Result Viewer → relationships / runtime / profile → snapshots or investigation → readiness / Mini RCA → handoff",
    "",
    "Useful next surfaces:",
    "- Guided Traversal: discover and test relationship paths",
    "- Operational Profile: understand bounded entity-level operational context",
    "- Execution Insights: inspect available runtime participation evidence",
    "- Snapshot Library: preserve evidence for comparison or timeline reconstruction",
    "- Professional Investigation (Pro): persist evidence, assess readiness and produce bounded Mini RCA",
    "",
    "## Optional: Talk to Dataverse with Local MCP",
    "",
    "If you use GitHub Copilot Chat, DV Quick Run can expose its investigation capabilities through the extension-owned Local MCP server.",
    "",
    "1. Open DV Quick Run Hub",
    "2. Select Enable Local MCP",
    "3. Sign in to the Dataverse tenant through Azure CLI when required",
    "4. Open GitHub Copilot Chat and enable the DV Quick Run MCP tools",
    "5. Ask: Using DV Quick Run, show me what I can investigate in this Dataverse environment and recommend where to start.",
    "",
    "Tenant-only Azure CLI sign-in when required:",
    "az login --allow-no-subscriptions",
    "",
    "## A few useful things to try",
    "",
    "### Explain a query",
    '👉 Click "Explain" above this line',
    "accounts?$select=name,revenue&$filter=statecode eq 0&$top=10",
    "",
    "### Try FetchXML",
    '👉 Click "Run FetchXML" above the <fetch line',
    "<fetch top=\"5\">",
    "  <entity name=\"account\">",
    "    <attribute name=\"name\" />",
    "    <attribute name=\"accountnumber\" />",
    "  </entity>",
    "</fetch>",
    "",
    "### Explore relationships",
    "Run: DV Quick Run: Guided Traversal",
    "",
    "### Discover Custom APIs",
    "Run: DV Quick Run: Open Capability Explorer",
    "",
    "### Inspect Access Context",
    "Run: DV Quick Run: Investigate Access Context",
    "Access Context covers users, application users, teams, roles, and business units without treating DVQR as RBAC simulation or security administration tooling.",
    "",
    "## Need a starting point?",
    "",
    "Open the Prompt Library for guided questions, or open the Hub for a view of the current environment and available investigation paths.",
    "",
    "You can reopen this page any time with: DV Quick Run: Open Quickstart",
    ""
  ].join("\n");
}

export async function runOpenQuickStartAction(ctx: CommandContext): Promise<void> {
  const hasActiveEnvironment = !!ctx.envContext.getActiveEnvironment();
  const document = await vscode.workspace.openTextDocument({
    content: buildQuickStartContent(hasActiveEnvironment),
    language: "plaintext"
  });

  await vscode.window.showTextDocument(document, { preview: false });
}

export async function hasSeenQuickStart(ctx: CommandContext): Promise<boolean> {
  return ctx.ext.globalState.get<boolean>(QUICKSTART_FLAG_KEY, false);
}

export async function markQuickStartSeen(ctx: CommandContext): Promise<void> {
  await ctx.ext.globalState.update(QUICKSTART_FLAG_KEY, true);
}
