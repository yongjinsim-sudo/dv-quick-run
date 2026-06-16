import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import type { EntityRelationshipExplorerResult } from "../../../../services/entityRelationshipExplorerService.js";
import {
  findEntityByEntitySetName,
  findEntityByLogicalName,
  loadEntityDefs,
  loadFields,
  loadEntityRelationships
} from "../shared/metadataAccess.js";
import { getSelectableFields } from "../shared/selectableFields.js";
import {
  getEntitySetNameFromEditorQuery,
  parseEditorQuery
} from "../shared/queryMutation/parsedEditorQuery.js";


function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type FocusedRelationship =
  | {
      relationshipType: "Many-to-One";
      navigationPropertyName: string;
      targetEntity?: string;
      targetEntitySetName?: string;
      lookupAttribute?: string;
      schemaName?: string;
      exampleExpand?: string;
      suggestedFields?: string[];
    }
  | {
      relationshipType: "One-to-Many";
      navigationPropertyName: string;
      targetEntity?: string;
      targetEntitySetName?: string;
      lookupAttribute?: string;
      schemaName?: string;
      exampleExpand?: string;
      suggestedFields?: string[];
    }
  | {
      relationshipType: "Many-to-Many";
      navigationPropertyName: string;
      targetEntity?: string;
      targetEntitySetName?: string;
      schemaName?: string;
      exampleExpand?: string;
      suggestedFields?: string[];
    };

function pickPreferredExampleField(fieldLogicalNames: string[]): string | undefined {
  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));

  return (
    lowered.get("fullname") ??
    lowered.get("name") ??
    lowered.get("subject") ??
    lowered.get("title") ??
    lowered.get("domainname") ??
    lowered.get("internalemailaddress") ??
    lowered.get("emailaddress1") ??
    lowered.get("telephone1") ??
    lowered.get("accountnumber") ??
    lowered.get("currencyname") ??
    lowered.get("isocurrencycode") ??
    fieldLogicalNames[0]
  );
}

function pickSuggestedFields(fieldLogicalNames: string[]): string[] {
  const preferredOrder = [
    "fullname",
    "name",
    "subject",
    "title",
    "domainname",
    "internalemailaddress",
    "emailaddress1",
    "telephone1",
    "accountnumber",
    "currencyname",
    "isocurrencycode",
    "firstname",
    "lastname"
  ];

  const lowered = new Map(fieldLogicalNames.map((name) => [name.toLowerCase(), name]));
  const preferred = preferredOrder
    .map((name) => lowered.get(name))
    .filter((name): name is string => !!name);

  const remaining = fieldLogicalNames.filter(
    (name) => !preferred.some((p) => p.toLowerCase() === name.toLowerCase())
  );

  return [...preferred, ...remaining].slice(0, 5);
}

async function enrichFocusedRelationship(
  ctx: CommandContext,
  defs: Awaited<ReturnType<typeof loadEntityDefs>>,
  entitySetName: string,
  relationship: FocusedRelationship,
  token: string,
  client: ReturnType<CommandContext["getClient"]>
): Promise<FocusedRelationship> {
  const targetEntity = relationship.targetEntity?.trim();
  if (!targetEntity) {
    return relationship;
  }

  const targetDef = findEntityByLogicalName(defs, targetEntity);
  const targetEntitySetName = targetDef?.entitySetName;

  let exampleExpand: string | undefined;
  let suggestedFields: string[] | undefined;

  try {
    const targetFields = await loadFields(ctx, client, token, targetEntity);
    const selectable = getSelectableFields(targetFields);
    const fieldLogicalNames = selectable.map((f) => f.logicalName).filter(Boolean);

    suggestedFields = pickSuggestedFields(fieldLogicalNames);

    const exampleField = pickPreferredExampleField(fieldLogicalNames);
    exampleExpand = exampleField
      ? `${entitySetName}?$expand=${relationship.navigationPropertyName}($select=${exampleField})`
      : `${entitySetName}?$expand=${relationship.navigationPropertyName}`;
  } catch {
    exampleExpand = `${entitySetName}?$expand=${relationship.navigationPropertyName}`;
  }

  return {
    ...relationship,
    targetEntitySetName,
    exampleExpand,
    suggestedFields
  };
}

