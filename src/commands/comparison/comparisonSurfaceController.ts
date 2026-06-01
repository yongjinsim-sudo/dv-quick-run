import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { buildEvidencePivotResult } from "../../product/comparison/evidenceContinuation/liveEvidencePivotService.js";
import { buildDefaultExportUri, renderComparisonMarkdown } from "../../product/comparison/export/comparisonMarkdownExport.js";
import { buildComparisonReportModel } from "../../product/comparison/reports/comparisonReportBuilder.js";
import { renderComparisonReportHtml } from "../../product/comparison/reports/comparisonReportHtmlRenderer.js";
import { renderComparisonReportPdf } from "../../product/comparison/reports/comparisonReportPdfRenderer.js";
import {
  buildInvestigationSessionKey,
  clearInvestigationSessionState,
  readInvestigationSessionState,
  writeInvestigationSessionState
} from "../../product/investigationWorkspace/investigationSessionState.js";
import type { InvestigationSessionState } from "../../product/investigationWorkspace/investigationSessionState.js";
import { canRunCrossEnvironmentDiff } from "../../product/capabilities/capabilityResolver.js";
import { renderComparisonSurfaceHtml, renderStandaloneComparisonSurfaceHtml } from "../../webview/comparisonSurface/renderComparisonSurfaceHtml.js";
import type { CommandContext } from "../context/commandContext.js";
import { promptForCrossEnvironmentDiffProAccess } from "./comparisonCapabilityPrompt.js";

let comparisonPanel: vscode.WebviewPanel | undefined;
let comparisonPanelMessageDisposable: vscode.Disposable | undefined;

function appendEvidencePivotDiagnostic(ctx: CommandContext, stage: string, details?: unknown): void {
  const timestamp = new Date().toISOString();
  const serialisedDetails = (() => {
    try {
      return typeof details === "string" ? details : JSON.stringify(details ?? {});
    } catch {
      return String(details);
    }
  })();

  ctx.output.appendLine(`[${timestamp}] [Comparison Evidence Pivot] ${stage} ${serialisedDetails}`);
}

type ComparisonExportKind = "json" | "md" | "html" | "baseline" | "summary-html" | "handoff-html" | "summary-pdf" | "handoff-pdf";

async function readWatermarkLogoDataUri(ctx: CommandContext): Promise<string | undefined> {
  const logoUri = vscode.Uri.joinPath(ctx.ext.extensionUri, "images", "icon.png");
  try {
    const bytes = await vscode.workspace.fs.readFile(logoUri);
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return undefined;
  }
}

function getExportFilter(kind: ComparisonExportKind): Record<string, string[]> {
  if (kind === "json") {
    return { "JSON": ["json"] };
  }

  if (kind === "md") {
    return { "Markdown": ["md"] };
  }

  if (kind === "summary-pdf" || kind === "handoff-pdf") {
    return { "PDF": ["pdf"] };
  }

  return { "HTML": ["html"] };
}

function getExportSaveLabel(kind: ComparisonExportKind): string {
  switch (kind) {
    case "json":
      return "Save JSON";
    case "md":
      return "Save MD";
    case "baseline":
      return "Export Baseline Diff";
    case "summary-html":
      return "Save Diff Findings Summary";
    case "handoff-html":
      return "Save Investigation Handoff";
    case "summary-pdf":
      return "Save Diff Findings Summary PDF";
    case "handoff-pdf":
      return "Save Investigation Handoff PDF";
    case "html":
    default:
      return "Save HTML";
  }
}

function getExportDialogTitle(model: ComparisonViewModel, kind: ComparisonExportKind): string {
  const exportTitle = model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff";
  switch (kind) {
    case "json":
      return `Save ${exportTitle} JSON`;
    case "md":
      return `Save ${exportTitle} Markdown`;
    case "baseline":
      return "Export Pre-investigation Baseline Diff";
    case "summary-html":
      return "Save Diff Findings Summary HTML";
    case "handoff-html":
      return "Save Investigation Handoff HTML";
    case "summary-pdf":
      return "Save Diff Findings Summary PDF";
    case "handoff-pdf":
      return "Save Investigation Handoff PDF";
    case "html":
    default:
      return `Save ${exportTitle} HTML`;
  }
}

