import * as vscode from "vscode";
import { DVFORGELAB_PRODUCTS_URL, DVFORGELAB_STORE_URL, DVQR_PRICING_URL } from "../product/capabilities/commercialLinks.js";

const WELCOME_KEY = "dvQuickRun.welcome.v1_0_0.seen";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function renderWelcomeHtml(webview: vscode.Webview, iconUri: vscode.Uri): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DV Quick Run v1.0.0</title>
<style>
  :root {
    color-scheme: dark;
    --bg: var(--vscode-editor-background, #101214);
    --card: var(--vscode-sideBar-background, #1b1f23);
    --cardSoft: rgba(255,255,255,.035);
    --border: var(--vscode-panel-border, #30363d);
    --text: var(--vscode-editor-foreground, #d4d4d4);
    --muted: var(--vscode-descriptionForeground, #9aa4ad);
    --accent: var(--vscode-button-background, #0e639c);
    --accentText: var(--vscode-button-foreground, #fff);
    --cyan: #8bd5ff;
    --green: #7ee2a8;
  }
  * { box-sizing: border-box; }
  html, body { min-height: 100%; }
  body {
    margin: 0;
    padding: 28px;
    background:
      radial-gradient(circle at top left, rgba(14,99,156,.24), transparent 34%),
      radial-gradient(circle at top right, rgba(126,87,194,.14), transparent 32%),
      var(--bg);
    background-attachment: fixed;
    color: var(--text);
    font-family: var(--vscode-font-family, Segoe UI, sans-serif);
  }
  .shell { max-width: 1040px; margin: 0 auto; }
  .hero {
    display: grid;
    grid-template-columns: 76px 1fr;
    gap: 20px;
    align-items: center;
    padding: 28px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(14,99,156,.24), rgba(126,87,194,.14)), var(--card);
    box-shadow: 0 18px 45px rgba(0,0,0,.22);
  }
  .hero img { width: 68px; height: 68px; border-radius: 14px; }
  .eyebrow { color: var(--cyan); font-weight: 800; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
  h1 { margin: 6px 0 8px; font-size: 34px; line-height: 1.08; }
  h2 { margin: 0 0 8px; font-size: 21px; }
  h3 { margin: 0 0 8px; font-size: 16px; }
  p { margin: 0; }
  .subtitle { color: var(--muted); font-size: 14px; line-height: 1.6; max-width: 820px; }
  .section { margin-top: 20px; }
  .section-head { margin-bottom: 12px; }
  .section-head p { color: var(--muted); margin-top: 5px; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .card { border: 1px solid var(--border); border-radius: 13px; background: var(--cardSoft); padding: 16px; }
  .card p { color: var(--muted); line-height: 1.5; }
  .start-card { min-height: 142px; display: flex; flex-direction: column; }
  .start-card .tag { color: var(--cyan); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .09em; margin-bottom: 8px; }
  .start-card button { margin-top: auto; align-self: flex-start; }
  .journey {
    padding: 18px;
    border: 1px solid rgba(139,213,255,.25);
    border-radius: 13px;
    background: rgba(14,99,156,.09);
  }
  .journey-line { margin-top: 10px; color: var(--text); font-weight: 700; line-height: 1.7; }
  .journey-line span { color: var(--cyan); padding: 0 5px; }
  .cap-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .cap { padding: 13px; border: 1px solid var(--border); border-radius: 11px; background: rgba(255,255,255,.025); }
  .cap strong { display: block; margin-bottom: 5px; }
  .cap span { color: var(--muted); font-size: 12px; line-height: 1.45; }
  .mcp { padding: 18px; border: 1px solid var(--border); border-radius: 13px; background: var(--cardSoft); }
  .mcp-steps { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 12px; }
  .step { padding: 12px; border: 1px solid var(--border); border-radius: 10px; }
  .step strong { display: block; margin-bottom: 5px; }
  .step span { color: var(--muted); font-size: 12px; line-height: 1.45; }
  .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  button { border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 999px; padding: 9px 14px; cursor: pointer; font-weight: 800; }
  button.primary { background: var(--accent); color: var(--accentText); border-color: var(--accent); }
  button.trial { background: var(--green); color: #07120a; border-color: var(--green); }
  .footer { color: var(--muted); margin: 18px 0 4px; font-size: 12px; line-height: 1.5; }
  @media (max-width: 760px) {
    .hero { grid-template-columns: 1fr; }
    .grid, .cap-grid, .mcp-steps { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <img src="${iconUri}" alt="DV Quick Run">
      <div>
        <div class="eyebrow">DV Quick Run v1.0.0</div>
        <h1>Investigate Dataverse with evidence, not guesswork.</h1>
        <p class="subtitle">DV Quick Run is a Dataverse investigation workbench for VS Code. Query and explain data, understand metadata and relationships, inspect runtime and operational context, preserve evidence, compare environments, reconstruct timelines, and carry investigations through to bounded Mini RCA and handoff.</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div class="eyebrow">Choose where to start</div>
        <h2>Start with the task you have</h2>
        <p>You do not need to know DV Quick Run's tool names. Pick an entry point and follow the evidence.</p>
      </div>
      <div class="grid">
        <div class="card start-card">
          <div class="tag">Ask</div>
          <h3>Start with a guided prompt</h3>
          <p>Search 94 guided prompts for common Dataverse questions and investigation workflows.</p>
          <button class="primary" data-action="prompts">Open Prompt Library</button>
        </div>
        <div class="card start-card">
          <div class="tag">Explore</div>
          <h3>Understand your environment</h3>
          <p>Use the Hub to discover metadata, relationships, capabilities, current context and the best next surface.</p>
          <button class="primary" data-action="hub">Open DV Quick Run Hub</button>
        </div>
        <div class="card start-card">
          <div class="tag">Investigate</div>
          <h3>Follow evidence through the problem</h3>
          <p>Move from query results into traversal, runtime evidence, profiles, readiness, correlation and Mini RCA.</p>
          <button data-action="hub">Open Investigation Hub</button>
        </div>
        <div class="card start-card">
          <div class="tag">Preserve</div>
          <h3>Keep evidence you can revisit</h3>
          <p>Capture snapshots, compare environments, reconstruct timelines, export reports and prepare handoff.</p>
          <button data-action="hub">Open Evidence Workspace</button>
        </div>
      </div>
    </section>

    <section class="section journey">
      <div class="eyebrow">The v1 investigation journey</div>
      <h2>From question to handoff</h2>
      <p class="subtitle">Start small. DV Quick Run keeps the technical evidence connected as the investigation deepens.</p>
      <div class="journey-line">Orient <span>→</span> Query <span>→</span> Understand <span>→</span> Traverse <span>→</span> Preserve <span>→</span> Investigate <span>→</span> Assess <span>→</span> Explain <span>→</span> Handoff</div>
    </section>

    <section class="section">
      <div class="section-head">
        <div class="eyebrow">Core v1 capabilities</div>
        <h2>One workbench, connected investigation surfaces</h2>
      </div>
      <div class="cap-grid">
        <div class="cap"><strong>Query & Explain</strong><span>OData, FetchXML, $batch, Query Doctor, Result Viewer and query refinement.</span></div>
        <div class="cap"><strong>Metadata & Relationships</strong><span>Schema discovery, relationship intelligence, Guided Traversal and managed Business Paths.</span></div>
        <div class="cap"><strong>Runtime & Capabilities</strong><span>Execution Insights, Custom API Intelligence and preview-first supported execution.</span></div>
        <div class="cap"><strong>Operational Context</strong><span>Operational Profiles, DVQR Score and bounded Access Context.</span></div>
        <div class="cap"><strong>Evidence & Comparison</strong><span>Snapshots, Cross-Environment Diff, Timeline Reconstruction and evidence correlation.</span></div>
        <div class="cap"><strong>Professional Investigation</strong><span>Persisted investigation workflow, readiness, evidence gaps, bounded Mini RCA and handoff.</span></div>
      </div>
    </section>

    <section class="section mcp">
      <div class="eyebrow">Optional: Talk to Dataverse</div>
      <h2>Local MCP in three steps</h2>
      <p class="subtitle">Use DV Quick Run from GitHub Copilot Chat when conversational investigation is the fastest way to start.</p>
      <div class="mcp-steps">
        <div class="step"><strong>1 · Select environment</strong><span>Choose the Dataverse environment you want DV Quick Run to use.</span></div>
        <div class="step"><strong>2 · Enable once</strong><span>Run <b>DV Quick Run: Enable Local MCP Server</b> for the workspace.</span></div>
        <div class="step"><strong>3 · Ask</strong><span>Try: “Using DV Quick Run, show me what I can investigate here and recommend where to start.”</span></div>
      </div>
    </section>

    <div class="actions">
      <button class="primary" data-action="hub">Open Hub</button>
      <button data-action="prompts">Prompt Library</button>
      <button class="trial" data-action="pricing">Start 14-day Pro Trial</button>
      <button data-action="store">Open Store</button>
      <button data-action="products">DV ForgeLab Products</button>
      <button data-action="continue">Continue</button>
    </div>
    <div class="footer">DV Quick Run keeps investigation evidence explicit and bounded. It helps you understand and explain what the available evidence supports; operational decisions remain with you.</div>
  </main>
<script>
  const vscode = acquireVsCodeApi();
  document.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
    if (!button) { return; }
    vscode.postMessage({ type: 'action', action: button.getAttribute('data-action') });
  });
</script>
</body>
</html>`;
}

async function showV0141WelcomePanel(context: vscode.ExtensionContext): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "dvQuickRunWelcomeV0159",
    "DV Quick Run v1.0.0",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "images")]
    }
  );

  const iconUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "images", "icon.png"));
  panel.webview.html = renderWelcomeHtml(panel.webview, iconUri);

  panel.webview.onDidReceiveMessage(async (message: { readonly type?: string; readonly action?: string }) => {
    if (message?.type !== "action") {
      return;
    }

    if (message.action === "pricing") {
      await vscode.env.openExternal(vscode.Uri.parse(DVQR_PRICING_URL));
      return;
    }

    if (message.action === "store") {
      await vscode.env.openExternal(vscode.Uri.parse(DVFORGELAB_STORE_URL));
      return;
    }

    if (message.action === "products") {
      await vscode.env.openExternal(vscode.Uri.parse(DVFORGELAB_PRODUCTS_URL));
      return;
    }

    if (message.action === "prompts") {
      await vscode.commands.executeCommand("dvQuickRun.openPromptLibrary");
      panel.dispose();
      return;
    }

    if (message.action === "hub") {
      await vscode.commands.executeCommand("dvQuickRun.openHub");
      panel.dispose();
      return;
    }

    if (message.action === "continue") {
      panel.dispose();
    }
  }, null, context.subscriptions);
}

export async function maybeShowV0130Welcome(context: vscode.ExtensionContext): Promise<void> {
  if (context.extensionMode === vscode.ExtensionMode.Test) {
    return;
  }

  if (context.globalState.get<boolean>(WELCOME_KEY) === true) {
    return;
  }

  await context.globalState.update(WELCOME_KEY, true);
  await showV0141WelcomePanel(context);
}

export async function showV0130Welcome(context: vscode.ExtensionContext): Promise<void> {
  await showV0141WelcomePanel(context);
}

export function registerShowWelcomeCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.showWelcomeScreen", async () => {
      await showV0130Welcome(context);
    })
  );
}
