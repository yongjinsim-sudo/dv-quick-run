import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { buildOperationalContextViewModel } from "../product/operationalContext/operationalContextEngine.js";
import { AccessContextProvider } from "../product/operationalContext/defaultOperationalContextProviders.js";
import { renderOperationalContextMarkdown } from "../product/operationalContext/operationalContextMarkdownRenderer.js";
import type { OperationalContextSubject } from "../product/operationalContext/operationalContextTypes.js";

type ODataListResponse = { value?: Array<Record<string, unknown>> };

type PrincipalPick = {
  label: string;
  description?: string;
  detail?: string;
  id: string;
  type: "systemuser" | "team" | "role";
};

type InvestigateAccessContextInput = {
  id?: string;
  type?: "systemuser" | "team" | "role";
  label?: string;
  displayName?: string;
  logicalName?: string;
};

function normalizeGuidLike(value: string): string | undefined {
  const text = value.trim().replace(/[{}]/g, "");
  return /^[0-9a-fA-F-]{36}$/.test(text) ? text.toLowerCase() : undefined;
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function toSystemUserPick(row: Record<string, unknown>): PrincipalPick | undefined {
  const id = normalizeGuidLike(String(row.systemuserid ?? ""));
  if (!id) {
    return undefined;
  }

  const displayName = normalizeString(row.fullname) ?? normalizeString(row.domainname) ?? id;
  return {
    label: displayName,
    description: normalizeString(row.domainname),
    detail: "systemuser",
    id,
    type: "systemuser"
  };
}

function toTeamPick(row: Record<string, unknown>): PrincipalPick | undefined {
  const id = normalizeGuidLike(String(row.teamid ?? ""));
  if (!id) {
    return undefined;
  }

  const displayName = normalizeString(row.name) ?? id;
  return {
    label: displayName,
    detail: "team",
    id,
    type: "team"
  };
}

function toRolePick(row: Record<string, unknown>): PrincipalPick | undefined {
  const id = normalizeGuidLike(String(row.roleid ?? ""));
  if (!id) {
    return undefined;
  }

  const displayName = normalizeString(row.name) ?? id;
  return {
    label: displayName,
    detail: "role",
    id,
    type: "role"
  };
}

async function getList(ctx: CommandContext, query: string): Promise<Array<Record<string, unknown>>> {
  const token = await ctx.getToken(ctx.getScope());
  const response = await ctx.getClient().get(query, token, { timeoutMs: 5000 }) as ODataListResponse;
  return Array.isArray(response.value) ? response.value : [];
}

async function findPrincipalPicks(ctx: CommandContext, input: string): Promise<PrincipalPick[]> {
  const guid = normalizeGuidLike(input);
  if (guid) {
    const picks: PrincipalPick[] = [];
    try {
      const token = await ctx.getToken(ctx.getScope());
      const user = await ctx.getClient().get(
        `/systemusers(${guid})?$select=systemuserid,fullname,domainname`,
        token,
        { timeoutMs: 5000 }
      ) as Record<string, unknown>;
      const userPick = toSystemUserPick(user);
      if (userPick) {
        picks.push(userPick);
      }
    } catch {
      // Try team lookup below before returning no matches.
    }

    try {
      const token = await ctx.getToken(ctx.getScope());
      const team = await ctx.getClient().get(
        `/teams(${guid})?$select=teamid,name`,
        token,
        { timeoutMs: 5000 }
      ) as Record<string, unknown>;
      const teamPick = toTeamPick(team);
      if (teamPick) {
        picks.push(teamPick);
      }
    } catch {
      // No team match.
    }

    try {
      const token = await ctx.getToken(ctx.getScope());
      const role = await ctx.getClient().get(
        `/roles(${guid})?$select=roleid,name`,
        token,
        { timeoutMs: 5000 }
      ) as Record<string, unknown>;
      const rolePick = toRolePick(role);
      if (rolePick) {
        picks.push(rolePick);
      }
    } catch {
      // No role match.
    }

    return picks;
  }

  const term = escapeODataString(input.trim());
  const userFilter = encodeURIComponent(`contains(fullname,'${term}') or contains(domainname,'${term}')`);
  const teamFilter = encodeURIComponent(`contains(name,'${term}')`);
  const roleFilter = encodeURIComponent(`contains(name,'${term}')`);
  const [users, teams, roles] = await Promise.all([
    getList(ctx, `/systemusers?$select=systemuserid,fullname,domainname&$filter=${userFilter}&$top=10`),
    getList(ctx, `/teams?$select=teamid,name&$filter=${teamFilter}&$top=10`),
    getList(ctx, `/roles?$select=roleid,name&$filter=${roleFilter}&$top=10`)
  ]);

  return [
    ...users.map(toSystemUserPick).filter((pick): pick is PrincipalPick => !!pick),
    ...teams.map(toTeamPick).filter((pick): pick is PrincipalPick => !!pick),
    ...roles.map(toRolePick).filter((pick): pick is PrincipalPick => !!pick)
  ];
}

type AccessContextPreviewMessage = {
  type: "copyMarkdown" | "copyJson" | "saveMarkdown" | "saveJson" | "saveHtml";
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}

function inlineMarkdownToHtml(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^_([^_]+)_$/g, "<em>$1</em>");
}