function tryGetEntitySetNameFromActiveEditor(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const lineText = editor.document.lineAt(editor.selection.active.line).text.trim();
  if (!lineText) {
    return undefined;
  }

  try {
    const parsed = parseEditorQuery(lineText);
    return getEntitySetNameFromEditorQuery(parsed.entityPath);
  } catch {
    return undefined;
  }
}

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }

  return value + " ".repeat(width - value.length);
}

function getHoverLikeTokenUnderCursor(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const line = editor.document.lineAt(editor.selection.active.line).text;
  const position = editor.selection.active.character;

  const isTokenChar = (ch: string): boolean => /[$A-Za-z0-9_]/.test(ch);

  let start = position;
  let end = position;

  while (start > 0 && isTokenChar(line[start - 1])) {
    start--;
  }

  while (end < line.length && isTokenChar(line[end])) {
    end++;
  }

  if (start === end) {
    return undefined;
  }

  const token = line.slice(start, end).trim();
  return token || undefined;
}

function tryGetFocusedRelationship(
  token: string | undefined,
  data: EntityRelationshipExplorerResult
): FocusedRelationship | undefined {
  if (!token) {
    return undefined;
  }

  const normalizedToken = normalize(token);

  const m2o = data.manyToOne.find(
    (rel) => normalize(rel.navigationPropertyName) === normalizedToken
  );

  if (m2o) {
    return {
      relationshipType: "Many-to-One",
      navigationPropertyName: m2o.navigationPropertyName,
      targetEntity: m2o.referencedEntity,
      lookupAttribute: m2o.referencingAttribute,
      schemaName: m2o.schemaName
    };
  }

  const o2m = data.oneToMany.find(
    (rel) => normalize(rel.navigationPropertyName) === normalizedToken
  );

  if (o2m) {
    return {
      relationshipType: "One-to-Many",
      navigationPropertyName: o2m.navigationPropertyName,
      targetEntity: o2m.referencedEntity,
      lookupAttribute: o2m.referencingAttribute,
      schemaName: o2m.schemaName
    };
  }

  const m2m = data.manyToMany.find(
    (rel) => normalize(rel.navigationPropertyName) === normalizedToken
  );

  if (m2m) {
    return {
      relationshipType: "Many-to-Many",
      navigationPropertyName: m2m.navigationPropertyName,
      targetEntity: m2m.targetEntity,
      schemaName: m2m.schemaName
    };
  }

  return undefined;
}

function appendFocusedRelationshipSection(
  lines: string[],
  entitySetName: string,
  focused: FocusedRelationship
): void {
  lines.push("Focused Relationship");
  lines.push("--------------------");

  lines.push(
    `${focused.navigationPropertyName} → ${focused.targetEntity ?? "unknown"}`
  );
  lines.push("");

  lines.push(`Type: ${focused.relationshipType}`);

  if ("lookupAttribute" in focused && focused.lookupAttribute) {
    lines.push(`Lookup Column: ${focused.lookupAttribute}`);
  }

  if (focused.schemaName) {
    lines.push(`Schema Name: ${focused.schemaName}`);
  }

  if (focused.targetEntitySetName) {
    lines.push(`Target Entity Set: ${focused.targetEntitySetName}`);
  }

  lines.push("");
  lines.push("Example:");

  lines.push(
    focused.exampleExpand ??
      (focused.relationshipType === "Many-to-One"
        ? `${entitySetName}?$expand=${focused.navigationPropertyName}($select=name)`
        : `${entitySetName}?$expand=${focused.navigationPropertyName}`)
  );

  if (focused.suggestedFields?.length) {
    lines.push("");
    lines.push(`Common Fields: ${focused.suggestedFields.join(", ")}`);
  }

  lines.push("");
}

