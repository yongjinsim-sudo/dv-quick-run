import * as vscode from "vscode";
import { DVFORGELAB_PRODUCTS_URL, DVFORGELAB_STORE_URL, DVQR_PRICING_URL } from "../product/capabilities/commercialLinks.js";

const WELCOME_KEY = "dvQuickRun.welcome.v0_15_7.seen";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function renderWelcomeHtml(webview: vscode.Webview, iconUri: vscode.Uri): string {
  const pricingUrl = escapeHtml(DVQR_PRICING_URL);
  const productsUrl = escapeHtml(DVFORGELAB_PRODUCTS_URL);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DV Quick Run v0.15.7</title>
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
    --gold: #ffe680;
    --cyan: #8bd5ff;
  }
  * { box-sizing: border-box; }
  html {
    min-height: 100%;
    background:
      radial-gradient(circle at top left, rgba(14,99,156,.26), transparent 34%),
      radial-gradient(circle at top right, rgba(126,87,194,.16), transparent 32%),
      var(--bg);
    background-attachment: fixed;
  }
  body {
    min-height: 100vh;
    margin: 0;
    padding: 28px;
    background:
      radial-gradient(circle at top left, rgba(14,99,156,.26), transparent 34%),
      radial-gradient(circle at top right, rgba(126,87,194,.16), transparent 32%),
      var(--bg);
    background-attachment: fixed;
    color: var(--text);
    font-family: var(--vscode-font-family, Segoe UI, sans-serif);
  }
  .shell { max-width: 980px; min-height: calc(100vh - 56px); margin: 0 auto; }
  .hero {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 18px;
    align-items: center;
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(14,99,156,.24), rgba(126,87,194,.14)), var(--card);
    box-shadow: 0 18px 45px rgba(0,0,0,.22);
  }
  .hero img { width: 64px; height: 64px; border-radius: 14px; }
  .eyebrow { color: var(--cyan); font-weight: 800; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; }
  h1 { margin: 6px 0 8px; font-size: 32px; line-height: 1.08; }
  h2 { margin: 0 0 12px; font-size: 20px; }
  h3 { margin: 0 0 8px; font-size: 15px; }
  p { margin: 0; }
  .subtitle { color: var(--muted); font-size: 14px; line-height: 1.55; }
  .pathfinder {
    margin-top: 18px;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid rgba(255,230,128,.42);
    background: linear-gradient(135deg, rgba(255,230,128,.08), rgba(14,99,156,.14)), var(--card);
  }
  .pathfinder-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .price { font-size: 32px; font-weight: 900; margin: 4px 0; color: #fff; }
  .limit { color: var(--gold); font-weight: 800; }
  .price-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
  .price-pill { border: 1px solid rgba(255,255,255,.12); border-radius: 10px; padding: 9px 10px; background: rgba(0,0,0,.16); }
  .price-pill strong { display: block; font-size: 13px; }
  .price-pill span { color: var(--muted); font-size: 12px; }
  .section { margin-top: 18px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .card { border: 1px solid var(--border); border-radius: 12px; background: var(--cardSoft); padding: 14px; }
  .card p { color: var(--muted); line-height: 1.45; }
  .future .card { border-color: rgba(139,213,255,.18); }
  .recognition { color: var(--muted); margin-top: 10px; line-height: 1.5; }
  .badge { display: inline-block; margin-top: 8px; border: 1px solid rgba(255,230,128,.45); color: var(--gold); border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 800; }
  .ecosystem {
    margin-top: 18px;
    padding: 14px;
    border: 1px solid rgba(139,213,255,.22);
    border-radius: 12px;
    background: rgba(14,99,156,.10);
  }
  .ecosystem-list { margin-top: 8px; color: var(--muted); line-height: 1.65; }
  .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  button { border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 999px; padding: 9px 14px; cursor: pointer; font-weight: 800; }
  button.primary { background: var(--accent); color: var(--accentText); border-color: var(--accent); }
  button.gold { background: var(--gold); color: #1d1d1d; border-color: var(--gold); }
  button.store { background: #5fbf7a; color: #07120a; border-color: #5fbf7a; }
  .footer { color: var(--muted); margin-top: 12px; font-size: 12px; }
  @media (max-width: 760px) {
    .hero { grid-template-columns: 1fr; }
    .grid, .price-grid { grid-template-columns: 1fr; }
    .pathfinder-head { display: block; }
  }
</style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <img src="${iconUri}" alt="DV Quick Run">
      <div>
        <div class="eyebrow">What's new in v0.15.7</div>
        <h1>Custom API Intelligence</h1>
        <p class="subtitle"><strong>Discover, understand, design, safely execute, and interpret Dataverse Custom APIs.</strong><br>DV Quick Run combines metadata-backed guidance, short-lived preview sessions, explicit confirmation, live execution, and stored runtime evidence.</p>
      </div>
    </section>

    <section class="pathfinder">
      <div class="pathfinder-head">
        <div>
          <div class="eyebrow">New in v0.15.7</div>
          <div class="price">The complete Custom API lifecycle, grounded by DV Quick Run</div>
          <div class="limit">Metadata-aware · Preview-first · Evidence-backed · Local-first</div>
          <p class="recognition">Ask Copilot to discover and explain Custom APIs, recommend an architecture, preview an eligible Action, confirm execution separately, and interpret stored runtime evidence without rerunning it.</p>
          <span class="badge">Evidence first · Human authority</span>
        </div>
      </div>
      <div class="price-grid">
        <div class="price-pill"><strong>Evidence-backed capability landscape</strong><span>See layered capabilities, confidence states, evidence provenance and explicit uncertainty</span></div>
        <div class="price-pill"><strong>Operational workflow discovery</strong><span>Rank anchors, follow bridged workflow paths and identify downstream work items</span></div>
        <div class="price-pill"><strong>Extension-owned lifecycle</strong><span>Enable once per workspace; VS Code starts the server on demand</span></div>
        <div class="price-pill"><strong>Free and Pro boundary</strong><span>Free understands and executes; Pro investigates and accelerates</span></div>
      </div>
      <div class="actions">
        <button class="primary" data-action="hub">Open DV Quick Run Hub</button>
        <button class="gold" data-action="pricing">Start 14-day Pro Trial</button>
        <button class="store" data-action="store">Open Store</button>
        <button data-action="products">View Products</button>
        <button data-action="continue">Continue</button>
      </div>
      <div class="footer">Local MCP keeps investigation tools read-only. Eligible Custom API Actions use dedicated preview-confirmed POST execution; PATCH, DELETE, upload, and remediation tools are not registered. Pricing: ${pricingUrl} · Products: ${productsUrl}</div>
    
        <p><strong>Try it:</strong> enable Local MCP, then ask: “Using DV Quick Run, preview execution of AIReply with Text: Draft a short acknowledgement. Do not execute yet.” Review the preview, reply EXECUTE, then ask DVQR to interpret the last execution.</p>
      </section>

    <section class="section">
      <div class="eyebrow">Two ways to use DV Quick Run</div>
      <div class="grid">
        <div class="card"><h3>1 · Understand and design</h3><p>Discover, explain, compare, recommend, and assemble metadata-backed Custom API solution architectures.</p></div>
        <div class="card"><h3>2 · Preview, execute, interpret</h3><p>Use short-lived previews, explicit confirmation, single-use execution, and stored-evidence interpretation.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="eyebrow">Custom API Intelligence lifecycle</div>
      <div class="grid">
        <div class="card"><h3>🧭 Discover & explain</h3><p>Inspect exact Custom API definitions, parameter shapes, related capabilities, and evidence-backed usage guidance.</p></div>
        <div class="card"><h3>🧠 Recommend & architect</h3><p>Turn a business goal into a ranked shortlist or an ordered solution architecture with explicit evidence boundaries.</p></div>
        <div class="card"><h3>▶ Preview & execute</h3><p>Review the exact request, stop for a later EXECUTE confirmation, then run one eligible single-use preview.</p></div>
        <div class="card"><h3>🔎 Interpret evidence</h3><p>Classify success or failure, analyse outputs, and recommend the next safe action without rerunning.</p></div>
      </div>
    </section>


    <section class="section">
      <div class="eyebrow">Local MCP quick start</div>
      <div class="grid">
        <div class="card"><h3>1 · Select environment</h3><p>Choose the Dataverse environment DV Quick Run should expose to the local MCP server.</p></div>
        <div class="card"><h3>2 · Enable once</h3><p>Run <strong>DV Quick Run: Enable Local MCP Server</strong>. The workspace preference is remembered.</p></div>
        <div class="card"><h3>3 · Sign in</h3><p>Use <code>az login --tenant &lt;tenant-id&gt; --allow-no-subscriptions</code> for tenant-only Dataverse access.</p></div>
        <div class="card"><h3>4 · Ask Copilot</h3><p>Try: “Starting only from Contact metadata, explain this application's business capabilities and operational workflow.”</p></div>
      </div>
    </section>

    <section class="section future">
      <div class="eyebrow">Included in v0.15.7</div>
      <div class="grid">
        <div class="card"><h3>🔌 Custom API Intelligence</h3><p>Discover, explain, compare, recommend, architect, preview, execute, and interpret supported Custom APIs.</p></div>
        <div class="card"><h3>🛡 Preview-first execution</h3><p>Short-lived preview IDs, explicit confirmation, atomic single-use consumption, and replay protection.</p></div>
        <div class="card"><h3>🧠 Execution Intelligence</h3><p>Interpret stored HTTP, timing, transport, output, and error evidence without contacting Dataverse again.</p></div>
        <div class="card"><h3>🏠 Workspace-owned experience</h3><p>Enable once; VS Code remembers and starts the server on demand.</p></div>
      </div>
    </section>

    <section class="ecosystem">
      <div class="eyebrow">DV ForgeLab Ecosystem</div>
      <p class="ecosystem-list">DV Quick Run · DV Bulk Upsert Runner · DV Choice Editor · DV Environment Variable Manager · DV Identity Manager · DV Attribute Factory</p>
      <p class="subtitle">DV Quick Run investigates. DV ForgeLab utilities reconstruct. Investigation and reconstruction remain separate concerns.</p>
    </section>
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
    "dvQuickRunWelcomeV0157",
    "DV Quick Run v0.15.7",
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