async function buildComparisonExportContent(ctx: CommandContext, model: ComparisonViewModel, kind: ComparisonExportKind): Promise<Buffer | string> {
  if (kind === "json") {
    return `${JSON.stringify(model, null, 2)}\n`;
  }

  if (kind === "md") {
    return renderComparisonMarkdown(model);
  }

  if (kind === "summary-html" || kind === "handoff-html") {
    const logoDataUri = await readWatermarkLogoDataUri(ctx);
    const report = buildComparisonReportModel(kind === "summary-html" ? "DiffFindingsSummary" : "InvestigationHandoff", model, {
      watermarkLogoDataUri: logoDataUri
    });
    return renderComparisonReportHtml(report);
  }

  if (kind === "summary-pdf" || kind === "handoff-pdf") {
    const logoDataUri = await readWatermarkLogoDataUri(ctx);
    const report = buildComparisonReportModel(kind === "summary-pdf" ? "DiffFindingsSummary" : "InvestigationHandoff", model, {
      watermarkLogoDataUri: logoDataUri
    });
    return renderComparisonReportPdf(report);
  }

  return renderStandaloneComparisonSurfaceHtml(model);
}

function getSavedExportLabel(model: ComparisonViewModel, kind: ComparisonExportKind): string {
  if (kind === "baseline") {
    return "Pre-investigation Baseline Diff HTML";
  }

  if (kind === "summary-html") {
    return "Diff Findings Summary HTML";
  }

  if (kind === "handoff-html") {
    return "Investigation Handoff HTML";
  }

  if (kind === "summary-pdf") {
    return "Diff Findings Summary PDF";
  }

  if (kind === "handoff-pdf") {
    return "Investigation Handoff PDF";
  }

  return `${model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"} ${kind.toUpperCase()}`;
}

async function saveComparisonExport(ctx: CommandContext, model: ComparisonViewModel, kind: ComparisonExportKind): Promise<vscode.Uri | undefined> {
  if (!canRunCrossEnvironmentDiff()) {
    await promptForCrossEnvironmentDiffProAccess("Comparison export");
    return undefined;
  }

  const uri = await vscode.window.showSaveDialog({
    defaultUri: buildDefaultExportUri(model, kind),
    filters: getExportFilter(kind),
    saveLabel: getExportSaveLabel(kind),
    title: getExportDialogTitle(model, kind)
  });

  if (!uri) {
    return undefined;
  }

  const content = await buildComparisonExportContent(ctx, model, kind);

  await vscode.workspace.fs.writeFile(uri, typeof content === "string" ? Buffer.from(content, "utf8") : content);
  void vscode.window.showInformationMessage(`DV Quick Run: Saved ${getSavedExportLabel(model, kind)} to ${uri.fsPath}.`);
  return uri;
}

