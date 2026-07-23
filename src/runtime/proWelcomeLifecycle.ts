import * as vscode from "vscode";
import { DVFORGELAB_PRODUCTS_URL, DVFORGELAB_STORE_URL, DVQR_PRICING_URL } from "../product/capabilities/commercialLinks.js";

const WELCOME_KEY = "dvQuickRun.welcome.v0_15_3.seen";

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
<title>DV Quick Run v0.15.3</title>
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
        <div class="eyebrow">What's new in v0.15.3</div>
        <h1>Investigation Readiness</h1>
        <p class="subtitle"><strong>See whether the supplied evidence is prepared for bounded synthesis.</strong><br>Timeline and Cross-Diff Mini RCA now explain contributor availability, material evidence gaps, confidence limitations, and the next evidence worth collecting.</p>
      </div>
    </section>

    <section class="pathfinder">
      <div class="pathfinder-head">
        <div>
          <div class="eyebrow">New in v0.15.3</div>
          <div class="price">Evidence preparation, clearly bounded</div>
          <div class="limit">Ready · Conditional · Limited · NotAssessable</div>
          <p class="recognition">Readiness may preserve or reduce synthesized confidence. It never certifies truth, raises confidence, or authorises remediation.</p>
          <span class="badge">Evidence first · Human authority</span>
        </div>
      </div>
      <div class="price-grid">
        <div class="price-pill"><strong>Contributor availability</strong><span>Preserve Missing, NotConsulted, PermissionLimited, Unsupported and Stale distinctions</span></div>
        <div class="price-pill"><strong>Evidence quality</strong><span>Explain provenance, coverage, freshness, scope, repeatability and consistency</span></div>
        <div class="price-pill"><strong>Frozen artifacts</strong><span>Keep HTML, Markdown and JSON aligned until explicit regeneration</span></div>
        <div class="price-pill"><strong>MCP-ready boundary</strong><span>Stabilise a transport-neutral service without shipping an MCP runtime</span></div>
      </div>
      <div class="actions">
        <button class="primary" data-action="hub">Open DV Quick Run Hub</button>
        <button class="gold" data-action="pricing">Start 14-day Pro Trial</button>
        <button class="store" data-action="store">Open Store</button>
        <button data-action="products">View Products</button>
        <button data-action="continue">Continue</button>
      </div>
      <div class="footer">Investigation Readiness is advisory and never initiates a Dataverse read, write, query, upload, or remediation action. Pricing: ${pricingUrl} · Products: ${productsUrl}</div>
    
        <p><strong>Try it:</strong> generate a Timeline or Cross-Diff Mini RCA, review the readiness summary, then open the Appendix for the complete evidence-gap trace.</p>
      </section>

    <section class="section">
      <div class="eyebrow">Readiness workflow</div>
      <div class="grid">
        <div class="card"><h3>🔎 Assess</h3><p>Normalize supplied Timeline or Cross-Diff evidence through one versioned readiness profile.</p></div>
        <div class="card"><h3>🧭 Explain</h3><p>Keep contributor states, evidence quality, gaps and confidence effects visible.</p></div>
        <div class="card"><h3>📦 Preserve</h3><p>Export one frozen HTML, Markdown and canonical JSON report set.</p></div>
        <div class="card"><h3>↻ Regenerate</h3><p>Recompute only through an explicit action when the investigation evidence changes.</p></div>
      </div>
    </section>

    <section class="section future">
      <div class="eyebrow">Coming next</div>
      <div class="grid">
        <div class="card"><h3>🔌 MCP Server Foundation</h3><p>Future transport can reuse the stable readiness request, result and error contracts without rewriting semantics.</p></div>
        <div class="card"><h3>🛡 Capability boundaries</h3><p>Authentication, consent, hosting and server lifecycle remain separate v0.15.4 decisions.</p></div>
        <div class="card"><h3>📚 Read-oriented operations</h3><p>Assessment, gaps, contributor availability and evidence recommendations remain deterministic projections.</p></div>
        <div class="card"><h3>🏠 Local-first authority</h3><p>Future transport must not gain more evidence or operational authority than local DVQR.</p></div>
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
    "dvQuickRunWelcomeV0153",
    "DV Quick Run v0.15.3",
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
