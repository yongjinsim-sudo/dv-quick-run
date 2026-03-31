import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";

export const QUICKSTART_FLAG_KEY = "dvQuickRun.hasSeenQuickStart";

function buildEnvironmentSection(hasActiveEnvironment: boolean): string {
  if (hasActiveEnvironment) {
    return [
      "## Environment",
      "✅ Your active environment is ready.",
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

function buildQuickStartContent(hasActiveEnvironment: boolean): string {
  return [
    "# Welcome to DV Quick Run",
    "",
    "Run Dataverse queries directly inside VS Code.",
    "",
    "DV Quick Run becomes useful when you have a query in the editor.",
    'This page gives you runnable samples so CodeLens can appear naturally above each query.',
    "",
    buildEnvironmentSection(hasActiveEnvironment),
    "## Run your first query",
    '👉 Click "Run Query" above this line',
    "contacts?$top=5",
    "",
    "## Try Explain",
    '👉 Click "Explain" above this line',
    "contacts?$select=fullname,emailaddress1&$top=5",
    "",
    "## Try an expand",
    "contacts?$select=fullname&$expand=parentcustomerid_account($select=name)&$top=5",
    "",
    "## Try a filtered query",
    "contacts?$select=fullname,emailaddress1&$filter=contains(fullname,'a')&$top=5",
    "",
    "## Try FetchXML",
    '👉 Click "Run FetchXML" above the <fetch line',
    "<fetch top=\"5\">",
    "  <entity name=\"account\">",
    "    <attribute name=\"name\" />",
    "    <attribute name=\"accountnumber\" />",
    "  </entity>",
    "</fetch>",
    "",
    "## Explore relationships (Advanced)",
    "",
    "👉 Try: DV Quick Run: Find Path to Table (Command Palette)",
    "",
    "Example:",
    "account → contact → systemuser",
    "",
    "This helps you navigate across related tables without writing complex queries.",
    "",
    "## Other useful features",
    "- Result Viewer: inspect results in a table or JSON view",
    "- Investigate Record: inspect a record from GUID / JSON / logs",
    "- Find Path to Table: guided traversal between related tables",
    "- Metadata Hover: get field hints directly in the editor",
    "",
    "## Tips",
    "- CodeLens actions appear above supported queries",
    "- Ctrl+Enter runs the query under your cursor",
    "- You can reopen this page any time with: DV Quick Run: Open Quickstart",
    "",
    "If you do not see actions above the sample queries:",
    "- make sure DV Quick Run CodeLens is enabled",
    "- make sure your environment is configured",
    "- click inside a sample query line and try Ctrl+Enter",
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