function isAllowedDetailsMarkup(line: string): boolean {
  return /^\s*<\/?details( open)?>\s*$/.test(line)
    || /^\s*<summary>(<strong>)?[^<>]*(<\/strong>)?<\/summary>\s*$/.test(line);
}

function normalizeMarkdownLine(line: string): string {
  return line.trim();
}

function renderMarkdownBodyToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inCodeFence = false;
  let codeLines: string[] = [];
  let codeLanguage = "";

  const flushCode = (): void => {
    html.push(`<pre class="code-block" data-language="${escapeHtml(codeLanguage)}"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    codeLanguage = "";
  };

  for (const line of lines) {
    const trimmedEnd = line.trimEnd();
    const control = normalizeMarkdownLine(line);

    if (control.startsWith("```")) {
      if (inCodeFence) {
        flushCode();
        inCodeFence = false;
      } else {
        inCodeFence = true;
        codeLanguage = control.slice(3).trim();
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(line.replace(/^\s{0,2}/, ""));
      continue;
    }

    if (!control) {
      html.push("");
      continue;
    }

    if (isAllowedDetailsMarkup(control)) {
      html.push(control);
      continue;
    }

    if (control.startsWith("#### ")) {
      html.push(`<h4>${inlineMarkdownToHtml(control.slice(5))}</h4>`);
      continue;
    }

    if (control.startsWith("### ")) {
      html.push(`<h3>${inlineMarkdownToHtml(control.slice(4))}</h3>`);
      continue;
    }

    if (control.startsWith("## ")) {
      html.push(`<h2>${inlineMarkdownToHtml(control.slice(3))}</h2>`);
      continue;
    }

    if (control.startsWith("> ")) {
      html.push(`<blockquote>${inlineMarkdownToHtml(control.slice(2))}</blockquote>`);
      continue;
    }

    const listMatch = /^(\s*)-\s+(.*)$/.exec(trimmedEnd);
    if (listMatch) {
      const indentLevel = Math.min(Math.floor(listMatch[1].length / 2), 4);
      html.push(`<div class="access-list-item indent-${indentLevel}"><span aria-hidden="true">•</span><span>${inlineMarkdownToHtml(listMatch[2])}</span></div>`);
      continue;
    }

    html.push(`<p>${inlineMarkdownToHtml(control)}</p>`);
  }

  if (inCodeFence) {
    flushCode();
  }

  return html.join("\n");
}

