export function getPromptLibraryStyles(): string {
  return `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
button, input { font: inherit; }
.shell { max-width: 1500px; margin: 0 auto; padding: 28px; }
.hero { display:flex; justify-content:space-between; gap:28px; align-items:flex-start; padding:22px 24px; border:1px solid var(--vscode-panel-border); border-radius:14px; background:var(--vscode-sideBar-background); }
.hero h1 { margin:4px 0 8px; font-size:28px; }
.hero p { margin:0; max-width:760px; color:var(--vscode-descriptionForeground); line-height:1.5; }
.eyebrow { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--vscode-descriptionForeground); font-weight:700; }
.hero-stats { display:grid; grid-template-columns:repeat(2,minmax(110px,1fr)); gap:8px; min-width:280px; }
.hero-stats span { padding:9px 10px; border-radius:8px; background:var(--vscode-editor-background); border:1px solid var(--vscode-panel-border); font-size:12px; }
.quick-starts { margin:18px 0; padding:16px; border:1px solid var(--vscode-panel-border); border-radius:12px; background:var(--vscode-sideBar-background); }
.quick-start-heading { display:flex; justify-content:space-between; gap:18px; align-items:end; margin-bottom:12px; }
.quick-start-heading h2 { margin:3px 0 0; font-size:18px; }
.quick-start-heading p { margin:0; color:var(--vscode-descriptionForeground); }
.quick-start-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
.quick-start-button { text-align:left; min-height:88px; padding:11px; border:1px solid var(--vscode-panel-border); border-radius:9px; background:var(--vscode-editor-background); color:var(--vscode-foreground); cursor:pointer; display:flex; flex-direction:column; gap:5px; }
.quick-start-button:hover { border-color:var(--vscode-focusBorder); }
.quick-start-button small, .quick-start-label { color:var(--vscode-descriptionForeground); font-size:11px; }
.quick-start-label { text-transform:uppercase; letter-spacing:.04em; font-weight:700; }
.toolbar { display:flex; align-items:end; gap:12px; margin:18px 0 12px; }
.search-box { flex:1; display:flex; flex-direction:column; gap:5px; font-size:11px; color:var(--vscode-descriptionForeground); }
.search-box input { width:100%; padding:10px 12px; border:1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius:8px; color:var(--vscode-input-foreground); background:var(--vscode-input-background); outline:none; }
.search-box input:focus { border-color:var(--vscode-focusBorder); }
.tier-filters { display:flex; gap:6px; }
.filter-chip, .secondary-button, .primary-button { border:1px solid var(--vscode-button-border, var(--vscode-panel-border)); border-radius:7px; padding:8px 11px; cursor:pointer; }
.filter-chip, .secondary-button { color:var(--vscode-foreground); background:var(--vscode-button-secondaryBackground); }
.filter-chip.active { outline:1px solid var(--vscode-focusBorder); background:var(--vscode-list-activeSelectionBackground); color:var(--vscode-list-activeSelectionForeground); }
.primary-button { color:var(--vscode-button-foreground); background:var(--vscode-button-background); }
.primary-button:disabled { opacity:.5; cursor:not-allowed; }
.category-strip { display:grid; grid-template-columns:repeat(7,minmax(145px,1fr)); gap:8px; margin-bottom:18px; }
.category-button { text-align:left; min-height:100px; padding:10px; border-radius:9px; border:1px solid var(--vscode-panel-border); background:var(--vscode-sideBar-background); color:var(--vscode-foreground); cursor:pointer; display:grid; grid-template-columns:1fr auto; gap:4px 8px; }
.category-button small { grid-column:1 / -1; color:var(--vscode-descriptionForeground); line-height:1.3; }
.category-button.active { border-color:var(--vscode-focusBorder); outline:1px solid var(--vscode-focusBorder); }
.workspace { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(360px,.85fr); gap:18px; align-items:start; }
.catalogue-pane, .builder-pane { border:1px solid var(--vscode-panel-border); border-radius:12px; background:var(--vscode-sideBar-background); }
.catalogue-pane { padding:16px; min-height:600px; }
.builder-pane { position:sticky; top:18px; padding:18px; min-height:500px; }
.pane-heading h2, .builder-pane h2 { margin:0; }
.pane-heading p { margin:4px 0 12px; color:var(--vscode-descriptionForeground); }
.prompt-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.prompt-card { text-align:left; padding:12px; border-radius:9px; border:1px solid var(--vscode-panel-border); background:var(--vscode-editor-background); color:var(--vscode-foreground); cursor:pointer; display:flex; flex-direction:column; gap:7px; min-height:142px; }
.prompt-card:hover, .prompt-card.selected { border-color:var(--vscode-focusBorder); }
.prompt-card.locked { opacity:.86; }
.prompt-card > span { color:var(--vscode-descriptionForeground); line-height:1.35; }
.prompt-card small { margin-top:auto; color:var(--vscode-descriptionForeground); }
.prompt-card-top { display:flex; justify-content:space-between; align-items:center; }
.stage-badge, .tier-badge { display:inline-flex; align-items:center; border-radius:999px; padding:3px 7px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
.stage-badge { border:1px solid var(--vscode-panel-border); color:var(--vscode-descriptionForeground); }
.tier-free { background:var(--vscode-testing-iconPassed); color:var(--vscode-editor-background); }
.tier-pro { background:var(--vscode-badge-background); color:var(--vscode-badge-foreground); }
.builder-empty { text-align:center; padding:72px 24px; color:var(--vscode-descriptionForeground); }
.builder-icon { font-size:38px; margin-bottom:8px; }
.builder-header { display:flex; justify-content:space-between; gap:12px; }
.builder-header p { color:var(--vscode-descriptionForeground); line-height:1.45; }
.capability-details { margin-top:8px; color:var(--vscode-descriptionForeground); font-size:11px; }
.capability-details summary { cursor:pointer; }
.capability-details code { display:inline-block; margin-top:6px; color:var(--vscode-foreground); }
.parameter-form { display:flex; flex-direction:column; gap:12px; margin:18px 0; }
.parameter-field label { display:block; font-weight:600; margin-bottom:4px; }
.parameter-field small { display:block; color:var(--vscode-descriptionForeground); margin:5px 0 0; }
.parameter-field input { width:100%; padding:9px 10px; border:1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius:7px; color:var(--vscode-input-foreground); background:var(--vscode-input-background); }
.parameter-field input:focus { outline:1px solid var(--vscode-focusBorder); border-color:var(--vscode-focusBorder); }
.required { color:var(--vscode-errorForeground); }
.preview-heading { display:flex; align-items:center; justify-content:space-between; margin-top:18px; }
.preview-heading h3, .journey-section h3 { margin:0 0 8px; }
.preview-status { color:var(--vscode-descriptionForeground); font-size:11px; }
.prompt-preview { white-space:pre-wrap; word-break:break-word; min-height:112px; margin:0; padding:12px; border-radius:8px; border:1px solid var(--vscode-panel-border); background:var(--vscode-textCodeBlock-background); font-family:var(--vscode-editor-font-family); line-height:1.45; }
.builder-actions { display:flex; align-items:center; gap:10px; margin-top:10px; min-height:34px; }
.builder-actions span { color:var(--vscode-descriptionForeground); font-size:11px; }
.locked-banner { display:grid; gap:7px; margin:14px 0; padding:11px; border-radius:8px; border:1px solid var(--vscode-panel-border); background:var(--vscode-editorWarning-background, var(--vscode-sideBar-background)); }
.locked-banner span { color:var(--vscode-descriptionForeground); }
.locked-banner button { justify-self:start; }
.journey-section { border-top:1px solid var(--vscode-panel-border); margin-top:18px; padding-top:16px; }
.follow-up-list { display:flex; flex-direction:column; gap:7px; }
.follow-up-button { text-align:left; border:1px solid var(--vscode-panel-border); border-radius:7px; padding:9px; color:var(--vscode-foreground); background:var(--vscode-editor-background); cursor:pointer; }
.follow-up-button:hover { border-color:var(--vscode-focusBorder); }
.empty-state { padding:60px 20px; text-align:center; color:var(--vscode-descriptionForeground); }
@media (max-width:1100px) { .quick-start-grid { grid-template-columns:repeat(2,1fr); } .category-strip { grid-template-columns:repeat(3,1fr); } .workspace { grid-template-columns:1fr; } .builder-pane { position:static; } }
@media (max-width:700px) { .shell { padding:14px; } .quick-start-grid { grid-template-columns:1fr; } .quick-start-heading { display:block; } .quick-start-heading p { margin-top:5px; } .hero { flex-direction:column; } .hero-stats { width:100%; } .toolbar { flex-wrap:wrap; } .search-box { flex-basis:100%; } .category-strip, .prompt-grid { grid-template-columns:1fr; } }
`;
}