function buildGraphText(
  entitySetName: string,
  logicalName: string,
  data: EntityRelationshipExplorerResult,
  focusedRelationship?: FocusedRelationship
): string {
  const lines: string[] = [];

  lines.push("Relationship Graph");
  lines.push(`Entity: ${logicalName}`);
  lines.push(`Entity Set: ${entitySetName}`);
  lines.push("");

  if (focusedRelationship) {
    appendFocusedRelationshipSection(lines, entitySetName, focusedRelationship);
  }

  lines.push(logicalName);

  const hasM2O = data.manyToOne.length > 0;
  const hasO2M = data.oneToMany.length > 0;
  const hasM2M = data.manyToMany.length > 0;

  const sections = [
    { title: "Many-to-One", enabled: hasM2O },
    { title: "One-to-Many", enabled: hasO2M },
    { title: "Many-to-Many", enabled: hasM2M }
  ].filter((x) => x.enabled);

  const renderBranchPrefix = (index: number, total: number): string =>
    index === total - 1 ? "└─" : "├─";

  const renderChildPrefix = (parentIsLast: boolean, childIndex: number, childTotal: number): string => {
    const stem = parentIsLast ? "   " : "│  ";
    const branch = childIndex === childTotal - 1 ? "└─" : "├─";
    return stem + branch;
  };

  sections.forEach((section, sectionIndex) => {
    const sectionIsLast = sectionIndex === sections.length - 1;
    lines.push(`${renderBranchPrefix(sectionIndex, sections.length)} ${section.title}`);

    if (section.title === "Many-to-One") {
      data.manyToOne.forEach((rel, relIndex) => {
        const target = rel.referencedEntity ?? "unknown";
        const nav = padRight(rel.navigationPropertyName, 28);
        lines.push(`${renderChildPrefix(sectionIsLast, relIndex, data.manyToOne.length)} ${nav} → ${target}`);
      });
    }

    if (section.title === "One-to-Many") {
      data.oneToMany.forEach((rel, relIndex) => {
        const target = rel.referencedEntity ?? "unknown";
        const nav = padRight(rel.navigationPropertyName, 28);
        lines.push(`${renderChildPrefix(sectionIsLast, relIndex, data.oneToMany.length)} ${nav} → ${target}`);
      });
    }

    if (section.title === "Many-to-Many") {
      data.manyToMany.forEach((rel, relIndex) => {
        const target = rel.targetEntity ?? "unknown";
        const nav = padRight(rel.navigationPropertyName, 28);
        lines.push(`${renderChildPrefix(sectionIsLast, relIndex, data.manyToMany.length)} ${nav} → ${target}`);
      });
    }
  });

  lines.push("");
  lines.push("Legend");
  lines.push("------");
  lines.push("Many-to-One  : this entity contains the lookup column pointing to the target entity");
  lines.push("One-to-Many  : other records contain a lookup referencing this entity");
  lines.push("Many-to-Many : association/intersect relationship between two entities");

  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function relationshipCount(data: EntityRelationshipExplorerResult): number {
  return data.manyToOne.length + data.oneToMany.length + data.manyToMany.length;
}

function renderRelationshipRows(
  title: string,
  relationships: Array<{ navigationPropertyName: string; referencedEntity?: string; targetEntity?: string; schemaName?: string }>,
  targetSelector: (rel: { referencedEntity?: string; targetEntity?: string }) => string | undefined,
  emptyText: string
): string {
  if (relationships.length === 0) {
    return `<section class="card"><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(emptyText)}</p></section>`;
  }

  const rows = relationships
    .map((rel) => {
      const target = targetSelector(rel) ?? "unknown";
      const schema = rel.schemaName ? `<span class="schema">${escapeHtml(rel.schemaName)}</span>` : "";
      return `<tr><td><code>${escapeHtml(rel.navigationPropertyName)}</code></td><td>${escapeHtml(target)}</td><td>${schema}</td></tr>`;
    })
    .join("");

  return `
    <section class="card">
      <div class="section-heading">
        <h2>${escapeHtml(title)}</h2>
        <span class="count">${relationships.length}</span>
      </div>
      <table>
        <thead><tr><th>Navigation property</th><th>Target entity</th><th>Schema</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function renderFocusedRelationshipCard(focusedRelationship: FocusedRelationship | undefined): string {
  if (!focusedRelationship) {
    return "";
  }

  const commonFields = focusedRelationship.suggestedFields?.length
    ? `<p><strong>Common fields:</strong> ${focusedRelationship.suggestedFields.map(escapeHtml).join(", ")}</p>`
    : "";

  const lookup = "lookupAttribute" in focusedRelationship && focusedRelationship.lookupAttribute
    ? `<p><strong>Lookup column:</strong> <code>${escapeHtml(focusedRelationship.lookupAttribute)}</code></p>`
    : "";

  return `
    <section class="card focused">
      <div class="section-heading">
        <h2>Focused relationship</h2>
        <span class="pill">${escapeHtml(focusedRelationship.relationshipType)}</span>
      </div>
      <p><code>${escapeHtml(focusedRelationship.navigationPropertyName)}</code> → <strong>${escapeHtml(focusedRelationship.targetEntity ?? "unknown")}</strong></p>
      ${lookup}
      ${focusedRelationship.schemaName ? `<p><strong>Schema:</strong> ${escapeHtml(focusedRelationship.schemaName)}</p>` : ""}
      ${focusedRelationship.targetEntitySetName ? `<p><strong>Target entity set:</strong> ${escapeHtml(focusedRelationship.targetEntitySetName)}</p>` : ""}
      ${focusedRelationship.exampleExpand ? `<p><strong>Example:</strong></p><pre>${escapeHtml(focusedRelationship.exampleExpand)}</pre>` : ""}
      ${commonFields}
    </section>`;
}

function renderRelationshipGraphHtml(
  content: string,
  entitySetName: string,
  logicalName: string,
  data: EntityRelationshipExplorerResult,
  focusedRelationship?: FocusedRelationship
): string {
  const exactText = JSON.stringify(content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relationship Graph - ${escapeHtml(logicalName)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --card: var(--vscode-sideBar-background);
      --accent: var(--vscode-focusBorder);
      --button: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
    }
    body { margin: 0; padding: 24px; background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family); }
    .shell { max-width: 1180px; margin: 0 auto; }
    .hero { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    h2 { font-size: 15px; margin: 0; }
    .muted { color: var(--muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .search-bar { display: flex; align-items: center; gap: 6px; margin: 12px 0 16px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 8px; }
    .search-bar input { flex: 1; min-width: 220px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--border)); border-radius: 4px; padding: 7px 9px; font-family: var(--vscode-font-family); }
    .search-bar input:focus { outline: 1px solid var(--accent); }
    .search-count { min-width: 58px; text-align: center; color: var(--muted); font-size: 12px; }
    button.icon { min-width: 32px; padding: 7px 9px; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .search-hit { outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
    .search-current { outline: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
    button { border: 0; border-radius: 4px; padding: 8px 12px; background: var(--button); color: var(--button-fg); cursor: pointer; }
    button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 16px 0; }
    .stat, .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
    .stat .number { font-size: 24px; font-weight: 700; }
    .stat .label { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .card { margin-top: 12px; }
    .focused { border-color: var(--accent); }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .count, .pill { border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; color: var(--muted); font-size: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { text-align: left; border-top: 1px solid var(--border); padding: 8px 6px; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; font-size: 12px; }
    code, pre { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
    pre { white-space: pre-wrap; overflow: auto; background: var(--vscode-textCodeBlock-background); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
    .schema { color: var(--muted); }
    details { margin-top: 14px; }
    summary { cursor: pointer; color: var(--muted); }
    @media (max-width: 820px) { .hero { flex-direction: column; } .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div>
        <h1>Relationship Graph</h1>
        <div class="muted">${escapeHtml(logicalName)} · ${escapeHtml(entitySetName)}</div>
      </div>
      <div class="actions">
        <button id="save">Save exact .txt</button>
        <button class="secondary" id="copy">Copy exact text</button>
      </div>
    </section>

    <section class="search-bar" aria-label="Search relationships">
      <input id="relationshipSearch" type="search" placeholder="Search navigation property, target entity, schema..." aria-label="Search relationships" />
      <button class="secondary icon" id="searchPrev" title="Previous match">&lt;</button>
      <button class="secondary icon" id="searchNext" title="Next match">&gt;</button>
      <span class="search-count" id="searchCount">0 / 0</span>
      <button class="secondary" id="searchClear" title="Clear search">Clear</button>
    </section>

    <section class="stats">
      <div class="stat"><div class="number">${relationshipCount(data)}</div><div class="label">Total relationships</div></div>
      <div class="stat"><div class="number">${data.manyToOne.length}</div><div class="label">Many-to-one</div></div>
      <div class="stat"><div class="number">${data.oneToMany.length}</div><div class="label">One-to-many</div></div>
      <div class="stat"><div class="number">${data.manyToMany.length}</div><div class="label">Many-to-many</div></div>
    </section>

    ${renderFocusedRelationshipCard(focusedRelationship)}

    ${renderRelationshipRows("Many-to-one", data.manyToOne, (rel) => rel.referencedEntity, "No many-to-one relationships returned for this entity.")}
    ${renderRelationshipRows("One-to-many", data.oneToMany, (rel) => rel.referencedEntity, "No one-to-many relationships returned for this entity.")}
    ${renderRelationshipRows("Many-to-many", data.manyToMany, (rel) => rel.targetEntity, "No many-to-many relationships returned for this entity.")}

    <details>
      <summary>Exact text artifact</summary>
      <pre id="exact"></pre>
    </details>
  </main>

  <script>
    const vscode = acquireVsCodeApi();
    const exactText = ${exactText};
    document.getElementById('exact').textContent = exactText;
    document.getElementById('save').addEventListener('click', () => vscode.postMessage({ type: 'saveExactText' }));
    document.getElementById('copy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(exactText);
      vscode.postMessage({ type: 'copiedExactText' });
    });

    const searchInput = document.getElementById('relationshipSearch');
    const searchPrev = document.getElementById('searchPrev');
    const searchNext = document.getElementById('searchNext');
    const searchClear = document.getElementById('searchClear');
    const searchCount = document.getElementById('searchCount');
    const searchableItems = Array.from(document.querySelectorAll('tbody tr, section.focused'));
    let matches = [];
    let activeIndex = -1;

    function clearSearchClasses() {
      searchableItems.forEach((item) => item.classList.remove('search-hit', 'search-current'));
    }

    function updateSearchButtons() {
      const hasMatches = matches.length > 0;
      searchPrev.disabled = !hasMatches;
      searchNext.disabled = !hasMatches;
      searchClear.disabled = !searchInput.value;
      searchCount.textContent = hasMatches ? String(activeIndex + 1) + ' / ' + String(matches.length) : '0 / 0';
    }

    function focusActiveMatch() {
      clearSearchClasses();
      matches.forEach((item) => item.classList.add('search-hit'));
      if (activeIndex >= 0 && matches[activeIndex]) {
        matches[activeIndex].classList.add('search-current');
        matches[activeIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      updateSearchButtons();
    }

    function runSearch(resetIndex = true) {
      const term = searchInput.value.trim().toLowerCase();
      clearSearchClasses();
      if (!term) {
        matches = [];
        activeIndex = -1;
        updateSearchButtons();
        return;
      }
      matches = searchableItems.filter((item) => item.textContent.toLowerCase().includes(term));
      activeIndex = matches.length === 0 ? -1 : (resetIndex ? 0 : Math.min(activeIndex, matches.length - 1));
      focusActiveMatch();
    }

    function moveSearch(delta) {
      if (matches.length === 0) {
        return;
      }
      activeIndex = (activeIndex + delta + matches.length) % matches.length;
      focusActiveMatch();
    }

    searchInput.addEventListener('input', () => runSearch(true));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        moveSearch(event.shiftKey ? -1 : 1);
      }
      if (event.key === 'Escape') {
        searchInput.value = '';
        runSearch(true);
      }
    });
    searchPrev.addEventListener('click', () => moveSearch(-1));
    searchNext.addEventListener('click', () => moveSearch(1));
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      runSearch(true);
      searchInput.focus();
    });
    updateSearchButtons();
    setTimeout(() => searchInput.focus(), 100);
  </script>
</body>
</html>`;
}

async function showRelationshipGraphWebview(
  content: string,
  entitySetName: string,
  logicalName: string,
  data: EntityRelationshipExplorerResult,
  focusedRelationship: FocusedRelationship | undefined
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "dvQuickRun.relationshipGraphView",
    `Relationship Graph - ${logicalName}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = renderRelationshipGraphHtml(
    content,
    entitySetName,
    logicalName,
    data,
    focusedRelationship
  );

  panel.webview.onDidReceiveMessage(async (message: { type?: string }) => {
    if (message.type === "saveExactText") {
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`Relationship Graph - ${logicalName}.txt`),
        filters: { "Text files": ["txt"], "All files": ["*"] }
      });

      if (!target) {
        return;
      }

      await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(content));
      await vscode.window.showInformationMessage(`Relationship graph saved to ${target.fsPath}`);
      return;
    }

    if (message.type === "copiedExactText") {
      await vscode.window.showInformationMessage("Relationship graph text copied.");
    }
  });
}

export async function runRelationshipGraphViewAction(ctx: CommandContext, preferredEntitySetName?: string): Promise<void> {
  const baseUrl = await ctx.getBaseUrl();
  const scope = ctx.getScope();
  const token = await ctx.getToken(scope);
  const client = ctx.getClient();
  
  const defs = await loadEntityDefs(ctx, client, token);

  let logicalName: string | undefined;
  let entitySetName: string | undefined;

  const requestedEntitySetName = preferredEntitySetName?.trim();
  const inferredEntitySetName = requestedEntitySetName || tryGetEntitySetNameFromActiveEditor();

  if (inferredEntitySetName) {
    const inferredEntity = findEntityByEntitySetName(defs, inferredEntitySetName);

    if (inferredEntity) {
      logicalName = inferredEntity.logicalName;
      entitySetName = inferredEntity.entitySetName;
    }
  }

  if (!logicalName || !entitySetName) {
    const picked = await vscode.window.showQuickPick(
      defs.map((d) => ({
        label: d.logicalName,
        description: d.entitySetName
      })),
      {
        placeHolder: "Select entity for Relationship Graph View"
      }
    );

    if (!picked) {
      return;
    }

    logicalName = picked.label;
    entitySetName = picked.description ?? picked.label;
  }
  const selectedLogicalName = logicalName;
  const selectedEntitySetName = entitySetName;
  if (!selectedLogicalName || !selectedEntitySetName) {
    return;
  }

  const relationships = await loadEntityRelationships(ctx, client, token, selectedLogicalName);

  const tokenUnderCursor = getHoverLikeTokenUnderCursor();
  const focusedRaw = tryGetFocusedRelationship(tokenUnderCursor, relationships);
  
  let focusedRelationship = focusedRaw;
  
  if (focusedRaw) {
    focusedRelationship = await enrichFocusedRelationship(
      ctx,
      defs,
      selectedEntitySetName,
      focusedRaw,
      token,
      client
    );
  }
  
  const content = buildGraphText(
    selectedEntitySetName,
    selectedLogicalName,
    relationships,
    focusedRelationship
  );
  await showRelationshipGraphWebview(
    content,
    selectedEntitySetName,
    selectedLogicalName,
    relationships,
    focusedRelationship
  );

}