function buildAccessContextPreviewHtml(args: {
  markdown: string;
  title: string;
  nonce: string;
  cspSource: string;
  standalone?: boolean;
}): string {
  const body = renderMarkdownBodyToHtml(args.markdown);
  const actions = args.standalone ? "" : `
    <section class="toolbar" aria-label="Access Context actions">
      <div class="search-box">
        <input id="access-search" type="search" placeholder="Search current access evidence" aria-label="Search current access evidence" />
        <button type="button" id="search-next">Find next</button>
        <span id="search-count" class="search-count" aria-live="polite"></span>
      </div>
      <div class="action-buttons">
        <button type="button" data-command="copyMarkdown">Copy Markdown</button>
        <button type="button" data-command="copyJson">Copy JSON</button>
        <button type="button" data-command="saveMarkdown">Save Markdown</button>
        <button type="button" data-command="saveJson">Save JSON</button>
        <button type="button" data-command="saveHtml">Save HTML</button>
      </div>
    </section>`;

  const script = args.standalone ? "" : `
  <script nonce="${args.nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-command]').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: button.getAttribute('data-command') });
      });
    });

    const searchInput = document.getElementById('access-search');
    const searchNext = document.getElementById('search-next');
    const searchCount = document.getElementById('search-count');
    const content = document.querySelector('.content');
    let matches = [];
    let currentMatch = -1;

    const escapeRegExp = (value) => {
      const specials = ['\\\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}'];
      let escaped = value;
      for (const special of specials) {
        escaped = escaped.split(special).join('\\\\' + special);
      }
      return escaped;
    };

    const clearHighlights = () => {
      document.querySelectorAll('mark.access-search-match').forEach((mark) => {
        const text = document.createTextNode(mark.textContent || '');
        mark.replaceWith(text);
      });
      content?.normalize();
      matches = [];
      currentMatch = -1;
      if (searchCount) {
        searchCount.textContent = '';
      }
    };

    const expandAncestors = (node) => {
      let current = node.parentElement;
      while (current) {
        if (current.tagName.toLowerCase() === 'details') {
          current.setAttribute('open', '');
        }
        current = current.parentElement;
      }
    };

    const highlightMatches = () => {
      const term = searchInput ? searchInput.value.trim() : '';
      clearHighlights();
      if (!content || !term) {
        return;
      }

      const expression = new RegExp(escapeRegExp(term), 'gi');
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const value = node.nodeValue || '';
          const parent = node.parentElement;
          if (!value.trim() || parent?.closest('script, style, mark')) {
            return NodeFilter.FILTER_REJECT;
          }
          expression.lastIndex = 0;
          const hasMatch = expression.test(value);
          expression.lastIndex = 0;
          return hasMatch ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });

      const nodes = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }

      for (const node of nodes) {
        const value = node.nodeValue || '';
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        value.replace(expression, (match, offset) => {
          fragment.appendChild(document.createTextNode(value.slice(lastIndex, offset)));
          const mark = document.createElement('mark');
          mark.className = 'access-search-match';
          mark.textContent = match;
          fragment.appendChild(mark);
          matches.push(mark);
          lastIndex = offset + match.length;
          return match;
        });
        fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
        node.parentNode?.replaceChild(fragment, node);
      }

      if (searchCount) {
        searchCount.textContent = matches.length === 1 ? '1 match' : String(matches.length) + ' matches';
      }
    };

    const focusMatch = (next) => {
      if (!matches.length) {
        highlightMatches();
      }
      if (!matches.length) {
        return;
      }
      if (currentMatch >= 0) {
        matches[currentMatch]?.classList.remove('active');
      }
      currentMatch = next ? (currentMatch + 1) % matches.length : 0;
      const match = matches[currentMatch];
      match.classList.add('active');
      expandAncestors(match);
      match.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (searchCount) {
        searchCount.textContent = String(currentMatch + 1) + ' of ' + String(matches.length);
      }
    };

    searchInput?.addEventListener('input', () => highlightMatches());
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        focusMatch(true);
      }
    });
    searchNext?.addEventListener('click', () => focusMatch(true));
  </script>`;

  const csp = args.standalone
    ? ""
    : `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${args.cspSource} https: data:; style-src ${args.cspSource} 'unsafe-inline'; script-src 'nonce-${args.nonce}';" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${csp}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(args.title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      color: var(--vscode-editor-foreground, #1f2937);
      background: var(--vscode-editor-background, #ffffff);
    }
    .shell { max-width: 1120px; padding: 22px 28px 32px; }
    .header { border-bottom: 1px solid var(--vscode-panel-border, #d1d5db); margin-bottom: 16px; padding-bottom: 12px; }
    .header h1 { margin: 0 0 6px; font-size: 20px; }
    .header p { margin: 0; color: var(--vscode-descriptionForeground, #6b7280); line-height: 1.5; }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0 12px;
      margin-bottom: 14px;
      background: var(--vscode-editor-background, #ffffff);
      border-bottom: 1px solid var(--vscode-panel-border, #d1d5db);
    }
    .search-box { display: flex; flex: 1; min-width: 220px; gap: 8px; align-items: center; }
    .search-box input {
      width: min(420px, 100%);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border, #d1d5db));
      border-radius: 4px;
      padding: 6px 8px;
      color: var(--vscode-input-foreground, inherit);
      background: var(--vscode-input-background, transparent);
      font-family: inherit;
    }
    .action-buttons { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    button {
      border: none;
      border-radius: 4px;
      padding: 6px 10px;
      color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground, #ffffff));
      background: var(--vscode-button-secondaryBackground, var(--vscode-button-background, #2563eb));
      cursor: pointer;
      font-family: inherit;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground, #1d4ed8)); }
    .search-count { color: var(--vscode-descriptionForeground, #6b7280); min-width: 72px; font-size: 12px; }
    mark.access-search-match {
      border-radius: 2px;
      padding: 0 2px;
      color: var(--vscode-editor-findMatchForeground, inherit);
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 179, 8, 0.35));
    }
    mark.access-search-match.active {
      outline: 1px solid var(--vscode-editor-findMatchBorder, var(--vscode-focusBorder, #2563eb));
      background: var(--vscode-editor-findMatchBackground, rgba(234, 179, 8, 0.65));
    }
    details {
      border: 1px solid var(--vscode-panel-border, #d1d5db);
      border-radius: 8px;
      margin: 14px 0;
      background: var(--vscode-editor-background, #ffffff);
      overflow: hidden;
    }
    details details { margin: 12px; }
    summary {
      cursor: pointer;
      padding: 10px 12px;
      background: var(--vscode-sideBar-background, #f3f4f6);
      border-bottom: 1px solid var(--vscode-panel-border, #d1d5db);
      font-weight: 700;
    }
    details:not([open]) summary { border-bottom: none; }
    h2 { margin: 18px 0 8px; font-size: 22px; }
    h3 { margin: 18px 12px 8px; font-size: 16px; }
    h4 { margin: 16px 12px 8px; font-size: 13px; }
    p, blockquote, .access-list-item { line-height: 1.55; }
    p { margin: 8px 12px; }
    blockquote {
      margin: 10px 12px;
      padding: 8px 10px;
      border-left: 4px solid var(--vscode-panel-border, #d1d5db);
      background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
      color: var(--vscode-descriptionForeground, inherit);
    }
    .access-list-item { display: flex; gap: 8px; margin: 5px 12px; }
    .access-list-item.indent-1 { margin-left: 28px; }
    .access-list-item.indent-2 { margin-left: 44px; }
    .access-list-item.indent-3 { margin-left: 60px; }
    .access-list-item.indent-4 { margin-left: 76px; }
    code {
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
      font-size: 0.95em;
    }
    .code-block {
      margin: 10px 12px 14px;
      padding: 12px;
      border-radius: 6px;
      overflow: auto;
      white-space: pre;
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.12));
    }
    em { color: var(--vscode-descriptionForeground, inherit); }
    @media print { .toolbar { display: none; } .shell { max-width: none; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="header">
      <h1>${escapeHtml(args.title)}</h1>
      <p>Operational access orientation. Export actions are explicit and preserve evidence semantics.</p>
    </header>
    ${actions}
    <section class="content">
      ${body}
    </section>
  </main>
  ${script}
</body>
</html>`;
}