export function revealComparisonSurface(ctx: CommandContext, model: ComparisonViewModel): void {
  const investigationSessionKey = buildInvestigationSessionKey(model);
  const persistedInvestigationState = readInvestigationSessionState(ctx.ext, investigationSessionKey);
  if (comparisonPanel) {
    comparisonPanel.reveal(vscode.ViewColumn.One);
  } else {
    comparisonPanel = vscode.window.createWebviewPanel(
      "dvQuickRunCrossEnvironmentDiff",
      model.title.startsWith("Timeline Diff") ? "DV Quick Run: Timeline Diff" : "DV Quick Run: Cross-Environment Diff",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    comparisonPanel.onDidDispose(() => {
      comparisonPanelMessageDisposable?.dispose();
      comparisonPanelMessageDisposable = undefined;
      comparisonPanel = undefined;
    }, null, ctx.ext.subscriptions);
  }

  comparisonPanelMessageDisposable?.dispose();
  comparisonPanelMessageDisposable = comparisonPanel.webview.onDidReceiveMessage((message: unknown) => {
    const request = message as { readonly type?: string; readonly kind?: string; readonly state?: InvestigationSessionState; readonly evidenceId?: string; readonly label?: string; readonly value?: string; readonly evidenceKind?: string; readonly parentTitle?: string; readonly parentSummary?: string; readonly parentKind?: string; readonly parentProvider?: string; readonly parentEvidence?: string; readonly entityLogicalName?: string; readonly stage?: string; readonly details?: Record<string, unknown> };
    if (request.type === "resetInvestigationState") {
      void clearInvestigationSessionState(ctx.ext, investigationSessionKey);
      return;
    }

    if (request.type === "investigationStateChanged" && request.state) {
      void writeInvestigationSessionState(ctx.ext, investigationSessionKey, request.state);
      return;
    }
    if (request.type === "evidencePivotTrace") {
      return;
    }

    if (request.type === "evidencePivotRequested") {
      appendEvidencePivotDiagnostic(ctx, "request.received", {
        evidenceId: request.evidenceId,
        evidenceKind: request.evidenceKind,
        label: request.label,
        value: request.value,
        parentTitle: request.parentTitle,
        parentKind: request.parentKind,
        parentProvider: request.parentProvider,
        entityLogicalName: request.entityLogicalName
      });

      void buildEvidencePivotResult(ctx, request.evidenceKind, request.label, request.value, request.parentTitle, request.parentSummary, request.parentKind, request.parentProvider, request.parentEvidence, request.entityLogicalName, {
          append: (stage, details) => appendEvidencePivotDiagnostic(ctx, stage, details)
        })
        .then((result) => {
          appendEvidencePivotDiagnostic(ctx, "request.completed", {
            evidenceId: request.evidenceId,
            status: result.status,
            summary: result.summary
          });
          void comparisonPanel?.webview.postMessage({
            type: "evidencePivotResult",
            evidenceId: request.evidenceId,
            status: result.status,
            summary: result.summary
          });
        })
        .catch((error: unknown) => {
          const summary = `Live evidence pivot could not complete: ${error instanceof Error ? error.message : String(error)}`;
          appendEvidencePivotDiagnostic(ctx, "request.failed", {
            evidenceId: request.evidenceId,
            error: summary
          });
          void comparisonPanel?.webview.postMessage({
            type: "evidencePivotResult",
            evidenceId: request.evidenceId,
            status: "error",
            summary
          });
        });
      return;
    }

    if (request.type !== "saveComparison") {
      return;
    }

    if (request.kind === "json" || request.kind === "md" || request.kind === "html" || request.kind === "baseline" || request.kind === "summary-html" || request.kind === "handoff-html" || request.kind === "summary-pdf" || request.kind === "handoff-pdf") {
      void saveComparisonExport(ctx, model, request.kind).then((savedUri) => {
        if (request.kind === "baseline" && savedUri) {
          const exportedAt = new Date().toLocaleString();
          void writeInvestigationSessionState(ctx.ext, investigationSessionKey, {
            ...readInvestigationSessionState(ctx.ext, investigationSessionKey),
            baselineExportedAt: exportedAt
          });
          void comparisonPanel?.webview.postMessage({
            type: "baselineExported",
            exportedAt
          });
        }
      });
    }
  }, null, ctx.ext.subscriptions);

  comparisonPanel.title = model.title.startsWith("Timeline Diff") ? "DV Quick Run: Timeline Diff" : "DV Quick Run: Cross-Environment Diff";
  comparisonPanel.webview.html = renderComparisonSurfaceHtml(comparisonPanel.webview, model, { canExport: canRunCrossEnvironmentDiff(), isProPreview: !canRunCrossEnvironmentDiff(), investigationState: persistedInvestigationState });
}