async function saveTextDocument(args: {
  content: string;
  defaultFileName: string;
  filters: Record<string, string[]>;
}): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(args.defaultFileName),
    filters: args.filters,
    saveLabel: "Save Access Context"
  });

  if (!uri) {
    return;
  }

  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(args.content));
  void vscode.window.showInformationMessage(`DV Quick Run: Access Context saved to ${uri.fsPath}.`);
}

function slugifyFileName(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "access-context";
}

async function showAccessContextPreview(args: {
  markdown: string;
  json: string;
  title: string;
  subjectName: string;
}): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "dvQuickRunAccessContextPreview",
    `DV Quick Run – ${args.title}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const nonce = getNonce();
  const buildHtml = (standalone: boolean): string => buildAccessContextPreviewHtml({
    markdown: args.markdown,
    title: args.title,
    nonce,
    cspSource: panel.webview.cspSource,
    standalone
  });

  panel.webview.html = buildHtml(false);

  panel.webview.onDidReceiveMessage(async (message: AccessContextPreviewMessage) => {
    switch (message.type) {
      case "copyMarkdown":
        await vscode.env.clipboard.writeText(args.markdown);
        void vscode.window.showInformationMessage("DV Quick Run: Access Context Markdown copied.");
        break;
      case "copyJson":
        await vscode.env.clipboard.writeText(args.json);
        void vscode.window.showInformationMessage("DV Quick Run: Access Context JSON copied.");
        break;
      case "saveMarkdown":
        await saveTextDocument({
          content: args.markdown,
          defaultFileName: `${slugifyFileName(args.subjectName)}-access-context.md`,
          filters: { Markdown: ["md"], "All Files": ["*"] }
        });
        break;
      case "saveJson":
        await saveTextDocument({
          content: args.json,
          defaultFileName: `${slugifyFileName(args.subjectName)}-access-context.json`,
          filters: { JSON: ["json"], "All Files": ["*"] }
        });
        break;
      case "saveHtml":
        await saveTextDocument({
          content: buildHtml(true),
          defaultFileName: `${slugifyFileName(args.subjectName)}-access-context.html`,
          filters: { HTML: ["html", "htm"], "All Files": ["*"] }
        });
        break;
      default:
        break;
    }
  });
}

function pickFromInput(input: InvestigateAccessContextInput): PrincipalPick | undefined {
  const id = normalizeGuidLike(String(input.id ?? ""));
  if (!id) {
    return undefined;
  }

  const logicalName = String(input.logicalName ?? input.type ?? "systemuser").trim().toLowerCase();
  const type: "systemuser" | "team" | "role" = logicalName === "team" || logicalName === "teams"
    ? "team"
    : logicalName === "role" || logicalName === "roles"
      ? "role"
      : "systemuser";
  const label = normalizeString(input.label) ?? normalizeString(input.displayName) ?? id;
  return {
    label,
    id,
    type,
    detail: type
  };
}

async function showAccessContextForPick(ctx: CommandContext, selected: PrincipalPick): Promise<void> {
  const token = await ctx.getToken(ctx.getScope());
  const subject: OperationalContextSubject = {
    type: "principal",
    id: selected.id,
    logicalName: selected.type,
    displayName: selected.label
  };

  const context = await buildOperationalContextViewModel({
    subject,
    providers: [new AccessContextProvider()],
    dataverse: {
      client: ctx.getClient(),
      token
    }
  });

  const markdown = renderOperationalContextMarkdown(context);
  await showAccessContextPreview({
    markdown,
    json: JSON.stringify(context, null, 2),
    title: `Access Context — ${selected.label}`,
    subjectName: selected.label
  });
}

async function investigateAccessContext(ctx: CommandContext, inputArg?: InvestigateAccessContextInput | string): Promise<void> {
  if (typeof inputArg === "object" && inputArg !== null) {
    const selected = pickFromInput(inputArg);
    if (!selected) {
      void vscode.window.showWarningMessage("DV Quick Run: Access Context requires a user, team, or role id.");
      return;
    }

    await showAccessContextForPick(ctx, selected);
    return;
  }

  const input = typeof inputArg === "string" && inputArg.trim()
    ? inputArg.trim()
    : await vscode.window.showInputBox({
      title: "DV Quick Run: Investigate Access Context",
      prompt: "Enter a user/team/role name, email/domain name, or GUID. Search is for selecting a principal; preview search remains local to the retrieved evidence.",
      placeHolder: "e.g. jane@contoso.com, Jane Smith, Integration Team, System Administrator, or GUID"
    });

  if (!input || !input.trim()) {
    return;
  }

  const picks = await findPrincipalPicks(ctx, input);
  if (!picks.length) {
    void vscode.window.showInformationMessage("DV Quick Run: No user, team, or role matched that Access Context lookup.");
    return;
  }

  const selected = picks.length === 1
    ? picks[0]
    : await vscode.window.showQuickPick(picks, {
      title: "DV Quick Run: Select principal for Access Context",
      placeHolder: "Access Context provides operational orientation, not an RBAC simulation."
    });

  if (!selected) {
    return;
  }

  await showAccessContextForPick(ctx, selected);
}

export function registerInvestigateAccessContextCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.investigateAccessContext", investigateAccessContext, ctx);
}
